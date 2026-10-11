import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

// Every mutation needs loopback and proof of the exact local SQLite store.
const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Tutor browser tests may only mutate localhost.");
const api = origin + "/api/brain";
const sqlitePath = resolve(process.env.BRAIN_TEST_SQLITE_PATH ?? process.env.NEWHOPE_SQLITE_PATH ?? ".data/newhope.sqlite");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Berlin" });
page.setDefaultTimeout(20000);
page.setDefaultNavigationTimeout(90000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await page.addInitScript(() => {
  window.__tutorTools = {};
  Object.defineProperty(document, "modelContext", { configurable: true, value: {
    registerTool(tool, { signal }) {
      window.__tutorTools[tool.name] = tool;
      signal.addEventListener("abort", () => {
        if (window.__tutorTools[tool.name] === tool) delete window.__tutorTools[tool.name];
      }, { once: true });
    },
  } });
});
const tutor = () => page.locator(".learning-tutor");
const primary = () => tutor().locator(".tutor-primary-action");
const button = (name, scope = page) => scope.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
let initial;
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
    assert.equal(row?.revision, current.revision, "The API must use the selected local SQLite file.");
    const stored = JSON.parse(row.body);
    for (const key of ["cards", "quizQuestions", "quizRuns", "learningReminders", "learningCollections"]) stored[key] ??= [];
    assert.deepEqual(stored, current.workspace);
  } finally { db.close(); }
}
async function write(workspace) {
  const before = await snapshot();
  await verifyLocal(before);
  const response = await page.request.put(api, { data: { workspace, revision: before.revision } });
  assert.equal(response.status(), 200, await response.text());
  const after = await snapshot();
  await verifyLocal(after);
  return after;
}
async function reloadTutor() {
  const response = await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  await click("Tutor");
  await expect(tutor()).toBeVisible();
}
async function fixture(workspace = mainFixture) { await write(structuredClone(workspace)); await reloadTutor(); }
async function uiSave(action, predicate) {
  const before = await snapshot();
  await verifyLocal(before);
  const requested = page.waitForRequest(request => request.url() === api && request.method() === "PUT");
  const responded = page.waitForResponse(response => response.url() === api && response.request().method() === "PUT");
  await action();
  assert.equal((await requested).postDataJSON().revision, before.revision, "UI writes carry their saved revision.");
  const response = await responded;
  assert.equal(response.status(), 200, await response.text());
  // Final-card confirmation can trigger a separate save to start the short test.
  await expect.poll(async () => {
    const after = await snapshot();
    return after.revision > before.revision && predicate(after.workspace);
  }).toBe(true);
  await expect(page.locator(".save-state")).toHaveText("Gespeichert");
  const after = await snapshot();
  await verifyLocal(after);
  return after.workspace;
}
async function startRound() {
  const data = await uiSave(() => primary().click(), workspace => !!workspace.tutorSession);
  await expect(page.locator(data.tutorSession.cardIds.length ? ".study-question" : ".quiz-question")).toBeVisible();
  return (await snapshot()).workspace;
}
async function rateCurrent(known = true, response = "") {
  const before = (await snapshot()).workspace;
  const session = before.flashcardSession;
  assert.ok(session);
  const cardId = session.queue[session.index].id;
  await expect(page.locator(".study-question")).toContainText(before.cards.find(card => card.id === cardId).question);
  if (response) await page.getByLabel("Deine Antwort in eigenen Worten", { exact: true }).fill(response);
  await click("Antwort aufdecken");
  return uiSave(() => click(known ? /^Gewusst/ : /^Noch üben/, page.getByRole("group", { name: "Bewertung der Lernkarte", exact: true })), workspace =>
    workspace.cardReviewEvents?.some(event => event.sessionId === session.id && event.cardId === cardId));
}
async function completeQuiz(run, wrongFirst = false) {
  for (let index = run.answers.length; index < run.questions.length; index++) {
    const question = run.questions[index];
    await expect(page.locator(".quiz-question")).toContainText(question.prompt);
    await page.getByRole("checkbox", { name: question.options[wrongFirst && index === 0 ? 1 : 0].text, exact: true }).check();
    await uiSave(() => click("Antwort speichern"), workspace => workspace.quizRuns.find(item => item.id === run.id)?.answers.length === index + 1);
    await expect(page.locator(".quiz-verdict, .quiz-option-review")).toHaveCount(0);
  }
  await uiSave(() => click("Test abgeben"), workspace => !!workspace.quizRuns.find(item => item.id === run.id)?.finishedAt);
  await expect(page.locator(".quiz-result-summary")).toBeVisible();
}
async function responsive(stage, scope = tutor()) {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.screenshot({ path: `.sites-runtime/qa/tutor-guided-${stage}-${width}.png`, fullPage: true, animations: "disabled" });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    assert.deepEqual(await scope.evaluate(element => {
      const computed = node => {
        const style = getComputedStyle(node);
        return { display: style.display, position: style.position, flex: style.flex, width: style.width,
          gridTemplateColumns: style.gridTemplateColumns, transform: style.transform };
      };
      return [...element.querySelectorAll("article, form, select, textarea, button")]
        .filter(child => child.getClientRects().length && child.scrollWidth > child.clientWidth + 1)
        .map(child => {
          const ancestors = [];
          for (let parent = child.parentElement; parent; parent = parent.parentElement) {
            ancestors.push({ className: parent.className, width: parent.getBoundingClientRect().width, ...computed(parent) });
          }
          return { label: child.getAttribute("aria-label") || child.textContent?.trim(), className: child.className,
            clientWidth: child.clientWidth, scrollWidth: child.scrollWidth, computed: computed(child), ancestors,
            siblings: [...child.parentElement.children].filter(node => node.getClientRects().length)
              .map(node => ({ label: node.textContent?.trim(), width: node.getBoundingClientRect().width, ...computed(node) })) };
        });
    }), [], stage + " fits " + width + "px");
    if (width < 1440) {
      const targets = await scope.locator("button:visible:not([role='checkbox']), input:visible:not([type='checkbox']), select:visible, textarea:visible").evaluateAll(elements =>
        elements.map(element => ({ label: element.getAttribute("aria-label") || element.textContent, height: element.getBoundingClientRect().height })));
      assert.ok(targets.every(target => target.height >= 43.9), stage + " touch targets: " + JSON.stringify(targets));
      const choices = await scope.locator("[role='checkbox']:visible, input[type='checkbox']:visible").evaluateAll(elements => elements.map(element => {
        const label = element.closest("label.quiz-option");
        const bounds = label?.getBoundingClientRect();
        return { label: label?.textContent, width: bounds?.width ?? 0, height: bounds?.height ?? 0 };
      }));
      assert.ok(choices.every(target => target.width >= 43.9 && target.height >= 43.9), stage + " answer choices have full clickable touch targets: " + JSON.stringify(choices));
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}

const now = new Date().toISOString();
const subject = "Projektmanagement";
const concepts = ["Projekt und Projektmanagement: Grundlagen", "Projektstart und Stakeholder", "Risiko und Controlling"];
const notes = concepts.map((title, index) => ({ id: "guided-note-" + index, title, summary: "Ziele und Entscheidungen nachvollziehbar machen.",
  content: "## " + title + "\n\nEin Projektziel gibt Orientierung. Beteiligte prüfen Ergebnisse anhand gemeinsam vereinbarter Kriterien.",
  topicId: null, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: now, updatedAt: now }));
const cards = notes.flatMap((note, area) => Array.from({ length: 7 }, (_, index) => ({ id: `guided-card-${area}-${index}`,
  question: `${note.title}: Kartenfrage ${index + 1}`, answer: "Ein gemeinsames Ziel und überprüfbare Kriterien helfen bei der Entscheidung.",
  noteId: note.id, priority: index < 5 ? 1 : 2, dueAt: `2000-01-01T00:00:0${index}.000Z`, intervalDays: 0, reviews: 0 })));
const questions = notes.flatMap((note, area) => [1, 2, 3].map(difficulty => {
  const id = `guided-question-${area}-${difficulty}`;
  return { id, subject, concept: note.title, difficulty, noteIds: [note.id], prompt: `${note.title}: Welche Aussage passt in Aufgabe ${difficulty}?`,
    options: [{ id: id + "-yes", text: "Ziele gemeinsam klären und Ergebnisse prüfen", feedback: "Richtig." }, { id: id + "-no", text: "Beteiligte und Rückmeldungen ignorieren", feedback: "Rückmeldungen prüfen die Entscheidung." }],
    correctOptionIds: [id + "-yes"], explanation: "Ein gemeinsames Ziel gibt Orientierung. Rückmeldungen helfen beim Anpassen.", source: "" };
}));
const outsideCard = { ...cards[0], id: "guided-outside-card", noteId: null, question: "Diese Karte gehört zu einem anderen Lernziel." };
const outsideQuestion = { ...questions[0], id: "guided-outside-question", subject: "Datenanalyse", noteIds: [] };
const collection = { id: "guided-projects", title: "Projektmanagement vorbereiten", description: "Grundlagen erklären und anwenden.",
  noteIds: notes.map(note => note.id), cardIds: [], questionIds: questions.map(question => question.id), pathIds: [] };
const mainFixture = { schemaVersion: 1, topics: [], notes, paths: [], completedStepIds: [], cards: [...cards, outsideCard],
  quizQuestions: [...questions, outsideQuestion], quizRuns: [], learningReminders: [], learningCollections: [collection,
    { id: "guided-outside", title: "Getrenntes Lernziel", description: "", noteIds: [], cardIds: [outsideCard.id], questionIds: [outsideQuestion.id], pathIds: [] }],
  learningFocus: { collectionId: collection.id, subject, updatedAt: now } };

try {
  await reloadTutor();
  initial = (await snapshot()).workspace;
  await verifyLocal(await snapshot());
  await mkdir(".sites-runtime/qa", { recursive: true });
  await fixture();
  console.log("Checking assistant tools read actual state, save an ordered plan and reject stale revisions");
  await expect.poll(() => page.evaluate(() => !!window.__tutorTools?.get_tutor_state)).toBe(true);
  const beforeTool = await snapshot();
  const toolState = await page.evaluate(() => window.__tutorTools.get_tutor_state.execute({}));
  assert.equal(toolState.revision, beforeTool.revision);
  assert.equal(toolState.focus.collectionId, collection.id);
  assert.deepEqual(toolState.availableConcepts, concepts);
  assert.deepEqual(await snapshot(), beforeTool, "Reading the planning tool never writes progress.");
  const toolPlan = { revision: toolState.revision, goal: "Risiken zuerst verstehen, anschließend Grundlagen klären.", targetDate: null,
    weeklyDays: 4, instructions: "Gemeinsam vereinbarte Reihenfolge, kurze Kartenrunden und Rückmeldung nach jedem Test.",
    conceptOrder: [concepts[2], concepts[0], concepts[1]] };
  const toolSaved = await page.evaluate(input => window.__tutorTools.save_tutor_plan.execute(input), toolPlan);
  assert.equal(toolSaved.saved, true);
  await expect(page.locator(".save-state")).toHaveText("Gespeichert");
  const afterTool = await snapshot();
  assert.equal(afterTool.revision, beforeTool.revision + 1);
  assert.deepEqual(afterTool.workspace.tutorPlan.conceptOrder, toolPlan.conceptOrder);
  assert.equal(afterTool.workspace.tutorPlan.instructions, toolPlan.instructions);
  await expect(tutor()).toContainText(concepts[2]);
  const stale = await page.evaluate(async input => {
    try { await window.__tutorTools.save_tutor_plan.execute(input); return null; }
    catch (error) { return error.message; }
  }, toolPlan);
  assert.match(stale, /geändert/);
  assert.deepEqual(await snapshot(), afterTool, "A stale assistant plan cannot silently overwrite the saved plan.");
  await fixture();
  await expect(tutor().getByRole("tab")).toHaveCount(0);
  await expect(tutor().locator("select:visible, textarea:visible")).toHaveCount(0);
  await expect(primary()).toHaveText(/Mit 5 Karten starten/);
  await responsive("ready");

  console.log("Checking the collapsed agreed plan persists with its instructions");
  await click(/^Lernplan und Fokus/, tutor());
  const goal = tutor().getByLabel("Dein Lernziel", { exact: true });
  const instructions = tutor().getByLabel("Vereinbarter Lernablauf", { exact: true });
  await goal.fill("Projektmanagement erklären und in Entscheidungssituationen anwenden.");
  await instructions.fill("Mit fünf Grundlagenkarten beginnen, danach kurz testen und offene Begriffe erneut aufgreifen.");
  const planned = await uiSave(() => click("Lernplan speichern", tutor()), workspace => !!workspace.tutorPlan?.instructions);
  await responsive("plan");
  await reloadTutor();
  await expect(goal).toBeHidden();
  await click(/^Lernplan und Fokus/, tutor());
  await expect(goal).toHaveValue(planned.tutorPlan.goal);
  await expect(instructions).toHaveValue(planned.tutorPlan.instructions);
  await click(/^Lernplan und Fokus/, tutor());

  console.log("Checking bounded sessions, exact resume and the failed final-card save");
  let data = await startRound();
  const session = structuredClone(data.tutorSession);
  assert.equal(session.reason, "foundation");
  assert.equal(session.concept, concepts[0]);
  assert.equal(session.cardIds.length, 5);
  assert.equal(session.questionIds.length, 3);
  assert.deepEqual(data.flashcardSession.queue.map(card => card.id), session.cardIds);
  assert.equal(data.flashcardSession.id, session.id);
  assert.ok(session.cardIds.every(id => cards.find(card => card.id === id)?.noteId === notes[0].id));
  assert.ok(session.questionIds.every(id => questions.find(question => question.id === id)?.concept === concepts[0]));
  const recall = "Mein Praxisbeispiel: Ein gemeinsames Projektziel macht Entscheidungen nachvollziehbar.";
  await rateCurrent(true, recall);
  await click("Beenden", page.locator(".study-topline"));
  await reloadTutor();
  assert.equal((await snapshot()).workspace.flashcardSession.index, 1);
  await uiSave(() => primary().click(), workspace => workspace.flashcardSession?.id === session.id && workspace.flashcardSession.index === 1);
  for (let index = 1; index < 4; index++) await rateCurrent();
  const beforeFailure = await snapshot();
  await page.route(api, async route => {
    if (route.request().method() !== "PUT") return route.continue();
    await route.fulfill({ status: 503, json: { error: "Lokaler Test: Letzte Kartenbewertung konnte nicht gespeichert werden." } });
  }, { times: 1 });
  await click("Antwort aufdecken");
  await click(/^Noch üben/, page.getByRole("group", { name: "Bewertung der Lernkarte", exact: true }));
  await expect(page.locator(".error-banner")).toBeVisible();
  assert.deepEqual(await snapshot(), beforeFailure);
  await expect(page.locator(".quiz-question")).toHaveCount(0);
  await page.unroute(api);
  data = await uiSave(() => click(/^Noch üben/, page.getByRole("group", { name: "Bewertung der Lernkarte", exact: true })), workspace => workspace.quizRuns.some(run => !run.finishedAt && run.tutorSessionId === session.id));
  await expect(page.locator(".quiz-question")).toBeVisible();
  assert.equal(data.flashcardSession, null);
  assert.equal(data.cardReviewEvents.filter(event => event.sessionId === session.id).length, 5);
  assert.equal(data.cardReviewEvents.find(event => event.sessionId === session.id && event.cardId === session.cardIds[0]).response, recall);
  const test = data.quizRuns.find(run => !run.finishedAt);
  assert.deepEqual(test.questions.map(question => question.id), session.questionIds);
  assert.equal(test.collectionId, collection.id);
  assert.equal(test.mode, "exam");
  assert.equal(test.tutorSessionId, session.id);
  await responsive("short-test", page.locator(".quiz-session"));
  await completeQuiz(test, true);
  await click("Rückmeldung im Tutor ansehen");
  await expect(tutor()).toContainText("2 von 3");
  await responsive("feedback");
  await click(/^Rückmeldung für die gemeinsame Planung/, tutor());
  const report = tutor().getByLabel("Tutor-Rückmeldung zum Kopieren", { exact: true });
  await expect(report).toHaveValue(new RegExp("Weiter zu festigen: " + concepts[0]));
  await expect(report).toHaveValue(new RegExp("Noch nicht geprüft: " + concepts[1]));
  await expect(report).toHaveValue(new RegExp(planned.tutorPlan.instructions));
  await click(/^Rückmeldung für die gemeinsame Planung/, tutor());
  data = await startRound();
  assert.equal(data.tutorSession.reason, "repair");
  assert.equal(data.tutorSession.concept, concepts[0]);
  assert.equal(data.tutorSession.questionIds.length, 1, "The next test repairs the unresolved task.");

  console.log("Checking revision conflicts cannot rate cards or advance the durable queue");
  await fixture();
  await startRound();
  const beforeConflict = await snapshot();
  await write({ ...beforeConflict.workspace, tutorPlan: { goal: "Zwischenzeitlich abgestimmter Lernplan", targetDate: null, weeklyDays: 3, updatedAt: new Date().toISOString() } });
  const afterRemote = await snapshot();
  await click("Antwort aufdecken");
  const rejected = page.waitForResponse(response => response.url() === api && response.request().method() === "PUT");
  await click(/^Gewusst/, page.getByRole("group", { name: "Bewertung der Lernkarte", exact: true }));
  assert.equal((await rejected).status(), 409);
  await expect(page.locator(".error-banner")).toBeVisible();
  assert.deepEqual(await snapshot(), afterRemote);

  console.log("Checking quiz-only pause/resume and the next uncovered foundation");
  await fixture({ ...structuredClone(mainFixture), cards: [], learningCollections: [structuredClone(collection)] });
  data = await startRound();
  assert.deepEqual(data.tutorSession.cardIds, []);
  let quizOnlyRun = data.quizRuns.find(run => !run.finishedAt);
  await page.getByRole("checkbox", { name: quizOnlyRun.questions[0].options[0].text, exact: true }).check();
  await uiSave(() => click("Antwort speichern"), workspace => workspace.quizRuns.find(run => run.id === quizOnlyRun.id)?.answers.length === 1);
  await reloadTutor();
  await primary().click();
  await expect(page.locator(".quiz-question")).toContainText(quizOnlyRun.questions[1].prompt);
  assert.equal((await snapshot()).workspace.quizRuns.filter(run => !run.finishedAt).length, 1);
  quizOnlyRun = (await snapshot()).workspace.quizRuns.find(run => !run.finishedAt);
  await completeQuiz(quizOnlyRun);
  await click("Rückmeldung im Tutor ansehen");
  await expect(tutor()).toContainText("3 von 3");
  data = await startRound();
  assert.equal(data.tutorSession.reason, "foundation");
  assert.equal(data.tutorSession.concept, concepts[1]);

  console.log("Checking honest cards-only feedback and an empty focus without invented tasks");
  await fixture({ ...structuredClone(mainFixture), quizQuestions: [], learningCollections: [{ ...structuredClone(collection), questionIds: [] }] });
  data = await startRound();
  assert.equal(data.tutorSession.cardIds.length, 5);
  assert.deepEqual(data.tutorSession.questionIds, []);
  for (let index = 0; index < 5; index++) await rateCurrent();
  await expect(page.locator(".study-finished")).toBeVisible();
  assert.equal((await snapshot()).workspace.quizRuns.length, 0);
  await click("Rückmeldung im Tutor ansehen");
  await expect(tutor()).toContainText("selbst als sicher eingeschätzt");
  await expect(tutor()).toContainText("noch kein Testergebnis");
  await fixture({ schemaVersion: 1, topics: [], notes: [], paths: [], completedStepIds: [], cards: [], quizQuestions: [], quizRuns: [], learningReminders: [], learningCollections: [] });
  await expect(tutor()).toContainText(/keine passende|Ergänze passende|Lernsammlung/);
  assert.equal((await snapshot()).workspace.tutorSession, undefined);
  await responsive("empty");
  assert.deepEqual(errors, [], "The guided flow has no client runtime errors.");
  console.log("Guided tutor browser tests passed.");
} finally {
  await page.unroute(api);
  await page.goto("about:blank");
  if (initial) await write(initial);
  await browser.close();
}
