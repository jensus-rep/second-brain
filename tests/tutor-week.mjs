import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readdir, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";

const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Week browser tests may only mutate localhost.");
const api = origin + "/api/brain";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Berlin" });
page.setDefaultTimeout(20000);
page.setDefaultNavigationTimeout(90000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let sqlitePath, initial;
const tutor = () => page.locator(".learning-tutor");
const week = () => page.getByRole("region", { name: "Dein 7-Tage-Plan", exact: true });
async function snapshot() {
  const response = await page.request.get(api);
  assert.equal(response.status(), 200);
  return response.json();
}
function localRow(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try { return db.prepare("SELECT body, revision FROM newhope_workspaces WHERE owner_id = ?").get("local_dev"); }
  finally { db.close(); }
}
function matches(row, current) {
  if (!row || row.revision !== current.revision) return false;
  const stored = JSON.parse(row.body);
  for (const key of ["cards", "quizQuestions", "quizRuns", "learningReminders", "learningCollections"]) stored[key] ??= [];
  return isDeepStrictEqual(stored, current.workspace);
}
async function identifyLocal(current) {
  const selected = process.env.BRAIN_TEST_SQLITE_PATH ?? process.env.NEWHOPE_SQLITE_PATH;
  const paths = selected ? [resolve(selected)] : (await readdir(".data")).filter(name => name.endsWith(".sqlite")).map(name => resolve(".data", name));
  const candidates = paths.filter(path => { try { return matches(localRow(path), current); } catch { return false; } });
  assert.equal(candidates.length, 1, "Identify exactly one local SQLite workspace before any data mutation; otherwise set BRAIN_TEST_SQLITE_PATH.");
  sqlitePath = await realpath(candidates[0]);
  console.log("Verified local SQLite store: " + sqlitePath.split(/[\\/]/).at(-1));
}
async function verifyLocal(current) { assert.ok(matches(localRow(sqlitePath), current), "The running API must match the verified local SQLite file."); }
async function write(workspace) {
  const current = await snapshot();
  await verifyLocal(current);
  const response = await page.request.put(api, { data: { workspace, revision: current.revision } });
  assert.equal(response.status(), 200, await response.text());
  await verifyLocal(await snapshot());
}
async function reload() {
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Tutor", exact: true }).filter({ visible: true }).first().click();
  await expect(tutor()).toBeVisible();
}
async function uiSave(action, predicate) {
  const before = await snapshot();
  await verifyLocal(before);
  const responsePromise = page.waitForResponse(response => response.url() === api && response.request().method() === "PUT");
  await action();
  const response = await responsePromise;
  assert.equal(response.request().postDataJSON().revision, before.revision);
  assert.equal(response.status(), 200, await response.text());
  await expect.poll(async () => predicate((await snapshot()).workspace)).toBe(true);
  await expect(page.locator(".save-state")).toHaveText("Gespeichert");
  await verifyLocal(await snapshot());
  return (await snapshot()).workspace;
}
async function completeTest(run, wrongFirst = false) {
  for (let index = 0; index < run.questions.length; index++) {
    const question = run.questions[index];
    await expect(page.locator(".quiz-question")).toContainText(question.prompt);
    const option = wrongFirst && index === 0 ? question.options[1] : question.options[0];
    await page.getByRole("checkbox", { name: option.text, exact: true }).check();
    await uiSave(() => page.getByRole("button", { name: "Antwort speichern", exact: true }).click(), data => data.quizRuns.find(item => item.id === run.id)?.answers.length === index + 1);
    await expect(page.locator(".quiz-verdict, .quiz-option-review")).toHaveCount(0);
  }
  await uiSave(() => page.getByRole("button", { name: "Test abgeben", exact: true }).click(), data => !!data.quizRuns.find(item => item.id === run.id)?.finishedAt);
  await expect(page.locator(".quiz-result-summary")).toBeVisible();
}
const timestamp = new Date().toISOString();
const subject = "Agiles Projektmanagement";
const concepts = ["Projekt und Projektmanagement: Grundlagen", "Projektstart und Stakeholder", "Klassische Planung und Projektorganisation", "Risiko und Controlling", "Agilität und agiles Manifest", "Produktvision und Design Thinking", "Impact Mapping, Story Mapping und MVP", "Artefakte, Done und Ready", "Scrum-Rollen und -Events", "Schätzen, Velocity und Releaseplanung", "Lean Startup und Kanban", "Klassisch, agil oder hybrid", "Umfeld, Führung und Management", "Menschen und Teams", "Agile Haltung, Skalierung und Datenprojekte", "Agile Veranstaltungsformate"];
const notes = concepts.map((concept, index) => ({ id: `week-n${index}`, title: concept, summary: "Ein übertragbares Beispiel.", content: "Eine Erklärung mit Praxisbeispiel.", topicId: null, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: timestamp, updatedAt: timestamp }));
const cards = notes.flatMap(note => Array.from({ length: 8 }, (_, index) => ({ id: `week-c-${note.id}-${index}`, question: `${note.title}: Kartenfrage ${index}`, answer: "Ein gemeinsames Ziel erklärt die Entscheidung.", noteId: note.id, dueAt: "2000-01-01T00:00:00Z", intervalDays: 0, reviews: 0 })));
const questions = notes.flatMap((note, index) => [1, 2].map(difficulty => ({ id: `week-q${index}-${difficulty}`, subject, concept: note.title, noteIds: [note.id], difficulty, prompt: `${note.title}: Aufgabe ${difficulty}`, options: [{ id: "yes", text: "Ziel und Nutzen gemeinsam klären", feedback: "Richtig." }, { id: "no", text: "Rückmeldungen ignorieren", feedback: "Feedback ist nötig." }], correctOptionIds: ["yes"], explanation: "Ziel und Nutzen richten das Handeln aus.", source: "" })));
const collection = { id: "week-pm", title: "Projektmanagement", description: "Vorbereitung für eine Woche.", noteIds: notes.map(note => note.id), cardIds: [], questionIds: questions.map(question => question.id), pathIds: [] };
const fixture = { schemaVersion: 1, topics: [], notes, cards, quizQuestions: questions, paths: [], completedStepIds: [], quizRuns: [], learningReminders: [], learningCollections: [collection], learningFocus: { collectionId: collection.id, subject, updatedAt: timestamp } };

try {
  await reload();
  const current = await snapshot();
  await identifyLocal(current);
  initial = current.workspace;
  await write(fixture);
  await reload();
  console.log("Checking failed saves do not fabricate a week and a saved plan survives reload");
  await page.route(api, async route => route.request().method() === "PUT" ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Lokaler Testfehler" }) }) : route.continue());
  await page.getByRole("button", { name: "7-Tage-Plan starten", exact: true }).click();
  await expect(tutor()).toContainText("Die Lernwoche konnte nicht gespeichert werden.");
  assert.equal((await snapshot()).workspace.tutorWeek, undefined);
  await page.unroute(api);
  await reload();
  await uiSave(() => page.getByRole("button", { name: "7-Tage-Plan starten", exact: true }).click(), data => !!data.tutorWeek);
  assert.equal((await snapshot()).workspace.tutorPlan.weeklyDays, 7);
  await reload();
  await expect(week()).toBeVisible();
  await expect(week().locator(".tutor-week-topic")).toHaveCount(3);
  await week().getByRole("button", { name: /Tag 6/ }).click();
  await expect(week().locator(".tutor-week-topic")).toHaveCount(3);
  await expect(week().locator(".tutor-week-topic").first()).toContainText(concepts[15]);
  await week().getByRole("button", { name: /Tag 1/ }).click();

  console.log("Checking baseline, written card recall and short scoped rounds");
  let data = await uiSave(() => week().getByRole("button", { name: "Einstiegstest starten", exact: true }).click(), data => data.quizRuns.some(run => !run.finishedAt));
  const baseline = data.quizRuns.find(run => !run.finishedAt);
  assert.equal(baseline.tutorWeekCheckpoint.stage, "baseline");
  await completeTest(baseline, true);
  await reload();
  await expect(week()).toContainText("83 % richtig");
  data = await uiSave(() => week().locator(".tutor-week-topic").first().getByRole("button", { name: "5 Karten einzeln üben", exact: true }).click(), data => !!data.flashcardSession);
  assert.equal(data.flashcardSession.queue.length, 5);
  assert.ok(data.flashcardSession.queue.every(entry => cards.find(card => card.id === entry.id)?.noteId === notes[0].id));
  const recall = "Mein Praxisbeispiel: Ein gemeinsames Ziel hilft bei einer Lieferentscheidung.";
  for (let index = 0; index < 5; index++) {
    await page.getByLabel("Deine Antwort in eigenen Worten", { exact: true }).fill(index === 0 ? recall : "");
    await page.getByRole("button", { name: "Antwort aufdecken", exact: true }).click();
    await uiSave(() => page.getByRole("group", { name: "Bewertung der Lernkarte", exact: true }).getByRole("button", { name: /^Gewusst/ }).click(), data => data.cardReviewEvents?.length === index + 1);
  }
  data = (await snapshot()).workspace;
  assert.equal(data.cardReviewEvents[0].response, recall);
  assert.equal(data.flashcardSession, null);
  await expect(page.locator(".study-finished")).toContainText("5 Karten");
  await expect(page.getByRole("region", { name: "Lernimpuls", exact: true })).toBeVisible();
  await page.locator(".study-finished").getByRole("button", { name: "Zum Tutor", exact: true }).click();

  console.log("Checking weekly topic answers survive compaction and final tests compare identical tasks");
  data = await uiSave(() => week().locator(".tutor-week-topic").first().getByRole("button", { name: "Wissen anwenden", exact: true }).click(), data => data.quizRuns.some(run => !run.finishedAt));
  const topicRun = data.quizRuns.find(run => !run.finishedAt);
  assert.equal(topicRun.tutorWeekStartedOn, data.tutorWeek.startedOn);
  for (let index = 0; index < topicRun.questions.length; index++) {
    const question = topicRun.questions[index];
    await expect(page.locator(".quiz-question")).toContainText(question.prompt);
    await page.getByRole("checkbox", { name: question.options[0].text, exact: true }).check();
    await uiSave(() => page.getByRole("button", { name: "Bestätigen", exact: true }).click(), data => data.quizRuns.find(run => run.id === topicRun.id)?.answers.length === index + 1);
    if (index + 1 < topicRun.questions.length) await page.getByRole("button", { name: "Nächste Aufgabe", exact: true }).click();
    else await uiSave(() => page.getByRole("button", { name: "Runde abschließen", exact: true }).click(), data => !!data.quizRuns.find(run => run.id === topicRun.id)?.finishedAt);
  }
  await reload();
  await expect(week().locator(".tutor-week-topic").first()).toContainText("2/2 Aufgaben beantwortet · 2 zuletzt richtig");
  data = await uiSave(() => week().getByRole("button", { name: "Zwischentest starten", exact: true }).click(), data => data.quizRuns.some(run => !run.finishedAt));
  const midpoint = data.quizRuns.find(run => !run.finishedAt);
  assert.equal(midpoint.tutorWeekCheckpoint.stage, "midpoint");
  await completeTest(midpoint);
  await reload();
  // Exercise the actual API compaction with more than five later units.
  data = structuredClone((await snapshot()).workspace);
  data.quizRuns.push(...Array.from({ length: 6 }, (_, index) => ({ ...structuredClone(topicRun), id: `week-extra-${index}`, tutorWeekStartedOn: undefined, startedAt: new Date(Date.now() + index).toISOString(), finishedAt: new Date().toISOString(), answers: topicRun.questions.map(question => ({ questionId: question.id, selectedOptionIds: ["yes"], answeredAt: timestamp, reflection: "" })) })));
  await write(data);
  await reload();
  assert.equal((await snapshot()).workspace.quizRuns.find(run => run.id === baseline.id).questions[0].prompt, baseline.questions[0].prompt);
  data = await uiSave(() => week().getByRole("button", { name: "Abschlusstest starten", exact: true }).click(), data => data.quizRuns.some(run => !run.finishedAt));
  const finalRun = data.quizRuns.find(run => !run.finishedAt);
  assert.deepEqual(finalRun.questions.map(question => question.id), baseline.questions.map(question => question.id));
  await completeTest(finalRun);
  await reload();
  await expect(week()).toContainText("Einstieg 83 % → Abschluss 100 % (+17 Prozentpunkte)");

  console.log("Checking the plan fits desktop and mobile, including 320px");
  await mkdir(".sites-runtime/qa", { recursive: true });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const overflows = await week().evaluate(element => [...element.querySelectorAll("article, button, ol, p")].filter(child => child.scrollWidth > child.clientWidth + 1).map(child => child.className));
    assert.deepEqual(overflows, []);
    await page.screenshot({ path: `.sites-runtime/qa/tutor-week-${width}.png`, fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log("Tutor week browser tests passed.");
} finally {
  await page.unroute(api);
  await page.goto("about:blank");
  if (initial) await write(initial);
  await browser.close();
}
