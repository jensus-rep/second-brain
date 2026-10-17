import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { referenceAnswerComparison } from "../lib/brain/answer-comparison.ts";
import { brainBody } from "./brain-request.mjs";

// Use an isolated local dev server and explicitly choose the same SQLite file.
const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5193";
const originUrl = new URL(origin);
if (!["127.0.0.1", "localhost"].includes(originUrl.hostname)) throw new Error("Deck-switching tests may only change localhost.");
const sqlitePath = resolve(process.env.BRAIN_TEST_SQLITE_PATH ?? process.env.NEWHOPE_SQLITE_PATH ?? "outputs/deckwechsel-2026-10-17/qa.sqlite");
const output = resolve(process.env.BRAIN_TEST_OUTPUT ?? "outputs/deckwechsel-2026-10-17");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.route("**/*", route => {
  const url = new URL(route.request().url());
  return ["http:", "https:"].includes(url.protocol) && url.origin !== originUrl.origin ? route.abort() : route.continue();
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
page.setDefaultNavigationTimeout(90000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let initial;
let heldWrite;
let heldComparison;

const now = new Date().toISOString();
const topics = [
  { id: "deck-qa-fr-topic", title: "Französisch", description: "Erste Gespräche", color: "blue" },
  { id: "deck-qa-id-topic", title: "Indonesisch", description: "Erste Gespräche", color: "green" },
];
const notes = topics.map((topic, index) => ({ id: `deck-qa-note-${index}`, title: topic.title, summary: topic.description, content: "## Erste Gespräche\n\nBegrüßen und vom Alltag erzählen.", topicId: topic.id, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: now, updatedAt: now }));
const cards = [
  ["deck-qa-fr-1", "Wie sagst du Bonjour?", "Bonjour, je m’appelle Alex.", 0, 1],
  ["deck-qa-fr-2", "Wie erzählst du auf Französisch von deinem Tag?", "Aujourd’hui, je travaille.", 0, 2],
  ["deck-qa-fr-3", "Wie fragst du auf Französisch nach einem Wort?", "Comment dit-on cela en français ?", 0, 1],
  ["deck-qa-id-1", "Wie begrüßt du jemanden auf Indonesisch?", "Halo, nama saya Alex.", 1, 1],
  ["deck-qa-id-2", "Wie erzählst du auf Indonesisch von deinem Tag?", "Hari ini saya bekerja.", 1, 2],
  ["deck-qa-id-3", "Wie fragst du auf Indonesisch nach einem Wort?", "Apa artinya kata ini?", 1, 1],
].map(([id, question, answer, noteIndex, priority], index) => ({ id, question, answer, noteId: notes[noteIndex].id, priority, reviews: 0, intervalDays: 0, dueAt: `2000-01-01T00:00:0${index}.000Z` }));
const decks = [
  { id: "deck-qa-fr", title: "Französisch · Erste Gespräche", description: "Begrüßung, Alltag und Rückfragen", noteIds: [notes[0].id], cardIds: [], questionIds: [], pathIds: [] },
  { id: "deck-qa-id", title: "Indonesisch · Erste Gespräche", description: "Begrüßung, Alltag und Rückfragen", noteIds: [notes[1].id], cardIds: [], questionIds: [], pathIds: [] },
];
const fixture = { schemaVersion: 1, topics, notes, cards, paths: [], completedStepIds: [], quizQuestions: [], quizRuns: [], learningReminders: [], learningCollections: decks };
const button = (name, scope = page) => scope.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
const responseField = () => page.getByLabel("Deine Antwort in eigenen Worten", { exact: true });
const deckDialog = () => page.getByRole("dialog", { name: "Lernkarten-Deck wechseln", exact: true });
const discardDialog = () => page.getByRole("alertdialog", { name: "Antwort noch nicht bewertet", exact: true });
const rate = known => page.getByRole("group", { name: "Bewertung der Lernkarte", exact: true }).getByRole("button", { name: known ? /^Gewusst/ : /^Noch üben/ });

async function snapshot() {
  const response = await page.request.get(origin + "/api/brain", { maxRedirects: 0 });
  assert.equal(response.status(), 200, "The test uses an authenticated local workspace.");
  return response.json();
}
async function verifyLocal(current) {
  current ??= await snapshot();
  assert.equal((await realpath(sqlitePath)).toLocaleLowerCase("en"), sqlitePath.toLocaleLowerCase("en"));
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const row = db.prepare("SELECT body, revision FROM newhope_workspaces WHERE owner_id = ?").get("local_dev");
    assert.ok(row, "The local development workspace exists in the selected SQLite file.");
    assert.equal(Number(row.revision), current.revision, "The local API and selected SQLite file must have the same revision.");
    const stored = JSON.parse(row.body);
    for (const key of ["cards", "quizQuestions", "quizRuns", "learningReminders", "learningCollections"]) stored[key] ??= [];
    assert.deepEqual(stored, current.workspace, "The local API and selected SQLite file must contain the same workspace.");
  } finally { db.close(); }
}
async function write(workspace) {
  const current = await snapshot();
  await verifyLocal(current);
  const response = await page.request.put(origin + "/api/brain", { headers: { Origin: origin }, data: { revision: current.revision, workspace } });
  assert.equal(response.status(), 200, await response.text());
  return snapshot();
}
async function reload() {
  const response = await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  await expect(page.getByRole("heading", { name: "Dein Wissen", exact: true })).toBeVisible();
}
async function openCards() {
  if (!await button("Lernkarten").isVisible()) await button("Navigation öffnen").click();
  await button("Lernkarten").click();
}
async function openFilters() {
  const disclosure = page.locator(".flashcard-filters-disclosure");
  if (!await disclosure.evaluate(element => element.open)) await disclosure.locator("summary").click();
}
async function chooseDeck(deck, { discard = false } = {}) {
  await button("Deck wechseln").click();
  await expect(deckDialog()).toBeVisible();
  await deckDialog().getByLabel("Deck suchen", { exact: true }).fill(deck.title.split(" · ")[0]);
  await button(`${deck.title} auswählen`, deckDialog()).click();
  if (discard) {
    await expect(discardDialog()).toBeVisible();
    await button("Deck wechseln", discardDialog()).click();
  }
}
async function waitSaved(predicate) {
  await expect.poll(async () => predicate((await snapshot()).workspace)).toBe(true);
  await expect(page.locator(".save-state")).toHaveText("Gespeichert");
  const current = await snapshot();
  await verifyLocal(current);
  return current.workspace;
}
async function closeChoiceDialogs() {
  if (await discardDialog().count() && await discardDialog().getAttribute("data-state") === "open") await button("Weiterlernen", discardDialog()).click();
  await expect(discardDialog()).toHaveCount(0);
  if (await deckDialog().count() && await deckDialog().getAttribute("data-state") === "open") await page.keyboard.press("Escape");
  await expect(deckDialog()).toHaveCount(0);
}
async function holdNextWrite(status = 200) {
  let release, arrived, finished;
  const gate = new Promise(resolve => { release = resolve; });
  const request = new Promise(resolve => { arrived = resolve; });
  const done = new Promise(resolve => { finished = resolve; });
  const pending = { release, request, done, started: false };
  const handler = async route => {
    if (route.request().method() !== "PUT") return route.continue();
    await page.unroute(origin + "/api/brain", handler);
    pending.started = true;
    arrived(brainBody(route.request()));
    await gate;
    try {
      if (status === 200) await route.fulfill({ response: await route.fetch() });
      else await route.fulfill({ status, json: { error: "Lokaler Test: Deckwechsel konnte nicht gespeichert werden." } });
    } finally { finished(); }
  };
  await page.route(origin + "/api/brain", handler);
  heldWrite = pending;
  return heldWrite;
}
async function finishWrite() {
  heldWrite.release();
  await heldWrite.done;
  heldWrite = null;
  await page.unroute(origin + "/api/brain");
}
async function holdNextComparison() {
  let release, arrived, finished;
  const gate = new Promise(resolve => { release = resolve; });
  const request = new Promise(resolve => { arrived = resolve; });
  const done = new Promise(resolve => { finished = resolve; });
  heldComparison = { release, request, done, next: true, gate, arrived, finished };
}
await page.route(origin + "/api/tutor/compare", async route => {
  const body = route.request().postDataJSON();
  const answer = cards.find(card => card.id === body.cardId)?.answer;
  assert.ok(answer, "Comparisons only belong to a fixture card.");
  const pending = heldComparison?.next ? heldComparison : null;
  if (pending) {
    pending.next = false;
    pending.arrived(body);
    await pending.gate;
  }
  try {
    await route.fulfill({ json: pending ? { ...referenceAnswerComparison(body, answer), source: "llm", verdict: "aligned", summary: "Diese verspätete Antwort gehört ausschließlich zum alten Deck.", matched: ["Die Erklärung passt zur alten Karte."], missing: [] } : referenceAnswerComparison(body, answer) });
  } catch (error) {
    if (!pending || !/aborted|Invalid Interception|Target.*closed|Request.*finished/i.test(error.message)) throw error;
  } finally { pending?.finished(); }
});

try {
  await mkdir(output, { recursive: true });
  await reload();
  initial = (await snapshot()).workspace;
  await verifyLocal();
  await write(fixture);
  await reload();
  await openCards();

  console.log("Checking direct searchable deck selection and filter reset in the overview");
  const nativePicker = page.getByLabel("Lernsammlung für Lernkarten", { exact: true });
  await nativePicker.selectOption(decks[0].id);
  await openFilters();
  await page.getByLabel("Thema der Lernkarten", { exact: true }).selectOption(topics[0].id);
  await page.getByLabel("Prioritätsstufe", { exact: true }).selectOption("1");
  await page.getByLabel("Lernkarten durchsuchen", { exact: true }).fill("Bonjour");
  await expect(page.locator(".flashcard-list > article")).toHaveCount(1);
  const beforeSelection = await snapshot();
  await chooseDeck(decks[1]);
  await expect(nativePicker).toHaveValue(decks[1].id);
  await expect(page.locator(".flashcard-list > article")).toHaveCount(3);
  await openFilters();
  await expect(page.getByLabel("Thema der Lernkarten", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Prioritätsstufe", { exact: true })).toHaveValue("all");
  await expect(page.getByLabel("Lernkarten durchsuchen", { exact: true })).toHaveValue("");
  assert.deepEqual((await snapshot()).workspace.cards, beforeSelection.workspace.cards, "Choosing a deck in the overview does not review cards.");
  assert.equal((await snapshot()).workspace.flashcardSession, undefined, "Overview selection does not start a round.");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await button("Deck wechseln").click();
    await expect(deckDialog().getByLabel("Deck suchen", { exact: true })).toBeVisible();
    await expect(button(`${decks[0].title} auswählen`, deckDialog())).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Deck picker fits ${width}px.`);
    await page.screenshot({ path: `${output}/deck-picker-${width}.png`, fullPage: true, animations: "disabled" });
    await page.keyboard.press("Escape");
  }
  await page.setViewportSize({ width: 1440, height: 1000 });

  console.log("Checking A → B → A restores exact saved rounds and preserves reviews");
  await nativePicker.selectOption(decks[0].id);
  await verifyLocal();
  await button("Lernrunde starten").click();
  let stored = await waitSaved(workspace => workspace.flashcardSession?.collectionId === decks[0].id);
  const sessionA = stored.flashcardSession.id;
  await expect(page.locator(".study-question")).toHaveText(cards[0].question);
  const firstResponse = "Bonjour, je m’appelle Alex.";
  await responseField().fill(firstResponse);
  await button("Antwort aufdecken").click();
  await rate(true).click();
  stored = await waitSaved(workspace => workspace.cards[0].reviews === 1 && workspace.flashcardSession?.index === 1);
  assert.equal(stored.cardReviewEvents.at(-1).response, firstResponse);
  const firstReview = structuredClone(stored.cardReviewEvents.at(-1));
  await chooseDeck(decks[1]);
  stored = await waitSaved(workspace => workspace.flashcardSession?.collectionId === decks[1].id);
  const sessionB = stored.flashcardSession.id;
  assert.notEqual(sessionB, sessionA);
  assert.deepEqual(stored.flashcardSession.queue.map(entry => entry.id), cards.slice(3).map(card => card.id));
  assert.equal(stored.pausedFlashcardSessions.find(session => session.id === sessionA).index, 1);
  assert.deepEqual(stored.cardReviewEvents, [firstReview]);
  await expect(page.locator(".study-question")).toHaveText(cards[3].question);
  await expect(responseField()).toHaveValue("");
  await chooseDeck(decks[0]);
  stored = await waitSaved(workspace => workspace.flashcardSession?.id === sessionA && workspace.flashcardSession.index === 1);
  assert.equal(stored.pausedFlashcardSessions.find(session => session.id === sessionB).index, 0);
  await expect(page.locator(".study-question")).toHaveText(cards[1].question);
  await reload();
  await openCards();
  await page.getByLabel("Lernsammlung für Lernkarten", { exact: true }).selectOption(decks[0].id);
  await button("Lernrunde fortsetzen").click();
  await expect(page.locator(".study-question")).toHaveText(cards[1].question);
  assert.equal((await snapshot()).workspace.flashcardSession.id, sessionA, "Reload resumes the saved round instead of creating a replacement.");

  console.log("Checking unreviewed answer cancellation and failed switch preserve the current answer");
  const draft = "Aujourd’hui, je travaille et j’apprends le français.";
  await responseField().fill(draft);
  await chooseDeck(decks[1]);
  await expect(discardDialog()).toBeVisible();
  await button("Weiterlernen", discardDialog()).click();
  await expect(page.locator(".study-question")).toHaveText(cards[1].question);
  await expect(responseField()).toHaveValue(draft);
  await closeChoiceDialogs();
  const beforeFailure = await snapshot();
  await verifyLocal(beforeFailure);
  await holdNextWrite(503);
  await chooseDeck(decks[1], { discard: true });
  await heldWrite.request;
  await finishWrite();
  await expect(page.getByRole("alert").filter({ hasText: "Lokaler Test:" })).toBeVisible();
  await expect(page.locator(".study-question")).toHaveText(cards[1].question);
  await expect(responseField()).toHaveValue(draft);
  assert.deepEqual((await snapshot()).workspace.flashcardSession, beforeFailure.workspace.flashcardSession);
  assert.deepEqual((await snapshot()).workspace.cardReviewEvents, beforeFailure.workspace.cardReviewEvents);
  await closeChoiceDialogs();

  console.log("Checking a delayed comparison cannot cross into the selected deck");
  await holdNextComparison();
  await responseField().fill(draft + " Une nouvelle phrase.");
  await button("Antwort aufdecken").click();
  const compared = await heldComparison.request;
  assert.equal(compared.cardId, cards[1].id);
  assert.equal(compared.sessionId, sessionA);
  await chooseDeck(decks[1], { discard: true });
  stored = await waitSaved(workspace => workspace.flashcardSession?.id === sessionB);
  await expect(page.locator(".study-question")).toHaveText(cards[3].question);
  await expect(responseField()).toHaveValue("");
  heldComparison.release();
  await heldComparison.done;
  heldComparison = null;
  await button("Antwort aufdecken").click();
  await expect(page.locator(".study-answer-comparison")).toHaveCount(0);
  await expect(page.locator(".study-answer")).not.toContainText("Diese verspätete Antwort gehört ausschließlich zum alten Deck.");
  assert.deepEqual(stored.cardReviewEvents, [firstReview], "Discarding unreviewed text adds no review event.");

  console.log("Checking pending ratings block deck changes and save only to their source card");
  await verifyLocal();
  await holdNextWrite();
  await rate(true).click();
  const pendingBody = await heldWrite.request;
  assert.equal(pendingBody.workspace.cardReviewEvents.at(-1).cardId, cards[3].id);
  await expect(page.locator(".study-question")).toHaveText(cards[4].question);
  await expect(button("Deck wechseln")).toBeDisabled();
  assert.equal((await snapshot()).workspace.cards[3].reviews, 0, "The held write has not reached SQLite yet.");
  await finishWrite();
  stored = await waitSaved(workspace => workspace.cards[3].reviews === 1 && workspace.flashcardSession?.index === 1);
  await expect(button("Deck wechseln")).toBeEnabled();
  assert.deepEqual(stored.cards.map(card => card.reviews), [1, 0, 0, 1, 0, 0]);
  assert.deepEqual(stored.cardReviewEvents.map(event => event.cardId), [cards[0].id, cards[3].id]);
  assert.equal(stored.cardReviewEvents[1].response ?? "", "", "An earlier deck's answer is never saved against the new deck.");
  await chooseDeck(decks[0]);
  stored = await waitSaved(workspace => workspace.flashcardSession?.id === sessionA && workspace.flashcardSession.index === 1);
  await expect(page.locator(".study-question")).toHaveText(cards[1].question);
  await expect(responseField()).toHaveValue("");
  assert.deepEqual(stored.cardReviewEvents.map(event => event.cardId), [cards[0].id, cards[3].id], "Switching back never repeats a pending rating.");

  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(button("Deck wechseln")).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Active round fits ${width}px.`);
    await page.screenshot({ path: `${output}/deck-active-${width}.png`, fullPage: true, animations: "disabled" });
  }
  assert.deepEqual(errors, [], "Deck changes cause no client runtime errors.");
  console.log("Deck browser tests passed: direct search, filter reset, exact per-deck resume, answer cancellation, failed-switch preservation, stale-comparison isolation, pending-rating protection, and 390/320px layout.");
} catch (error) {
  await page.screenshot({ path: `${output}/deck-failure.png`, fullPage: true, animations: "disabled" }).catch(() => {});
  console.error("Deck test state:", JSON.stringify({ errors, headings: await page.getByRole("heading").allTextContents(), body: (await page.locator("body").innerText()).slice(0, 2500) }));
  throw error;
} finally {
  heldComparison?.release();
  if (heldComparison && !heldComparison.next) await heldComparison.done;
  heldWrite?.release();
  if (heldWrite?.started) await heldWrite.done;
  await page.unrouteAll({ behavior: "wait" });
  if (initial) await write(initial);
  await browser.close();
}
