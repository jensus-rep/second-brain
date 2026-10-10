import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Flashcard tests may only change localhost.");
const sqlitePath = resolve(process.env.BRAIN_TEST_SQLITE_PATH ?? process.env.NEWHOPE_SQLITE_PATH ?? ".data/newhope.sqlite");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(90000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let initial;
let held;

async function snapshot() {
  const response = await page.request.get(origin + "/api/brain");
  assert.equal(response.status(), 200);
  return response.json();
}

async function write(workspace) {
  const current = await snapshot();
  assert.equal((await realpath(sqlitePath)).toLowerCase(), sqlitePath.toLowerCase());
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const row = db.prepare("SELECT body, revision FROM newhope_workspaces WHERE owner_id = ?").get("local_dev");
    assert.equal(row.revision, current.revision, "API and local SQLite must match before writes.");
    const stored = JSON.parse(row.body);
    for (const key of ["cards", "quizQuestions", "quizRuns", "learningReminders", "learningCollections"]) stored[key] ??= [];
    assert.deepEqual(stored, current.workspace);
  } finally { db.close(); }
  const response = await page.request.put(origin + "/api/brain", { data: { workspace, revision: current.revision } });
  assert.equal(response.status(), 200, await response.text());
  return response.json();
}

const dueAt = new Date(Date.now() - 60000).toISOString();
const cards = [
  {
    id: "compact-choices", question: "Welche Aussagen helfen beim Lernen? Mehrere Antworten sind möglich.\n\n- **A:** Ein konkretes Beispiel verbindet Wissen mit einer Handlung.\n- **B:** Zusammenhänge lassen sich durch bloßes Wiederlesen immer sicher anwenden.\n- **C:** Eine Erklärung in eigenen Worten prüft das Verständnis.\n- **D:** Mit `aktiver Wiederholung` wird der Gedanke aus dem Gedächtnis abgerufen.",
    answer: "**Richtig: A, C und D.**\n\nB ist falsch: Das Anwenden braucht auch eigene Beispiele.",
  },
  { id: "next-question", question: "Wie lässt sich ein Gedanke auf eine neue Situation übertragen?", answer: "Ein passendes Beispiel suchen und die Zusammenhänge erklären.\n\n" + "Ein eigener Gedanke bleibt durch aktives Wiederholen leichter im Gedächtnis. ".repeat(80) },
  { id: "last-question", question: "Welche Schritte unterstützen die Wiederholung?\n\n1. Eine Frage lesen.\n2. Die Antwort aus dem Gedächtnis erklären.\n3. Die eigene Antwort prüfen.", answer: "Die eigene Erinnerung prüfen und die nächste Wiederholung planen." },
].map(card => ({ ...card, noteId: null, reviews: 0, intervalDays: 0, dueAt, priority: 1 }));
// IDs determine the due-card order when timestamps match.
cards[1].dueAt = new Date(Date.parse(dueAt) + 1).toISOString();
cards[2].dueAt = new Date(Date.parse(dueAt) + 2).toISOString();
const fixture = { schemaVersion: 1, topics: [], notes: [], paths: [], completedStepIds: [], cards, quizQuestions: [], quizRuns: [], learningReminders: [], learningCollections: [] };

async function start(workspace = fixture) {
  await write(workspace);
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Lernkarten", exact: true }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "Lernrunde starten", exact: true }).click();
}

const reveal = () => page.getByRole("button", { name: "Antwort aufdecken", exact: true });
const rating = known => page.getByRole("group", { name: "Bewertung der Lernkarte", exact: true }).getByRole("button", { name: known ? /^Gewusst/ : /^Noch üben/ });

// The request stays blocked until assertions prove that the next question is usable.
async function holdWrite(status = 200) {
  let release, arrived, finished;
  const gate = new Promise(resolve => { release = resolve; });
  const request = new Promise(resolve => { arrived = resolve; });
  const done = new Promise(resolve => { finished = resolve; });
  await page.route(origin + "/api/brain", async route => {
    assert.equal(route.request().method(), "PUT");
    arrived(route.request().postDataJSON());
    await gate;
    if (status === 503) await route.fulfill({ status, json: { error: "Speichern nicht möglich. Bitte versuche es erneut." } });
    else await route.fulfill({ response: await route.fetch() });
    finished();
  }, { times: 1 });
  held = { request, done, release };
  return held;
}

async function finishWrite() {
  held.release();
  await held.done;
  held = null;
  await expect(page.locator(".save-state")).toHaveText("Gespeichert");
}

try {
  await mkdir(".sites-runtime/qa", { recursive: true });
  await page.goto(origin, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Dein Wissen", exact: true })).toBeVisible();
  initial = (await snapshot()).workspace;

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await start();
    const options = page.locator(".study-question .prose-brain > ul");
    await expect(options.locator("li")).toHaveCount(4);
    const styles = await options.evaluate(el => ({ font: parseFloat(getComputedStyle(el).fontSize), align: getComputedStyle(el).textAlign, weight: getComputedStyle(el).fontWeight }));
    assert.ok(styles.font <= 16, "Answer choices use compact text on desktop and mobile.");
    assert.equal(styles.align, "left");
    assert.equal(styles.weight, "400");
    await expect(options.locator("strong")).toHaveText(["A:", "B:", "C:", "D:"]);
    await expect(options.locator("code")).toHaveText("aktiver Wiederholung");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: `.sites-runtime/qa/flashcards-choices-${width}.png`, fullPage: true });
    await reveal().click();

    await holdWrite();
    // Two clicks in one event turn must still issue one review.
    await rating(true).evaluate(button => { button.click(); button.click(); });
    const submitted = await held.request;
    assert.equal(submitted.workspace.cards[0].reviews, 1);
    await expect(page.locator(".study-topline")).toContainText("2 von 3", { timeout: 1000 });
    await expect(page.locator(".study-question")).toHaveText(cards[1].question);
    await expect(page.locator(".study-question")).toBeInViewport();
    await expect(reveal()).toBeFocused();
    await expect(page.locator(".study-save-status")).toBeVisible();
    assert.equal((await snapshot()).workspace.cards[0].reviews, 0, "The next card appears before the server saves.");
    await reveal().click();
    await expect(rating(true)).toBeDisabled();
    await expect(rating(false)).toBeDisabled();
    await finishWrite();
    await expect(rating(false)).toBeEnabled();

    await holdWrite();
    await rating(false).click();
    await held.request;
    await expect(page.locator(".study-topline")).toContainText("3 von 3", { timeout: 1000 });
    await expect(page.locator(".study-question")).toBeInViewport();
    assert.equal(await page.locator(".study-question ol").evaluate(el => parseFloat(getComputedStyle(el).fontSize)), 16);
    await finishWrite();
    await reveal().click();
    await holdWrite();
    await rating(true).click();
    await held.request;
    await expect(page.getByRole("heading", { name: "Dein Fortschritt wird gespeichert …", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ein Stück Wissen bleibt.", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Zur Kartenübersicht", exact: true })).toBeDisabled();
    await finishWrite();
    await expect(page.getByRole("heading", { name: "Ein Stück Wissen bleibt.", exact: true })).toBeVisible();
    await page.reload({ waitUntil: "networkidle" });
    const saved = (await snapshot()).workspace.cards;
    assert.deepEqual(saved.map(card => card.reviews), [1, 1, 1]);
    assert.deepEqual(saved.map(card => card.intervalDays), [1, 0, 1]);
    assert.ok(Math.abs(Date.parse(saved[1].dueAt) - Date.now() - 600000) < 15000, "Unknown answer schedules another review in ten minutes.");
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const final of [false, true]) {
    await start(final ? { ...fixture, cards: [cards[0]] } : fixture);
    await reveal().click();
    await holdWrite(503);
    await rating(false).click();
    await held.request;
    await expect(page.locator(final ? ".study-finished" : ".study-save-status")).toBeVisible();
    held.release();
    await held.done;
    held = null;
    await expect(page.locator(".study-topline")).toContainText(final ? "1 von 1" : "1 von 3");
    await expect(page.locator(".study-answer")).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Speichern nicht möglich." })).toBeVisible();
    assert.equal((await snapshot()).workspace.cards[0].reviews, 0, "Failed review must not persist or skip its card.");
    await expect(rating(false)).toBeEnabled();
    await holdWrite();
    await rating(false).click();
    await held.request;
    await finishWrite();
    assert.equal((await snapshot()).workspace.cards[0].reviews, 1, "Retry saves exactly one review.");
  }

  await start();
  await reveal().click();
  const external = structuredClone(fixture);
  external.cards[1].reviews = 4;
  external.cards[1].intervalDays = 7;
  await write(external);
  await holdWrite();
  await rating(true).click();
  await held.request;
  held.release();
  await held.done;
  held = null;
  await expect(page.getByRole("alert").filter({ hasText: "in einem anderen Fenster geändert" })).toBeVisible();
  await expect(page.locator(".study-topline")).toContainText("1 von 3");
  await expect(page.locator(".study-answer")).toBeVisible();
  const conflicted = (await snapshot()).workspace.cards;
  assert.deepEqual(conflicted.map(card => card.reviews), [0, 4, 0], "Conflict preserves the external revision without adding a review.");
  assert.deepEqual(errors, [], "No browser runtime errors.");
  console.log("PASS: compact A–D choices at 1440/390/320px, immediate next card before persistence, focus/scroll, duplicate-click protection, known/unknown review persistence, truthful final save state, failed-save rollback/retry and revision conflict preservation.");
} finally {
  held?.release();
  if (held) await held.done;
  await page.unrouteAll({ behavior: "wait" });
  if (initial) await write(initial);
  await browser.close();
}
