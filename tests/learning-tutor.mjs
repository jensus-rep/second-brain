import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

// Mutations require both a loopback URL and proof that the running API uses the
// explicitly selected local SQLite file. Never point this suite at Azure.
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
let initial;
const tutor = () => page.locator(".learning-tutor");
const button = (name, scope = page) => scope.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
async function click(name, scope = page) { await expect(button(name, scope)).toBeEnabled(); await button(name, scope).click(); }
async function tab(name) {
  const target = tutor().getByRole("tab", { name, exact: true });
  await target.click();
  await expect(target).toHaveAttribute("aria-selected", "true");
}
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
  await click("Tutor");
  await expect(tutor()).toBeVisible();
  await expect(tutor().getByRole("tab", { name: "Heute", exact: true })).toHaveAttribute("aria-selected", "true");
}
async function uiSave(action, predicate) {
  const before = await snapshot();
  await verifyLocal(before);
  const requested = page.waitForRequest(request => request.url() === api && request.method() === "PUT");
  const responded = page.waitForResponse(response => response.url() === api && response.request().method() === "PUT");
  await action();
  assert.equal((await requested).postDataJSON().revision, before.revision, "Every interaction submits its current workspace revision.");
  const response = await responded;
  assert.equal(response.status(), 200, await response.text());
  await expect.poll(async () => {
    const after = await snapshot();
    return after.revision === before.revision + 1 && predicate(after.workspace);
  }).toBe(true);
  await expect(page.locator(".save-state")).toHaveText("Gespeichert");
  const after = await snapshot();
  await verifyLocal(after);
  return after.workspace;
}
async function responsive(stage) {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    assert.deepEqual(await tutor().evaluate(element => [...element.querySelectorAll("section, article, form, dl, ul, button, input, select, textarea")].filter(child => child.scrollWidth > child.clientWidth + 1).map(child => child.className || child.tagName)), [], `${stage} content fits ${width}px`);
    const targets = await tutor().locator("button:visible, input:visible, select:visible, textarea:visible").evaluateAll(elements => elements.map(element => ({ label: element.getAttribute("aria-label") || element.textContent, height: element.getBoundingClientRect().height })));
    assert.ok(targets.every(target => target.height >= 43.9), `${stage} controls have 44px touch targets at ${width}px: ${JSON.stringify(targets)}`);
    if (width < 1440) {
      const navigation = page.getByRole("navigation", { name: "Hauptnavigation", exact: true });
      await expect(button("Tutor", navigation)).toBeVisible();
      await expect(button("Tutor", navigation)).toHaveAttribute("aria-current", "page");
      await expect(navigation.getByRole("button")).toHaveCount(6);
      const shortcuts = await navigation.getByRole("button").evaluateAll(elements => elements.map(element => {
        const bounds = element.getBoundingClientRect();
        return { label: element.getAttribute("aria-label"), width: bounds.width, height: bounds.height };
      }));
      assert.ok(shortcuts.every(target => target.width >= 43.9 && target.height >= 43.9), `All six mobile shortcuts retain 44px touch targets at ${width}px: ${JSON.stringify(shortcuts)}`);
      if (stage === "today") {
        await page.evaluate(() => window.scrollTo(0, 0));
        await expect.poll(async () => {
          const primary = await tutor().locator(".tutor-primary-action").boundingBox();
          const dock = await navigation.boundingBox();
          return primary && dock ? dock.y - primary.y - primary.height : -1000;
        }, { message: `The primary learning action is immediately visible above the navigation at ${width}px` }).toBeGreaterThanOrEqual(-1);
      }
    }
    await page.screenshot({ path: `.sites-runtime/qa/learning-tutor-${stage}-${width}.png`, fullPage: true, animations: "disabled" });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
const day = value => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
const now = new Date().toISOString();
const yesterday = new Date(Date.now() - 86400000).toISOString();
const today = day(new Date());
const subject = "Agiles Projektmanagement";
const concepts = ["Sprint-Ziel", "Inkrement und Feedback"];
const notes = concepts.map((concept, index) => ({ id: `tutor-note-${index}`, title: concept, summary: "Eine Grundlage für die Zusammenarbeit im Team.", content: `## ${concept}\n\nEin gemeinsames Ziel und Feedback machen Ergebnisse überprüfbar.`, topicId: null, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: now, updatedAt: now }));
const cards = concepts.map((concept, index) => ({ id: `tutor-card-${index}`, question: `Kartenfrage ${index}: ${concept}`, answer: `Antwort ${index}: Gemeinsame Ziele und Feedback erklären.`, noteId: notes[index].id, priority: 1, reviews: 0, intervalDays: 0, dueAt: `2000-01-01T00:00:0${index}.000Z` }));
const questions = concepts.flatMap((concept, index) => [1, 2].map(difficulty => {
  const id = `tutor-question-${index}-${difficulty}`;
  return { id, subject, concept, difficulty, noteIds: [notes[index].id], prompt: `${concept}, Aufgabe ${difficulty}: Welche Aussage passt?`, options: [{ id: id + "-yes", text: `Richtig ${index}-${difficulty}: Ziele und Feedback gemeinsam klären.`, feedback: "" }, { id: id + "-no", text: `Falsch ${index}-${difficulty}: Rückmeldungen vollständig ignorieren.`, feedback: "Das Team benötigt ein gemeinsames Ziel und überprüfbare Ergebnisse." }], correctOptionIds: [id + "-yes"], explanation: "Ein gemeinsames Ziel richtet die Zusammenarbeit aus. Feedback prüft, ob das Ergebnis zum Ziel passt.", source: "" };
}));
const outsideQuestion = { ...structuredClone(questions[0]), id: "tutor-outside-question", subject: "Datenanalyse", concept: "Datengrundlage" };
const outsideCard = { ...structuredClone(cards[0]), id: "tutor-outside-card", question: "Eine Karte aus einer getrennten Vorbereitung", noteId: null, reviews: 7, dueAt: "2099-01-01T00:00:00.000Z" };
const collection = { id: "tutor-agile", title: "Vorbereitung agiles Projektmanagement", description: "Ziele klären und Ergebnisse prüfen.", noteIds: notes.map(note => note.id), cardIds: [], questionIds: questions.map(question => question.id), pathIds: [] };
const unrelated = { id: "tutor-other", title: "Getrennte Vorbereitung", description: "Ein anderer Lernumfang.", noteIds: [], cardIds: [outsideCard.id], questionIds: [outsideQuestion.id], pathIds: [] };
const fixture = { schemaVersion: 1, topics: [], notes, paths: [], completedStepIds: [], cards: [...cards, outsideCard], quizQuestions: [...questions, outsideQuestion], quizRuns: [], learningReminders: [], learningCollections: [collection, unrelated], learningFocus: { collectionId: collection.id, subject, updatedAt: now }, cardReviewDays: [{ date: day(new Date(yesterday)), collectionId: collection.id, reviewed: 3, known: 2 }, { date: today, collectionId: unrelated.id, reviewed: 7, known: 7 }] };
const todaysReviews = workspace => workspace.cardReviewDays.find(item => item.date === today && item.collectionId === collection.id);

try {
  await reload(); // Opens the development browser session through the app's normal login redirect.
  initial = (await snapshot()).workspace;
  await verifyLocal(await snapshot());
  await mkdir(".sites-runtime/qa", { recursive: true });
  await write(fixture);
  await reload();
  await expect(tutor()).toContainText(collection.title);
  await expect(button("Fällige Karten wiederholen", tutor())).toBeVisible();
  await responsive("today");

  console.log("Checking the preparation plan persists, survives reload, and reports a failed save honestly");
  const goal = tutor().getByLabel("Dein Lernziel", { exact: true });
  const targetDate = tutor().getByLabel("Zieldatum (optional)", { exact: true });
  const weeklyDays = tutor().getByLabel("Lerntage pro Woche", { exact: true });
  await goal.fill("Scrum-Zusammenhänge sicher erklären und im Kurztest anwenden.");
  await targetDate.fill("2099-01-15");
  if (await weeklyDays.evaluate(element => element.tagName === "SELECT")) await weeklyDays.selectOption("4");
  else await weeklyDays.fill("4");
  let stored = await uiSave(() => click("Lernplan speichern", tutor()), workspace => workspace.tutorPlan?.weeklyDays === 4 && workspace.tutorPlan.targetDate === "2099-01-15");
  assert.equal(stored.tutorPlan.goal, "Scrum-Zusammenhänge sicher erklären und im Kurztest anwenden.");
  await reload();
  await expect(goal).toHaveValue(stored.tutorPlan.goal);
  await expect(targetDate).toHaveValue("2099-01-15");
  await expect(weeklyDays).toHaveValue("4");
  await responsive("plan");
  await tab("Vorbereitung");
  await responsive("preparation");
  await tab("Heute");
  const beforeFailure = await snapshot();
  await verifyLocal(beforeFailure);
  await goal.fill("Anwendung anhand eines praktischen Teambeispiels festigen.");
  await page.route(api, async route => {
    if (route.request().method() === "PUT") await route.fulfill({ status: 503, json: { error: "Lokaler Test: Lernplan konnte nicht gespeichert werden." } });
    else await route.continue();
  });
  await click("Lernplan speichern", tutor());
  await expect(tutor().getByRole("alert")).toBeVisible();
  assert.deepEqual(await snapshot(), beforeFailure, "A failed plan save must not silently update the persisted goal.");
  await tab("Auswertung");
  await tab("Heute");
  await expect(goal).toHaveValue("Anwendung anhand eines praktischen Teambeispiels festigen.");
  await expect(tutor().getByRole("alert")).toBeVisible();
  await page.unroute(api);
  stored = await uiSave(() => click("Lernplan speichern", tutor()), workspace => workspace.tutorPlan.goal === "Anwendung anhand eines praktischen Teambeispiels festigen.");
  await reload();
  await expect(goal).toHaveValue(stored.tutorPlan.goal);

  console.log("Checking external plan conflicts sync untouched fields and preserve a local draft until explicit adoption");
  async function rejectStalePlanSave(expectedRevision) {
    const current = await snapshot();
    await verifyLocal(current);
    const request = page.waitForRequest(request => request.url() === api && request.method() === "PUT");
    const response = page.waitForResponse(response => response.url() === api && response.request().method() === "PUT");
    await click("Lernplan speichern", tutor());
    assert.equal((await request).postDataJSON().revision, expectedRevision);
    assert.equal((await response).status(), 409);
    await expect(page.locator(".error-banner")).toBeVisible();
    assert.deepEqual(await snapshot(), current, "A stale plan save must preserve the parallel stored plan.");
    await click("Aktuellen Stand laden");
    await expect(page.locator(".error-banner")).toHaveCount(0);
    await expect(page.locator(".save-state")).toHaveText("Gespeichert");
    assert.deepEqual(await snapshot(), current, "Loading the current plan creates no additional write.");
  }
  const pristineBefore = await snapshot();
  const pristineRemote = structuredClone(pristineBefore.workspace);
  pristineRemote.tutorPlan = { goal: "Extern gespeichertes Lernziel für meine nächste Vorbereitung.", targetDate: null, weeklyDays: 2, updatedAt: new Date().toISOString() };
  const pristineSaved = await write(pristineRemote);
  await rejectStalePlanSave(pristineBefore.revision);
  await expect(goal).toHaveValue(pristineSaved.workspace.tutorPlan.goal);
  await expect(targetDate).toHaveValue("");
  await expect(weeklyDays).toHaveValue("2");
  await expect(button("Aktuellen Lernplan übernehmen", tutor())).toHaveCount(0);

  await goal.fill("Mein eigener Entwurf soll beim Laden erhalten bleiben.");
  const dirtyBefore = await snapshot();
  const dirtyRemote = structuredClone(dirtyBefore.workspace);
  dirtyRemote.tutorPlan = { goal: "Ein zweites parallel gespeichertes Lernziel.", targetDate: "2099-02-20", weeklyDays: 5, updatedAt: new Date().toISOString() };
  const dirtySaved = await write(dirtyRemote);
  await rejectStalePlanSave(dirtyBefore.revision);
  await expect(goal).toHaveValue("Mein eigener Entwurf soll beim Laden erhalten bleiben.");
  await expect(targetDate).toHaveValue("");
  await expect(weeklyDays).toHaveValue("2");
  await expect(tutor().locator(".tutor-plan-remote-change")).toContainText(/zwischenzeitlich geändert/);
  await click("Aktuellen Lernplan übernehmen", tutor());
  await expect(goal).toHaveValue(dirtySaved.workspace.tutorPlan.goal);
  await expect(targetDate).toHaveValue("2099-02-20");
  await expect(weeklyDays).toHaveValue("5");
  await expect(tutor().locator(".tutor-plan-remote-change")).toHaveCount(0);
  assert.deepEqual(await snapshot(), dirtySaved, "Adopting the stored plan only replaces the local form draft.");

  console.log("Checking direct card entry, durable daily self-ratings, continuity, and exact resume position");
  await tab("Heute");
  stored = await uiSave(() => click("Fällige Karten wiederholen", tutor()), workspace => workspace.flashcardSession?.index === 0);
  assert.equal(stored.flashcardSession.collectionId, collection.id);
  assert.deepEqual(stored.flashcardSession.queue.map(card => card.id), cards.map(card => card.id));
  await expect(page.locator(".study-question")).toContainText(cards[0].question);
  await click("Antwort aufdecken");
  stored = await uiSave(() => click(/^Gewusst/), workspace => todaysReviews(workspace)?.reviewed === 1 && todaysReviews(workspace).known === 1);
  assert.equal(stored.cards[0].reviews, 1);
  await click("Beenden");
  await reload();
  await expect(button("Lernkarten fortsetzen", tutor())).toBeVisible();
  await expect(tutor().getByLabel("Lernfokus auswählen", { exact: true })).toBeDisabled();
  await expect(button("Kurztest starten", tutor())).toBeDisabled();
  await expect(tutor().locator(".tutor-week-strip")).toBeVisible();
  await expect(tutor().locator(".tutor-week-strip li")).toHaveCount(7);
  assert.ok((await tutor().locator(".tutor-week-strip li").evaluateAll(elements => elements.map(element => element.getAttribute("aria-label")))).some(label => /8 Kartenbewertungen/.test(label)), "The learning week includes the new review and activity in the other collection.");
  await uiSave(() => click("Lernkarten fortsetzen", tutor()), workspace => workspace.flashcardSession?.index === 1);
  await expect(page.locator(".study-question")).toContainText(cards[1].question);
  await click("Antwort aufdecken");
  stored = await uiSave(() => click(/^Noch üben/), workspace => workspace.flashcardSession === null && todaysReviews(workspace)?.reviewed === 2 && todaysReviews(workspace).known === 1);
  assert.equal(stored.cardReviewDays.find(item => item.collectionId === unrelated.id).reviewed, 7, "A card rating retains the other collection's historical activity.");
  await reload();

  console.log("Checking a direct scoped short test and its persisted evaluation");
  stored = await uiSave(() => click("Kurztest starten", tutor()), workspace => workspace.quizRuns.length === 1 && !workspace.quizRuns[0].finishedAt);
  const run = stored.quizRuns[0];
  assert.equal(run.mode, "exam");
  assert.equal(run.collectionId, collection.id);
  assert.equal(run.questions.length, 4);
  assert.ok(run.questions.every(question => collection.questionIds.includes(question.id)), "The direct test never pulls tasks from another collection.");
  for (let index = 0; index < run.questions.length; index++) {
    const question = run.questions[index];
    await expect(page.locator(".quiz-question")).toContainText(question.prompt);
    await page.getByRole("checkbox", { name: question.options[index === 0 ? 0 : 1].text, exact: true }).check();
    await uiSave(() => click("Antwort speichern"), workspace => workspace.quizRuns[0].answers.length === index + 1);
    await expect(page.locator(".quiz-verdict, .quiz-option-review")).toHaveCount(0);
  }
  await uiSave(() => click("Test abgeben"), workspace => !!workspace.quizRuns[0].finishedAt);
  await expect(page.locator(".quiz-result-summary")).toContainText("1 von 4 richtig");
  await click("Zum Lernüberblick");
  await expect(tutor()).toBeVisible();
  await tab("Auswertung");
  await expect(tutor().locator(".tutor-result-list")).toContainText(/25\s*%/);
  await expect(tutor().locator(".tutor-result-list").getByRole("button", { name: /Auswertung ansehen$/ })).toHaveCount(1);
  const resultRevision = (await snapshot()).revision;
  await click(/Auswertung ansehen$/, tutor().locator(".tutor-result-list"));
  await expect(page.locator(".quiz-result-summary")).toContainText("1 von 4 richtig");
  assert.equal((await snapshot()).revision, resultRevision, "Viewing a saved result creates no extra completion or new run.");
  await reload();
  await tab("Auswertung");
  await expect(tutor().locator(".tutor-result-list")).toContainText(/25\s*%/);
  await responsive("evaluation");

  console.log("Checking comparable learning-curve results and collection scope while continuity stays global");
  const evaluated = (await snapshot()).workspace;
  const baseline = { ...structuredClone(evaluated.quizRuns[0]), id: "tutor-baseline-run", startedAt: yesterday, finishedAt: yesterday, answers: evaluated.quizRuns[0].questions.map(question => ({ questionId: question.id, selectedOptionIds: [question.options[1].id], answeredAt: yesterday, reflection: "" })) };
  const outsideRun = { id: "tutor-outside-run", subject: outsideQuestion.subject, mode: "exam", collectionId: unrelated.id, startedAt: now, deadlineAt: null, finishedAt: now, questions: [outsideQuestion], answers: [{ questionId: outsideQuestion.id, selectedOptionIds: outsideQuestion.correctOptionIds, answeredAt: now, reflection: "" }] };
  evaluated.quizRuns = [baseline, evaluated.quizRuns[0], outsideRun];
  await write(evaluated);
  await reload();
  const globalWeek = await tutor().locator(".tutor-week-strip li").evaluateAll(elements => elements.map(element => element.getAttribute("aria-label")));
  await tab("Auswertung");
  await expect(tutor().locator(".tutor-result-list").getByRole("button", { name: /Auswertung ansehen$/ })).toHaveCount(2);
  await expect(tutor().locator(".tutor-learning-curve")).toBeVisible();
  await expect(tutor()).toContainText(/\+25\s+Prozentpunkte/);
  await responsive("curve");
  await uiSave(() => tutor().getByLabel("Lernfokus auswählen", { exact: true }).selectOption(unrelated.id), workspace => workspace.learningFocus.collectionId === unrelated.id);
  await expect(tutor().locator(".tutor-result-list").getByRole("button", { name: /Auswertung ansehen$/ })).toHaveCount(1);
  await expect(tutor().locator(".tutor-result-list")).toContainText(/100\s*%/);
  await expect(tutor().locator(".tutor-result-list")).not.toContainText(subject);
  await tab("Heute");
  assert.deepEqual(await tutor().locator(".tutor-week-strip li").evaluateAll(elements => elements.map(element => element.getAttribute("aria-label"))), globalWeek, "Changing the learning focus does not hide the overall learning continuity.");
  await reload();
  await expect(tutor().getByLabel("Lernfokus auswählen", { exact: true })).toHaveValue(unrelated.id);

  console.log("Checking cards-only and empty workspaces expose useful entry points");
  const cardsOnly = structuredClone(fixture);
  cardsOnly.cards = structuredClone(cards);
  cardsOnly.quizQuestions = [];
  cardsOnly.quizRuns = [];
  cardsOnly.cardReviewDays = [];
  cardsOnly.learningCollections = [{ ...structuredClone(collection), questionIds: [] }];
  cardsOnly.learningFocus.subject = null;
  await write(cardsOnly);
  await reload();
  await expect(button("Fällige Karten wiederholen", tutor())).toBeEnabled();
  assert.equal(await button("Kurztest starten", tutor()).isEnabled().catch(() => false), false, "Cards-only preparation must not offer a runnable empty test.");
  await responsive("cards-only");
  await uiSave(() => click("Fällige Karten wiederholen", tutor()), workspace => workspace.flashcardSession?.queue.length === 2);
  await expect(page.locator(".study-question")).toBeVisible();
  const empty = { schemaVersion: 1, topics: [], notes: [], paths: [], completedStepIds: [], cards: [], quizQuestions: [], quizRuns: [], learningReminders: [], learningCollections: [] };
  await write(empty);
  await reload();
  await expect(tutor().getByRole("heading")).not.toHaveCount(0);
  await expect(tutor()).toContainText(/Lernsammlung|Vorbereitung|Lernbestand/);
  await responsive("empty");
  const emptyRevision = (await snapshot()).revision;
  await click("Lernsammlung anlegen", tutor());
  await expect(page.getByRole("region", { name: "Lernsammlungen", exact: true })).toBeVisible();
  await expect(button("Neue Lernsammlung")).toBeEnabled();
  assert.equal((await snapshot()).revision, emptyRevision, "The empty-state entry point opens preparation without inventing progress.");
  await click("Tutor");
  await tab("Auswertung");
  await expect(tutor()).toContainText(/noch keine|Noch keine|ersten|erste/);
  assert.deepEqual(errors, [], "No client runtime errors.");
  console.log("Tutor browser tests passed.");
} finally {
  await page.unroute(api);
  await page.goto("about:blank");
  if (initial) await write(initial);
  await browser.close();
}
