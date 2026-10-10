import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite";

const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Learning flow tests may only mutate localhost.");
const api = origin + "/api/brain";
const sqlitePath = resolve(process.env.BRAIN_TEST_SQLITE_PATH ?? process.env.NEWHOPE_SQLITE_PATH ?? ".data/newhope.sqlite");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(20000);
page.setDefaultNavigationTimeout(90000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("dialog", dialog => dialog.accept());
let initial;
let activeGate;
const hub = () => page.getByRole("region", { name: "Dein Lernüberblick", exact: true });
const button = (name, scope = page) => scope.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
async function click(name, scope = page) { await expect(button(name, scope)).toBeEnabled(); await button(name, scope).click(); }
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
    assert.equal(row?.revision, current.revision, "The running API must use the explicitly selected local SQLite database.");
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
  return response.json();
}
async function reload() {
  const response = await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  await expect(hub()).toBeVisible();
}
async function settled(predicate) {
  await expect.poll(async () => predicate(await snapshot())).toBe(true);
  await expect(page.locator(".save-state")).toHaveText("Gespeichert");
  const current = await snapshot();
  await verifyLocal(current);
  return current;
}

const now = new Date(Date.now() - 60000).toISOString();
const subject = "Agiles Projektmanagement";
const concepts = ["Sprint-Ziel", "Inkrement und Feedback"];
const notes = concepts.map((concept, index) => ({ id: `flow-note-${index}`, title: concept, summary: "Ein Zusammenhang für die praktische Teamarbeit.", content: `## ${concept}\n\nEin Team klärt sein Ziel und prüft seine Ergebnisse anhand von Feedback.`, topicId: null, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: now, updatedAt: now }));
const questions = concepts.flatMap((concept, index) => [1, 2].map(difficulty => {
  const id = `flow-question-${index}-${difficulty}`;
  return { id, subject, concept, difficulty, noteIds: [notes[index].id], prompt: `${concept}, Aufgabe ${difficulty}: Welche Aussage passt?`, options: [{ id: id + "-yes", text: `Richtig ${index}-${difficulty}: Ziele und Feedback gemeinsam klären.`, feedback: "" }, { id: id + "-no", text: `Falsch ${index}-${difficulty}: Rückmeldungen vollständig ignorieren.`, feedback: "Das Team benötigt ein gemeinsames Ziel und prüfbare Ergebnisse." }], correctOptionIds: [id + "-yes"], explanation: "Ein gemeinsames Ziel richtet die Zusammenarbeit aus. Feedback prüft, ob das Ergebnis zum Ziel passt.", source: "" };
}));
const outsideQuestion = { ...structuredClone(questions[0]), id: "flow-outside-question", concept: "Außerhalb der Lernsammlung" };
const collection = { id: "flow-agile", title: "Vorbereitung agiles Projektmanagement", description: "Ziele klären und Ergebnisse prüfen.", noteIds: notes.map(note => note.id), cardIds: [], questionIds: questions.map(question => question.id), pathIds: [] };
const unrelated = { id: "flow-other", title: "Getrennte Vorbereitung", description: "Ein anderer Lernumfang.", noteIds: [], cardIds: [], questionIds: [outsideQuestion.id], pathIds: [] };
const failedRun = { id: "flow-failed-round", subject, mode: "practice", preparationConcept: concepts[0], collectionId: collection.id, startedAt: now, deadlineAt: null, finishedAt: now, questions: questions.slice(0, 2), answers: questions.slice(0, 2).map(question => ({ questionId: question.id, selectedOptionIds: [question.options[1].id], answeredAt: now, reflection: "" })) };
const fixture = { schemaVersion: 1, topics: [], notes, paths: [], completedStepIds: [], cards: [], quizQuestions: [...questions, outsideQuestion], quizRuns: [failedRun], learningReminders: [], learningCollections: [collection, unrelated], learningFocus: { collectionId: collection.id, subject, updatedAt: now } };
function activeFixture(id) {
  return { ...structuredClone(fixture), quizRuns: [{ ...structuredClone(failedRun), id, finishedAt: null, answers: [] }] };
}
async function resume(id) {
  await write(activeFixture(id));
  await reload();
  await click("Einheit fortsetzen", hub());
  await expect(page.locator(".quiz-question")).toBeVisible();
  return (await snapshot()).workspace.quizRuns.find(run => run.id === id);
}
async function answer(question) {
  await page.getByRole("checkbox", { name: question.options.find(option => question.correctOptionIds.includes(option.id)).text, exact: true }).check();
  await click("Bestätigen");
  await expect(page.locator(".quiz-verdict")).toHaveText("Richtig beantwortet", { timeout: 1000 });
}

// A controlled gate proves the next interaction is independent of the network.
// It stays shut until two answers are visible, and never releases before 1.2s.
async function gateFirstWrite(status = 200, failFollowUpAt = null) {
  const writes = [];
  let release;
  let firstSeen;
  let firstFinished;
  const held = new Promise(resolve => { release = resolve; });
  const received = new Promise(resolve => { firstSeen = resolve; });
  const finished = new Promise(resolve => { firstFinished = resolve; });
  await page.route(api, async route => {
    if (route.request().method() !== "PUT") { await route.continue(); return; }
    writes.push({ body: route.request().postDataJSON(), prefer: route.request().headers().prefer });
    if (writes.length !== 1) {
      if (writes.length === failFollowUpAt) await route.fulfill({ status: 503, json: { error: "Lokaler Test: Eine Antwort muss erneut gespeichert werden." } });
      else await route.continue();
      return;
    }
    const started = Date.now();
    firstSeen();
    await held;
    await pause(Math.max(0, 1200 - (Date.now() - started)));
    try {
      if (status === 200) await route.continue();
      else await route.fulfill({ status, json: { error: "Lokaler Test: Antworten konnten nicht gespeichert werden." } });
    } finally { firstFinished(); }
  });
  const gate = { writes, received, release, finished };
  activeGate = gate;
  return gate;
}
async function stopGate(gate) {
  gate.release();
  if (gate.writes.length) await gate.finished;
  await page.unroute(api);
  if (activeGate === gate) activeGate = undefined;
}
async function queueTwoAnswers(run, gate) {
  await answer(run.questions[0]);
  await gate.received;
  assert.equal(gate.writes.length, 1);
  await expect(button("Nächste Aufgabe")).toBeEnabled({ timeout: 1000 });
  await click("Nächste Aufgabe");
  await expect(page.locator(".quiz-question")).toContainText(run.questions[1].prompt);
  await answer(run.questions[1]);
  await expect(button("Runde abschließen")).toBeEnabled({ timeout: 1000 });
  assert.equal(gate.writes.length, 1, "The second answer waits in the queue, while the UI is already ready to continue.");
}
async function pendingNavigationStaysInQuiz() {
  await click("Mein Überblick");
  await expect(page.locator(".quiz-session")).toBeVisible();
  await expect(page.locator(".quiz-verdict")).toHaveText("Richtig beantwortet");
  await expect(hub()).toHaveCount(0);
  await page.keyboard.press("Control+k");
  await expect(page.locator(".quiz-session")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Wissen durchsuchen", exact: true })).toHaveCount(0);
  await expect(button("Import & Datensicherung")).toBeDisabled();
}

try {
  await reload();
  initial = (await snapshot()).workspace;
  await verifyLocal(await snapshot());
  await mkdir(".sites-runtime/qa", { recursive: true });

  console.log("Checking the result recommends one direct follow-up in the same collection");
  await write(fixture);
  await reload();
  await click("Auswertung ansehen", hub());
  const summary = page.locator(".quiz-result-summary");
  const next = summary.locator(".quiz-result-next");
  await expect(summary).toContainText("0 von 2 richtig");
  await expect(next.getByRole("button")).toHaveCount(1);
  await expect(button("Unsicheren Bereich festigen", next)).toBeVisible();
  await expect(next.locator("p").first()).toContainText(concepts[0]);
  await expect(next.locator("p").first()).toContainText(/falsch|unsicher|Fehler|nicht/);
  await expect(summary.getByRole("button")).toHaveCount(1);
  await page.screenshot({ path: ".sites-runtime/qa/learning-flow-result-desktop.png", fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await summary.evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    assert.deepEqual(await summary.evaluate(element => [...element.querySelectorAll(".quiz-result-next, button")].filter(child => child.scrollWidth > child.clientWidth + 1).map(child => child.className)), [], `Result and action fit ${width}px`);
    const bounds = await button("Unsicheren Bereich festigen", next).boundingBox();
    assert.ok(bounds && bounds.height >= 44 && bounds.y + bounds.height <= 844, `The follow-up is immediately reachable at ${width}px without scrolling past the result.`);
    await page.screenshot({ path: `.sites-runtime/qa/learning-flow-result-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const beforeLaunch = await snapshot();
  await click("Unsicheren Bereich festigen", next);
  let stored = await settled(current => current.revision === beforeLaunch.revision + 1 && current.workspace.quizRuns.length === 2);
  let run = stored.workspace.quizRuns[1];
  assert.equal(run.collectionId, collection.id);
  assert.equal(run.preparationConcept, concepts[0]);
  assert.ok(run.questions.every(question => question.concept === concepts[0] && collection.questionIds.includes(question.id)));
  await expect(page.locator(".quiz-question")).toContainText(run.questions[0].prompt);
  for (let index = 0; index < run.questions.length; index++) {
    await answer(run.questions[index]);
    await settled(current => current.workspace.quizRuns.find(item => item.id === run.id).answers.length === index + 1);
    if (index < run.questions.length - 1) await click("Nächste Aufgabe");
  }
  await click("Runde abschließen");
  await settled(current => !!current.workspace.quizRuns.find(item => item.id === run.id).finishedAt);
  await expect(summary).toContainText("2 von 2 richtig");
  await expect(next.getByRole("button")).toHaveCount(1);
  await expect(button("Nächsten Lernbereich starten", next)).toBeVisible();
  await expect(next.locator("p").first()).toContainText(concepts[1]);
  await click("Nächsten Lernbereich starten", next);
  stored = await settled(current => current.workspace.quizRuns.length === 3);
  assert.equal(stored.workspace.quizRuns[2].collectionId, collection.id);
  assert.equal(stored.workspace.quizRuns[2].preparationConcept, concepts[1]);
  assert.ok(stored.workspace.quizRuns[2].questions.every(question => collection.questionIds.includes(question.id)));

  console.log("Checking two answers can be given while the first save is held for at least 1.2 seconds");
  run = await resume("flow-delayed-save");
  const beforeDelay = await snapshot();
  const delayed = await gateFirstWrite();
  await queueTwoAnswers(run, delayed);
  await pendingNavigationStaysInQuiz();
  assert.equal((await snapshot()).revision, beforeDelay.revision, "Held saves have not committed either answer.");
  await click("Runde abschließen");
  await expect(button("Runde wird abgeschlossen …")).toBeDisabled();
  await expect(summary).toHaveCount(0);
  assert.equal((await snapshot()).workspace.quizRuns[0].finishedAt, null, "Finishing waits for the answer queue before storing the result.");
  delayed.release();
  stored = await settled(current => current.revision === beforeDelay.revision + 3 && current.workspace.quizRuns[0].answers.length === 2 && !!current.workspace.quizRuns[0].finishedAt);
  assert.deepEqual(delayed.writes.map(write => write.body.revision), [beforeDelay.revision, beforeDelay.revision + 1, beforeDelay.revision + 2]);
  assert.deepEqual(delayed.writes.map(write => write.body.workspace.quizRuns[0].answers.length), [1, 2, 2]);
  assert.deepEqual(delayed.writes.map(write => !!write.body.workspace.quizRuns[0].finishedAt), [false, false, true]);
  assert.ok(delayed.writes.every(write => write.prefer === "return=minimal"), "Interactive saves request a compact response.");
  assert.deepEqual(stored.workspace.quizRuns[0].answers.map(answer => answer.questionId), run.questions.map(question => question.id));
  await expect(summary).toContainText("2 von 2 richtig");
  await stopGate(delayed);
  await reload();
  await click("Auswertung ansehen", hub());
  await expect(summary).toContainText("2 von 2 richtig");

  console.log("Checking a failed save stops the queue and partial retries preserve both answers");
  run = await resume("flow-retry-save");
  const beforeFailure = await snapshot();
  const failed = await gateFirstWrite(503, 3);
  await queueTwoAnswers(run, failed);
  failed.release();
  await expect(page.locator(".quiz-save-notice[role='alert']").getByRole("button", { name: "Antworten erneut speichern", exact: true })).toBeVisible();
  await expect(page.locator(".quiz-verdict")).toHaveText("Richtig beantwortet");
  await pendingNavigationStaysInQuiz();
  await pause(400);
  assert.equal(failed.writes.length, 1, "No queued save runs after an earlier failure.");
  assert.equal((await snapshot()).revision, beforeFailure.revision);
  await click("Antworten erneut speichern");
  await expect.poll(async () => {
    const current = await snapshot();
    return current.revision === beforeFailure.revision + 1 && current.workspace.quizRuns[0].answers.length === 1;
  }).toBe(true);
  await expect.poll(() => failed.writes.length).toBe(3);
  await expect(button("Antworten erneut speichern")).toBeVisible();
  await expect(page.locator(".quiz-verdict")).toHaveText("Richtig beantwortet");
  await click("Antworten erneut speichern");
  stored = await settled(current => current.revision === beforeFailure.revision + 2 && current.workspace.quizRuns[0].answers.length === 2);
  assert.deepEqual(failed.writes.map(write => write.body.revision), [beforeFailure.revision, beforeFailure.revision, beforeFailure.revision + 1, beforeFailure.revision + 1]);
  assert.deepEqual(failed.writes.map(write => write.body.workspace.quizRuns[0].answers.length), [1, 1, 2, 2]);
  assert.equal(failed.writes[3].body.workspace.quizRuns[0].answers[0].answeredAt, stored.workspace.quizRuns[0].answers[0].answeredAt, "A confirmed first answer is retained during retry of the remaining answer.");
  assert.deepEqual(stored.workspace.quizRuns[0].answers.map(answer => answer.questionId), run.questions.map(question => question.id));
  await expect(button("Antworten erneut speichern")).toHaveCount(0);
  await stopGate(failed);

  console.log("Checking a revision conflict preserves a parallel change and never retries over it");
  run = await resume("flow-conflicting-save");
  const beforeConflict = await snapshot();
  const conflictingWrites = [];
  await page.route(api, async route => {
    if (route.request().method() !== "PUT") { await route.continue(); return; }
    conflictingWrites.push(route.request().postDataJSON());
    if (conflictingWrites.length === 1) {
      const changed = structuredClone(beforeConflict.workspace);
      changed.notes[0].summary = "Eine parallel gespeicherte Änderung muss erhalten bleiben.";
      await write(changed);
    }
    await route.continue();
  });
  await answer(run.questions[0]);
  await expect(page.locator(".error-banner")).toBeVisible();
  await pause(400);
  assert.equal(conflictingWrites.length, 1);
  const parallel = await snapshot();
  assert.equal(parallel.revision, beforeConflict.revision + 1);
  assert.equal(parallel.workspace.notes[0].summary, "Eine parallel gespeicherte Änderung muss erhalten bleiben.");
  assert.equal(parallel.workspace.quizRuns[0].answers.length, 0, "The stale answer did not overwrite the newer workspace.");
  await click("Antworten erneut speichern");
  await pause(200);
  assert.equal(conflictingWrites.length, 1, "An explicit answer retry cannot write through an unresolved revision conflict.");
  assert.equal((await snapshot()).revision, parallel.revision);
  await click("Aktuellen Stand laden");
  await expect(page.locator(".error-banner")).toHaveCount(0);
  await expect(page.locator(".save-state")).toHaveText("Antworten offen");
  await expect(page.locator(".quiz-verdict")).toHaveText("Richtig beantwortet");
  await expect(button("Antworten erneut speichern")).toBeVisible();
  await expect.poll(async () => (await snapshot()).revision).toBe(parallel.revision);
  assert.equal((await snapshot()).workspace.notes[0].summary, parallel.workspace.notes[0].summary);
  await click("Antworten erneut speichern");
  stored = await settled(current => current.revision === parallel.revision + 1 && current.workspace.quizRuns[0].answers.length === 1);
  assert.equal(stored.workspace.notes[0].summary, parallel.workspace.notes[0].summary, "Explicit retry after loading merges the answer into the new snapshot.");
  assert.equal(stored.workspace.quizRuns[0].answers[0].questionId, run.questions[0].id);
  assert.deepEqual(conflictingWrites.map(write => write.revision), [beforeConflict.revision, parallel.revision]);
  await expect(button("Antworten erneut speichern")).toHaveCount(0);
  await page.unroute(api);

  console.log("Checking a round finished elsewhere retains local feedback until explicit discard");
  run = await resume("flow-finished-elsewhere");
  const heldFinished = await gateFirstWrite(503);
  await answer(run.questions[0]);
  await heldFinished.received;
  heldFinished.release();
  await expect(button("Antworten erneut speichern")).toBeVisible();
  await stopGate(heldFinished);
  const externallyFinished = (await snapshot()).workspace;
  externallyFinished.quizRuns[0].finishedAt = new Date().toISOString();
  const savedFinished = await write(externallyFinished);
  let writesAfterFinish = 0;
  await page.route(api, async route => {
    if (route.request().method() === "PUT") writesAfterFinish++;
    await route.continue();
  });
  await click("Aktuellen Stand laden");
  await expect(page.locator(".error-banner")).toHaveCount(0);
  await expect(page.locator(".save-state")).toHaveText("Antworten offen");
  await expect(page.locator(".quiz-session")).toBeVisible();
  await expect(page.locator(".quiz-verdict")).toHaveText("Richtig beantwortet");
  await expect(button("Antworten erneut speichern")).toBeVisible();
  await expect(summary).toHaveCount(0);
  await click("Antworten erneut speichern");
  await expect(page.locator(".error-banner")).toContainText("bereits beendet");
  await expect(page.locator(".quiz-verdict")).toHaveText("Richtig beantwortet");
  await expect(button("Offene Antworten verwerfen")).toBeVisible();
  assert.equal(writesAfterFinish, 0, "Retry refuses to write an answer into a round already finished elsewhere.");
  assert.deepEqual(await snapshot(), savedFinished, "The finished round retains its independently stored result.");
  const confirmedDiscard = page.waitForEvent("dialog");
  await click("Offene Antworten verwerfen");
  const discardDialog = await confirmedDiscard;
  assert.equal(discardDialog.type(), "confirm");
  assert.match(discardDialog.message(), /noch nicht gespeicherten Antworten.*verwerfen/);
  await expect(page.locator(".quiz-session")).toHaveCount(0);
  await expect(page.locator(".quiz-save-notice")).toHaveCount(0);
  await expect(summary).toContainText("0 von 2 richtig");
  await expect(button("Import & Datensicherung")).toBeEnabled();
  assert.equal(writesAfterFinish, 0, "Discarding local answers does not alter the saved result.");
  assert.deepEqual(await snapshot(), savedFinished);
  await page.unroute(api);
  assert.deepEqual(errors, [], "No client runtime errors.");
  console.log("Learning flow browser tests passed.");
} finally {
  if (activeGate) await stopGate(activeGate);
  await page.unroute(api);
  await page.goto("about:blank");
  if (initial) await write(initial);
  await browser.close();
}
