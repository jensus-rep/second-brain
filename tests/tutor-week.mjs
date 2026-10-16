import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { brainBody } from "./brain-request.mjs";

// Existing weekly plans remain valid data after the Tutor surface is simplified.
// All fixture imports and UI writes must match a verified loopback SQLite store.
const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Week compatibility tests may only mutate localhost.");
const api = origin + "/api/brain";
const sqlitePath = resolve(process.env.BRAIN_TEST_SQLITE_PATH ?? process.env.NEWHOPE_SQLITE_PATH ?? ".data/newhope.sqlite");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Berlin" });
page.setDefaultTimeout(20000);
page.setDefaultNavigationTimeout(90000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const tutor = () => page.locator(".learning-tutor");
const primary = () => tutor().locator(".tutor-primary-action");
let initial;

async function snapshot() {
  const response = await page.request.get(api);
  assert.equal(response.status(), 200);
  return response.json();
}
async function verifyLocal(current) {
  assert.equal((await realpath(sqlitePath)).toLowerCase(), sqlitePath.toLowerCase());
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const row = db.prepare("SELECT body, revision FROM newhope_workspaces WHERE owner_id = ?").get("local_dev");
    assert.equal(row?.revision, current.revision, "The API must match the selected local SQLite file before writes.");
    const stored = JSON.parse(row.body);
    for (const key of ["cards", "quizQuestions", "quizRuns", "learningReminders", "learningCollections"]) stored[key] ??= [];
    assert.deepEqual(stored, current.workspace);
  } finally { db.close(); }
}
async function write(workspace) {
  const current = await snapshot();
  await verifyLocal(current);
  const response = await page.request.put(api, { data: { workspace, revision: current.revision } });
  assert.equal(response.status(), 200, await response.text());
  const saved = await snapshot();
  await verifyLocal(saved);
  return saved.workspace;
}
async function reloadTutor() {
  const response = await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  await page.getByRole("button", { name: "Tutor", exact: true }).filter({ visible: true }).first().click();
  await expect(tutor()).toBeVisible();
}
async function uiSave(action, predicate) {
  const before = await snapshot();
  await verifyLocal(before);
  const request = page.waitForRequest(request => request.url() === api && request.method() === "PUT");
  const response = page.waitForResponse(response => response.url() === api && response.request().method() === "PUT");
  await action();
  assert.equal(brainBody(await request).revision, before.revision);
  const saved = await response;
  assert.equal(saved.status(), 200, await saved.text());
  await expect.poll(async () => {
    const current = await snapshot();
    return current.revision > before.revision && predicate(current.workspace);
  }).toBe(true);
  await expect(page.locator(".save-state")).toHaveText("Gespeichert");
  const current = await snapshot();
  await verifyLocal(current);
  return current.workspace;
}

const timestamp = new Date(Date.now() - 60000).toISOString();
const startedOn = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
const subject = "Agiles Projektmanagement";
const concepts = ["Projekt und Projektmanagement: Grundlagen", "Projektstart und Stakeholder", "Klassische Planung und Projektorganisation"];
const notes = concepts.map((title, index) => ({ id: `week-legacy-note-${index}`, title, summary: "Wissen für die Projektvorbereitung.", content: "Ein gemeinsames Ziel richtet Entscheidungen im Projekt aus.", topicId: null, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: timestamp, updatedAt: timestamp }));
const cards = notes.flatMap(note => Array.from({ length: 6 }, (_, index) => ({ id: `week-card-${note.id}-${index}`, question: `${note.title}: Kartenfrage ${index + 1}`, answer: "Ein gemeinsames Ziel erklärt die Entscheidung.", noteId: note.id, dueAt: "2000-01-01T00:00:00Z", intervalDays: 0, reviews: 0 })));
const questions = notes.flatMap((note, index) => [1, 2, 3].map(difficulty => ({ id: `week-task-${index}-${difficulty}`, subject, concept: note.title, noteIds: [note.id], difficulty, prompt: `${note.title}: Aufgabe ${difficulty}`, options: [{ id: "yes", text: "Ziel und Nutzen gemeinsam klären", feedback: "Richtig." }, { id: "no", text: "Rückmeldungen ignorieren", feedback: "Feedback hilft beim Anpassen." }], correctOptionIds: ["yes"], explanation: "Ziel und Nutzen richten das Handeln aus.", source: "" })));
const collection = { id: "week-existing-pm", title: "Projektmanagement", description: "Eine bereits vorbereitete Lernwoche.", noteIds: notes.map(note => note.id), cardIds: [], questionIds: questions.map(question => question.id), pathIds: [] };
const legacyWeek = { startedOn, collectionId: collection.id, subject, checkpointQuestionIds: questions.slice(0, 3).map(question => question.id) };
const baseline = { id: "week-existing-baseline", collectionId: collection.id, subject, mode: "exam", startedAt: timestamp, finishedAt: timestamp, deadlineAt: null, tutorWeekCheckpoint: { startedOn, stage: "baseline" }, questions: structuredClone(questions.slice(0, 3)), answers: questions.slice(0, 3).map(question => ({ questionId: question.id, selectedOptionIds: ["yes"], answeredAt: timestamp, reflection: "" })) };
const legacyPlan = { goal: "Projektmanagement in einer Woche vorbereiten und sicher anwenden.", targetDate: null, weeklyDays: 7, updatedAt: timestamp };
const fixture = { schemaVersion: 1, topics: [], notes, cards, quizQuestions: questions, paths: [], completedStepIds: [], quizRuns: [baseline], learningReminders: [], learningCollections: [collection], learningFocus: { collectionId: collection.id, subject, updatedAt: timestamp }, tutorWeek: legacyWeek, tutorPlan: legacyPlan };

try {
  await reloadTutor();
  const current = await snapshot();
  await verifyLocal(current);
  initial = current.workspace;

  console.log("Checking an imported legacy week, goal and checkpoint remain intact on the guided surface");
  await write(structuredClone(fixture));
  await reloadTutor();
  await expect(tutor().getByRole("heading", { name: collection.title, exact: true })).toBeVisible();
  await expect(primary()).toHaveText("Mit 5 Karten starten");
  await expect(tutor().locator(".tutor-guided-route li")).toHaveCount(3);
  await expect(tutor().getByRole("tab")).toHaveCount(0);
  await expect(tutor().locator(".tutor-intensive-week")).toHaveCount(0);
  await expect(tutor().locator("select:visible, textarea:visible")).toHaveCount(0);
  await expect(tutor().locator(".tutor-guided-intro h3")).toHaveText(concepts[1]);
  let data = (await snapshot()).workspace;
  assert.deepEqual(data.tutorWeek, legacyWeek);
  assert.deepEqual(data.tutorPlan, legacyPlan);
  assert.deepEqual(data.quizRuns.find(run => run.id === baseline.id), baseline);
  await tutor().getByRole("button", { name: /^Ergebnisse und Verlauf/ }).click();
  await expect(tutor().locator(".tutor-result")).toContainText("3 von 3 richtig");
  await tutor().getByRole("button", { name: /^Ergebnisse und Verlauf/ }).click();

  console.log("Checking saved weekly topic order is used until a new shared plan provides its own order");
  const orderedWeek = { ...legacyWeek, topicOrder: [concepts[2], concepts[1], concepts[0]] };
  await write({ ...structuredClone(fixture), tutorWeek: orderedWeek });
  await reloadTutor();
  await expect(tutor().locator(".tutor-guided-intro h3")).toHaveText(concepts[2]);
  await tutor().getByRole("button", { name: /^Lernplan und Fokus/ }).click();
  await expect(tutor().getByLabel("Dein Lernziel", { exact: true })).toHaveValue(legacyPlan.goal);
  await expect(tutor().getByLabel("Lerntage pro Woche", { exact: true })).toHaveValue("7");
  const orderField = tutor().getByLabel("Themenreihenfolge", { exact: true });
  const beforeInvalid = await snapshot();
  await orderField.fill("Ein unbekannter Lernbereich");
  await tutor().getByRole("button", { name: "Lernplan speichern", exact: true }).click();
  await expect(tutor().getByRole("alert")).toContainText("fehlen im aktuellen Lernfokus");
  assert.deepEqual(await snapshot(), beforeInvalid, "An invalid order cannot silently save a plan the Tutor cannot execute.");
  const plannedOrder = [concepts[1], concepts[2]];
  await orderField.fill(plannedOrder.join("\n"));
  await tutor().getByLabel("Vereinbarter Lernablauf", { exact: true }).fill("Zuerst den Projektstart klären, danach die Planung anwenden.");
  const planned = await uiSave(() => tutor().getByRole("button", { name: "Lernplan speichern", exact: true }).click(), workspace => workspace.tutorPlan?.conceptOrder?.[0] === concepts[1]);
  assert.deepEqual(planned.tutorWeek, orderedWeek);
  assert.deepEqual(planned.tutorPlan.conceptOrder, plannedOrder);
  assert.equal(planned.tutorPlan.goal, legacyPlan.goal);
  assert.equal(planned.tutorPlan.weeklyDays, 7);
  await reloadTutor();
  await expect(tutor().locator(".tutor-guided-intro h3")).toHaveText(concepts[1]);

  console.log("Checking the first guided unit respects that plan without rewriting its legacy history");
  data = await uiSave(() => primary().click(), workspace => !!workspace.tutorSession && !!workspace.flashcardSession);
  const session = structuredClone(data.tutorSession);
  assert.equal(session.collectionId, collection.id);
  assert.equal(session.subject, subject);
  assert.equal(session.concept, concepts[1]);
  assert.equal(session.cardIds.length, 5);
  assert.equal(session.questionIds.length, 3);
  assert.ok(session.cardIds.every(id => cards.find(card => card.id === id)?.noteId === notes[1].id));
  assert.ok(session.questionIds.every(id => questions.find(question => question.id === id)?.concept === concepts[1]));
  assert.deepEqual(data.tutorWeek, orderedWeek);
  assert.deepEqual(data.tutorPlan, planned.tutorPlan);
  assert.deepEqual(data.quizRuns.find(run => run.id === baseline.id), baseline);
  await reloadTutor();
  await expect(primary()).toHaveText("Kartenrunde fortsetzen");
  assert.deepEqual((await snapshot()).workspace.tutorSession, session);
  assert.deepEqual((await snapshot()).workspace.tutorWeek, orderedWeek);
  assert.deepEqual(errors, [], "The legacy-plan transition has no client errors.");
  console.log("Tutor week compatibility browser tests passed.");
} finally {
  await page.goto("about:blank");
  if (initial) await write(initial);
  await browser.close();
}
