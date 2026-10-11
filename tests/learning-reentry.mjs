import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Learning reentry tests may only mutate localhost.");
const sqlitePath = resolve(process.env.BRAIN_TEST_SQLITE_PATH ?? process.env.NEWHOPE_SQLITE_PATH ?? ".data/newhope.sqlite");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(20000);
page.setDefaultNavigationTimeout(90000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let initial;
const hub = () => page.getByRole("region", { name: "Dein Lernüberblick", exact: true });
const button = (name, scope = page) => scope.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
async function click(name, scope = page) { await expect(button(name, scope)).toBeEnabled(); await button(name, scope).click(); }
async function snapshot() {
  const response = await page.request.get(origin + "/api/brain");
  assert.equal(response.status(), 200);
  return response.json();
}
async function verifyLocal(current) {
  assert.equal((await realpath(sqlitePath)).toLowerCase(), sqlitePath.toLowerCase());
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const row = db.prepare("SELECT body, revision FROM newhope_workspaces WHERE owner_id = ?").get("local_dev");
    assert.equal(row.revision, current.revision, "The running API must use the explicitly selected local SQLite database.");
    const stored = JSON.parse(row.body);
    for (const key of ["cards", "quizQuestions", "quizRuns", "learningReminders", "learningCollections"]) stored[key] ??= [];
    assert.deepEqual(stored, current.workspace);
  } finally { db.close(); }
}
async function write(workspace) {
  const current = await snapshot();
  await verifyLocal(current);
  const response = await page.request.put(origin + "/api/brain", { data: { workspace, revision: current.revision } });
  assert.equal(response.status(), 200, await response.text());
  return response.json();
}
async function reload() {
  const response = await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  await expect(hub()).toBeVisible();
}
async function uiSave(action, predicate) {
  const before = await snapshot();
  await verifyLocal(before);
  const requested = page.waitForRequest(request => request.url() === origin + "/api/brain" && request.method() === "PUT");
  const responded = page.waitForResponse(response => response.url() === origin + "/api/brain" && response.request().method() === "PUT");
  await action();
  assert.equal((await requested).postDataJSON().revision, before.revision);
  const response = await responded;
  assert.equal(response.status(), 200, await response.text());
  await expect.poll(async () => {
    const after = await snapshot();
    return after.revision === before.revision + 1 && predicate(after.workspace);
  }).toBe(true);
  await expect(page.locator(".save-state")).toHaveText("Gespeichert");
  return (await snapshot()).workspace;
}
async function mobileFits(stage) {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    assert.deepEqual(await page.locator(".learning-overview, .learning-next-step, .learning-area, .learning-summary-stats, .learning-area-actions button").evaluateAll(elements => elements.filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.className)), [], `${stage} fits ${width}px`);
    const targets = await hub().getByRole("button").evaluateAll(elements => elements.map(element => {
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { label: element.textContent, height: bounds.height, minHeight: style.minHeight, fontSize: style.fontSize, width: bounds.width, parentDisplay: getComputedStyle(element.parentElement).display };
    }));
    assert.ok(targets.every(target => target.height >= 44), `Learning actions have 44px touch targets at ${width}px: ${JSON.stringify(targets)}`);
    await page.screenshot({ path: `.sites-runtime/qa/learning-reentry-${stage}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
const now = new Date().toISOString();
const subject = "Agiles Projektmanagement";
const concepts = ["Scrum-Verantwortung", "Inkrement und Feedback", "Sprint-Ziel"];
const notes = concepts.map((concept, index) => ({ id: `reentry-note-${index}`, title: concept, summary: "Eine übertragbare Grundlage für die Teamarbeit.", content: `## ${concept}\n\nEine verständliche Erklärung mit Praxisbeispiel.`, topicId: null, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: now, updatedAt: now }));
const cards = concepts.map((concept, index) => ({ id: `reentry-card-${index}`, question: `Kartenfrage ${index}: ${concept}`, answer: `Antwort ${index}: Verantwortung und Feedback im Team erklären.`, noteId: notes[index].id, priority: 1, reviews: 0, intervalDays: 0, dueAt: `2000-01-01T00:00:0${index}.000Z` }));
const questions = concepts.flatMap((concept, index) => [1, 2].map(level => {
  const id = `reentry-question-${index}-${level}`;
  return { id, subject, concept, difficulty: level, noteIds: [notes[index].id], prompt: `${concept}, Stufe ${level}: Welche Aussage passt?`, options: [{ id: id + "-yes", text: `Richtig ${index}-${level}: Verantwortung und Feedback klären.`, feedback: "" }, { id: id + "-no", text: `Falsch ${index}-${level}: Zusammenarbeit ignorieren.`, feedback: "Verantwortung muss ausdrücklich geklärt werden." }], correctOptionIds: [id + "-yes"], explanation: "Die vorhandene Grundlage erklärt den Zusammenhang.", source: "" };
}));
const collection = { id: "reentry-agile", title: "Vorbereitung agiles Projektmanagement", description: "Scrum und iteratives Arbeiten verstehen.", noteIds: notes.map(note => note.id), cardIds: [], questionIds: questions.map(question => question.id), pathIds: [] };
const unrelated = { id: "reentry-other", title: "Andere Vorbereitung", description: "Eine getrennte Sammlung.", noteIds: [], cardIds: [], questionIds: [], pathIds: [] };
const fixture = { schemaVersion: 1, topics: [], notes, paths: [], completedStepIds: [], cards, quizQuestions: questions, quizRuns: [], learningReminders: [], learningCollections: [collection, unrelated], learningFocus: { collectionId: collection.id, subject, updatedAt: now } };
async function failNextWrite() {
  let writes = 0;
  await page.route(origin + "/api/brain", async route => {
    if (route.request().method() !== "PUT") { await route.continue(); return; }
    writes++;
    if (writes === 1) await route.fulfill({ status: 503, json: { error: "Lokaler Test: Speichern fehlgeschlagen." } });
    else await route.continue();
  });
  return { count: () => writes, stop: () => page.unroute(origin + "/api/brain") };
}
try {
  await reload();
  initial = (await snapshot()).workspace;
  await verifyLocal(await snapshot());
  await mkdir(".sites-runtime/qa", { recursive: true });
  await write(fixture);
  await reload();
  await expect(hub().getByRole("heading", { name: collection.title, exact: true })).toBeVisible();
  await mobileFits("initial");

  console.log("Checking durable cards, pause, reload and exact resume position");
  let stored = await uiSave(() => click("Fällige Karten wiederholen", hub()), workspace => workspace.flashcardSession?.index === 0);
  const sessionId = stored.flashcardSession.id;
  await expect(page.locator(".study-question")).toContainText(cards[0].question);
  await click("Antwort aufdecken");
  stored = await uiSave(() => button(/^Gewusst/).click(), workspace => workspace.flashcardSession?.index === 1 && workspace.cards[0].reviews === 1);
  await expect(page.locator(".study-question")).toContainText(cards[1].question);
  await click("Beenden");
  assert.equal((await snapshot()).workspace.flashcardSession.id, sessionId);
  await expect(button("Lernrunde fortsetzen")).toBeVisible();
  await reload();
  await expect(hub()).toContainText("2 Karten warten");
  await uiSave(() => click("Lernkarten fortsetzen", hub()), workspace => workspace.flashcardSession?.id === sessionId && workspace.flashcardSession.index === 1);
  await expect(page.locator(".study-question")).toContainText(cards[1].question);
  await click("Antwort aufdecken");
  await uiSave(() => button(/^Gewusst/).click(), workspace => workspace.flashcardSession?.index === 2);
  await click("Antwort aufdecken");
  await uiSave(() => button(/^Gewusst/).click(), workspace => workspace.flashcardSession === null && workspace.cards.every(card => card.reviews === 1));
  await reload();
  await expect(hub().getByRole("button", { name: "Nächste Einheit starten", exact: true })).toBeVisible();
  await expect(hub().getByLabel("Dein gespeicherter Lernstand")).toContainText("3 / 3");

  console.log("Checking one-shot launch failure, preparation, weak-area remediation and direct results");
  const failed = await failNextWrite();
  const beforeFailure = await snapshot();
  await click("Nächste Einheit starten", hub());
  await expect(button("Start erneut versuchen")).toBeVisible();
  await expect.poll(failed.count).toBe(1);
  assert.equal((await snapshot()).revision, beforeFailure.revision);
  await failed.stop();
  stored = await uiSave(() => click("Start erneut versuchen"), workspace => workspace.quizRuns.length === 1);
  let run = stored.quizRuns[0];
  assert.equal(run.collectionId, collection.id);
  assert.equal(run.subject, subject);
  assert.equal(run.preparationConcept, concepts[0]);
  assert.ok(run.questions.every(question => question.concept === concepts[0]));
  const question = run.questions[0];
  await page.getByRole("checkbox", { name: question.options[1].text, exact: true }).check();
  await uiSave(() => click("Bestätigen"), workspace => workspace.quizRuns[0].answers.length === 1);
  await click("Zum Lernüberblick");
  await expect(button("Einheit fortsetzen", hub())).toBeVisible();
  await expect(hub().getByLabel("Lernfokus auswählen")).toBeDisabled();
  await reload();
  await click("Einheit fortsetzen", hub());
  assert.equal((await snapshot()).workspace.quizRuns.length, 1, "Resume creates no replacement run.");
  await expect(page.locator(".quiz-verdict")).toBeVisible();
  await click("Nächste Aufgabe");
  run = (await snapshot()).workspace.quizRuns[0];
  const second = run.questions[1];
  await page.getByRole("checkbox", { name: second.options[1].text, exact: true }).check();
  await uiSave(() => click("Bestätigen"), workspace => workspace.quizRuns[0].answers.length === 2 && !!workspace.quizRuns[0].finishedAt);
  await expect(page.locator(".quiz-result-summary")).toContainText("0 von 2 richtig");
  await click("Zum Lernüberblick");
  await expect(hub()).toContainText("1 / 3");
  await expect(button("Schwachstelle üben", hub())).toBeVisible();
  const revision = (await snapshot()).revision;
  await click(`${concepts[0]}: Wissen nachschlagen`, hub());
  await expect(page.getByRole("dialog", { name: notes[0].title, exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  assert.equal((await snapshot()).revision, revision, "Reading alone records no mastery or learning completion.");
  await click("Auswertung ansehen", hub());
  await expect(page.locator(".quiz-result-summary")).toContainText("0 von 2 richtig");
  await click("Zum Lernüberblick");
  stored = await uiSave(() => click("Schwachstelle üben", hub()), workspace => workspace.quizRuns.length === 2);
  run = stored.quizRuns[1];
  for (let index = 0; index < run.questions.length; index++) {
    const item = run.questions[index];
    await page.getByRole("checkbox", { name: item.options.find(option => item.correctOptionIds.includes(option.id)).text, exact: true }).check();
    await uiSave(() => click("Bestätigen"), workspace => workspace.quizRuns[1].answers.length === index + 1 && (index < run.questions.length - 1 || !!workspace.quizRuns[1].finishedAt));
    if (index < run.questions.length - 1) await click("Nächste Aufgabe");
  }
  await expect(page.locator(".quiz-result-summary")).toContainText("2 von 2 richtig");
  await click("Zum Lernüberblick");
  await expect(hub()).toContainText("+100 Prozentpunkte");
  await expect(button("Nächste Einheit starten", hub())).toBeVisible();
  await expect(button("Schwachstelle üben", hub())).toHaveCount(0);
  await mobileFits("progress");
  await page.screenshot({ path: ".sites-runtime/qa/learning-reentry-progress-desktop.png", fullPage: true });

  console.log("Checking short checkpoint scope and hidden solutions before submission");
  stored = await uiSave(() => click("Kurztest starten", hub()), workspace => workspace.quizRuns.length === 3);
  run = stored.quizRuns[2];
  assert.equal(run.mode, "exam");
  assert.equal(run.collectionId, collection.id);
  assert.equal(run.questions.length, 6);
  assert.equal(new Set(run.questions.map(question => question.concept)).size, 3);
  assert.equal(run.deadlineAt, null);
  const examQuestion = run.questions[0];
  await page.getByRole("checkbox", { name: examQuestion.options[1].text, exact: true }).check();
  await uiSave(() => click("Antwort speichern"), workspace => workspace.quizRuns[2].answers.length === 1);
  await expect(page.locator(".quiz-verdict, .quiz-option-review")).toHaveCount(0);
  await click("Zum Lernüberblick");
  await expect(button("Einheit fortsetzen", hub())).toBeVisible();
  await expect(button("Auswertung ansehen", hub())).toBeDisabled();
  await reload();
  await click("Einheit fortsetzen", hub());
  await expect(page.locator(".quiz-option-review")).toHaveCount(0);
  await uiSave(() => click("Test abgeben"), workspace => !!workspace.quizRuns[2].finishedAt);
  await expect(page.locator(".quiz-result-summary")).toContainText("0 von 6 richtig");
  await expect(page.locator(".quiz-option-review").first()).toBeVisible();
  await click("Zum Lernüberblick");
  await expect(button("Schwachstelle üben", hub())).toBeVisible();
  await expect(hub()).toContainText("keinen vergleichbaren früheren Wert");

  console.log("Checking stale saved card snapshots skip safely on resume");
  const stale = structuredClone(fixture);
  stale.flashcardSession = { id: "stale-round", collectionId: collection.id, mode: "due", queue: cards.map(card => ({ id: card.id, reviews: card.reviews, dueAt: card.dueAt })), index: 0, startedAt: now, updatedAt: now };
  stale.cards[0].reviews = 1;
  stale.cards[0].dueAt = "2099-01-01T00:00:00.000Z";
  await write(stale);
  await reload();
  await expect(hub()).toContainText("2 Karten warten");
  await uiSave(() => click("Lernkarten fortsetzen", hub()), workspace => workspace.flashcardSession?.index === 1);
  await expect(page.locator(".study-question")).toContainText(cards[1].question);
  assert.equal((await snapshot()).workspace.cards[0].reviews, 1);

  console.log("Checking explicit replacement and failed starts preserve saved learning");
  await click("Beenden");
  const oldSession = (await snapshot()).workspace.flashcardSession;
  await click("Lernrunde starten");
  const replacement = page.getByRole("alertdialog", { name: "Pausierte Lernrunde ersetzen?", exact: true });
  await expect(replacement).toBeVisible();
  assert.deepEqual((await snapshot()).workspace.flashcardSession, oldSession);
  await click("Abbrechen", replacement);
  assert.deepEqual((await snapshot()).workspace.flashcardSession, oldSession);
  await click("Lernrunde starten");
  await uiSave(() => click("Neue Runde beginnen", replacement), workspace => workspace.flashcardSession?.id !== oldSession.id);
  assert.equal((await snapshot()).workspace.cards[0].reviews, 1, "Replacing a round preserves earlier card progress.");

  await write(fixture);
  await reload();
  const failedCardStart = await failNextWrite();
  await click("Fällige Karten wiederholen", hub());
  await expect(page.getByRole("alert").filter({ hasText: "Lokaler Test:" })).toBeVisible();
  await expect(page.locator(".study-question")).toHaveCount(0);
  assert.equal((await snapshot()).workspace.flashcardSession, undefined);
  assert.equal(failedCardStart.count(), 1);
  await failedCardStart.stop();
  await uiSave(() => click("Lernrunde starten"), workspace => workspace.flashcardSession?.index === 0);

  console.log("Checking revision conflicts cannot automatically restart a card round");
  await write(fixture);
  await reload();
  let conflictingWrites = 0;
  await page.route(origin + "/api/brain", async route => {
    if (route.request().method() !== "PUT") { await route.continue(); return; }
    conflictingWrites++;
    const changed = structuredClone(fixture);
    changed.notes[0].summary = "Parallel gespeicherte Änderung bleibt erhalten.";
    await write(changed);
    await route.continue();
  }, { times: 1 });
  await click("Fällige Karten wiederholen", hub());
  await expect(page.locator(".error-banner")).toBeVisible();
  await expect(page.locator(".study-question")).toHaveCount(0);
  assert.equal((await snapshot()).workspace.flashcardSession, undefined);
  await page.unroute(origin + "/api/brain");
  await click("Aktuellen Stand laden");
  await expect(page.locator(".error-banner")).toHaveCount(0);
  await expect(page.locator(".study-question")).toHaveCount(0);
  assert.equal(conflictingWrites, 1);
  assert.equal((await snapshot()).workspace.notes[0].summary, "Parallel gespeicherte Änderung bleibt erhalten.");

  console.log("Checking focus persistence and legacy results retain their exact collection scope");
  const legacy = structuredClone(fixture);
  legacy.cards = [];
  legacy.learningCollections[0].questionIds = questions.slice(0, 4).map(question => question.id);
  legacy.quizRuns = [{ id: "legacy-preparation", subject, mode: "practice", preparationConcept: concepts[0], startedAt: now, deadlineAt: null, finishedAt: now, questions: questions.slice(0, 2), answers: questions.slice(0, 2).map(question => ({ questionId: question.id, selectedOptionIds: question.correctOptionIds, answeredAt: now, reflection: "" })) }];
  await write(legacy);
  await reload();
  await uiSave(() => hub().getByLabel("Lernfokus auswählen").selectOption(unrelated.id), workspace => workspace.learningFocus.collectionId === unrelated.id);
  await reload();
  await expect(hub().getByRole("heading", { name: unrelated.title, exact: true })).toBeVisible();
  await uiSave(() => hub().getByLabel("Lernfokus auswählen").selectOption(collection.id), workspace => workspace.learningFocus.collectionId === collection.id);
  await click("Auswertung ansehen", hub());
  await expect(page.locator(".quiz-result-summary")).toContainText("2 von 2 richtig");
  stored = await uiSave(() => click("Nächsten Lernbereich starten", page.locator(".quiz-result-summary")), workspace => workspace.quizRuns.length === 2);
  run = stored.quizRuns[1];
  assert.equal(run.collectionId, collection.id);
  assert.equal(run.preparationConcept, concepts[1]);
  assert.ok(run.questions.every(question => legacy.learningCollections[0].questionIds.includes(question.id)));

  assert.deepEqual(errors, [], "No client runtime errors.");
  console.log("Learning reentry browser tests passed.");
} finally {
  await page.unroute(origin + "/api/brain");
  if (initial) await write(initial);
  await browser.close();
}
