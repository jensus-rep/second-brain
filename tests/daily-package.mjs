import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

// Walks one daily package end to end. All writes go to a verified loopback SQLite store.
const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Daily package tests may only mutate localhost.");
const api = origin + "/api/brain";
const sqlitePath = resolve(process.env.BRAIN_TEST_SQLITE_PATH ?? process.env.NEWHOPE_SQLITE_PATH ?? ".data/newhope.sqlite");
const shots = process.env.BRAIN_TEST_SHOTS;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Berlin" });
page.setDefaultTimeout(30000);
page.setDefaultNavigationTimeout(120000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));

async function snapshot() {
  const response = await page.request.get(api);
  assert.equal(response.status(), 200);
  return response.json();
}
async function verifyLocal(current) {
  assert.equal((await realpath(sqlitePath)).toLowerCase(), sqlitePath.toLowerCase());
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const row = db.prepare("SELECT revision FROM newhope_workspaces WHERE owner_id = ?").get("local_dev");
    assert.equal(row?.revision, current.revision, "The API must match the selected local SQLite file before writes.");
  } finally { db.close(); }
}
async function write(workspace) {
  const current = await snapshot();
  await verifyLocal(current);
  const response = await page.request.put(api, { data: { workspace, revision: current.revision } });
  assert.equal(response.status(), 200, await response.text());
}
async function saved(predicate, label) {
  await expect.poll(async () => predicate((await snapshot()).workspace), { message: label, timeout: 20000 }).toBe(true);
}
const button = name => page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
const shot = async name => { if (shots) { await page.waitForTimeout(900); await page.screenshot({ path: `${shots}/${name}.png`, fullPage: false }); } };

const stamp = new Date(Date.now() - 2 * 86_400_000).toISOString();
const paragraph = Array.from({ length: 110 }, (_, index) => `Gedanke${index}`).join(" ");
const content = `## Warum das zählt\n\n${paragraph}\n\n## Wie es angewendet wird\n\n${paragraph}\n\n## Quellen\n\nEine Quelle.`;
const note = (id, topicId) => ({ id, title: `Einstieg ${id}`, summary: "", content, topicId, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: stamp, updatedAt: stamp });
const card = (id, noteId) => ({ id, noteId, question: `Frage zu ${id}`, answer: `Antwort zu ${id}`, reviews: 2, intervalDays: 3, dueAt: stamp });
const question = (id, noteId) => ({ id, subject: "Grundlagen", concept: `Bereich ${id}`, noteIds: [noteId], difficulty: 1, prompt: `Aufgabe ${id}`, options: [{ id: "yes", text: `Richtig ${id}`, feedback: "" }, { id: "no", text: `Falsch ${id}`, feedback: "" }], correctOptionIds: ["yes"], explanation: "Begründung.", source: "" });
const topics = [{ id: "feld-a", title: "Feld A", description: "", color: "blue", parentId: null }, { id: "feld-b", title: "Feld B", description: "", color: "green", parentId: null }];
const focus = { collectionId: null, subject: "Grundlagen", updatedAt: stamp };

const initial = (await (async () => {
  for (let attempt = 0; attempt < 40; attempt++) {
    try { await page.goto(origin, { waitUntil: "domcontentloaded" }); return await snapshot(); }
    catch (error) { if (attempt === 39) throw error; await new Promise(done => setTimeout(done, 1500)); }
  }
})());
await verifyLocal(initial);

try {
  await write({ schemaVersion: 1, topics, notes: [note("n-a", "feld-a"), note("n-b", "feld-b")], paths: [], completedStepIds: [],
    cards: ["a1", "a2", "b1", "b2"].map(id => card(id, id.startsWith("a") ? "n-a" : "n-b")),
    quizQuestions: [question("q1", "n-a"), question("q2", "n-a"), question("q3", "n-b"), question("q4", "n-b")],
    quizRuns: [], learningReminders: [], learningCollections: [], learningFocus: focus });

  await page.goto(origin, { waitUntil: "networkidle" });
  const daily = page.locator(".daily-card");
  await expect(daily.getByRole("heading", { name: "Dein Paket für heute" })).toBeVisible();
  await expect(daily).toContainText("4 Karten");
  await expect(daily).toContainText("ein Inhalt");
  await shot("home-ready");
  await daily.getByRole("button", { name: "Paket starten" }).click();

  for (let index = 1; index <= 4; index++) {
    await expect(page.locator(".study-position")).toHaveText(`${index} von 4`);
    await expect(page.locator(".flashcard-study-deck-bar")).toHaveCount(0);
    await button("Antwort aufdecken").click();
    await page.getByRole("button", { name: /Gewusst/ }).click();
  }

  const reading = page.locator(".daily-reading");
  await expect(reading.getByRole("heading", { name: "Warum das zählt" })).toBeVisible();
  await expect(reading).not.toContainText("Wie es angewendet wird");
  await expect(page.locator(".daily-steps .is-current")).toHaveText("Lesen");
  await shot("reading");
  await saved(data => data.dailyPackage?.readAt === null && data.cards.every(item => item.reviews === 3), "all four ratings are stored");
  await button("Gelesen, weiter").click();

  const run = () => snapshot().then(({ workspace }) => workspace.quizRuns.find(item => item.dailyPackageId === workspace.dailyPackage.id));
  await expect(page.locator(".quiz-session-top")).toContainText("Abschlussfragen", { timeout: 30000 });
  const started = await run();
  assert.ok(started.questions.length >= 2 && started.questions.length <= 3);
  for (const [index, item] of started.questions.entries()) {
    await page.getByRole("checkbox", { name: item.options[0].text, exact: true }).check();
    await button("Antwort speichern").click();
    await saved(data => data.quizRuns.find(entry => entry.id === started.id).answers.length === index + 1, "answer is stored");
    if (index + 1 < started.questions.length) await expect(page.getByRole("checkbox", { name: started.questions[index + 1].options[0].text, exact: true })).toBeVisible();
  }

  await button("Paket abschließen").click();
  await expect(page.getByRole("heading", { name: "Für heute geschafft" })).toBeVisible();
  await expect(page.locator(".daily-card")).toContainText("Dein erster Lerntag");
  await shot("done");
  const finished = (await snapshot()).workspace;
  assert.equal(finished.dailyPackageDays.at(-1).completed, 1);
  assert.deepEqual(finished.learningFocus, focus, "the learning focus stays where it was");

  await button("Noch ein Paket").click();
  await expect(page.locator(".daily-reading").getByRole("heading")).toBeVisible();
  const second = (await snapshot()).workspace.dailyPackage;
  assert.equal(second.number, 2);
  assert.equal(second.cardIds.length, 0, "no card is rated before it is due");
  assert.notEqual(second.reading.noteId, finished.dailyPackage.reading.noteId, "the next content comes from another field");

  await page.setViewportSize({ width: 390, height: 844 });
  await button("Mein Überblick").click().catch(() => {});
  await page.goto(origin, { waitUntil: "networkidle" });
  await expect(page.locator(".daily-card")).toContainText("Dein Paket wartet");
  await shot("home-mobile");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 0, `no horizontal scrolling at 390 px, got ${overflow}`);
  await page.locator(".daily-card").getByRole("button", { name: "Weitermachen" }).click();
  await expect(page.locator(".daily-reading")).toBeVisible();
  await shot("reading-mobile");
  const readingOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(readingOverflow <= 0, `reading view fits at 390 px, got ${readingOverflow}`);

  assert.deepEqual(errors, []);
  console.log("daily package browser test passed");
} finally {
  await write(initial.workspace).catch(error => console.error("restore failed", error));
  await browser.close();
}
