import { chromium, expect, request as playwrightRequest } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

// Every mutation must target loopback and match the selected local SQLite file.
const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Adaptive tutor tests may only mutate localhost.");
const api = origin + "/api/brain";
const tutorApi = origin + "/api/tutor";
const sqlitePath = resolve(process.env.BRAIN_TEST_SQLITE_PATH ?? process.env.NEWHOPE_SQLITE_PATH ?? ".data/newhope.sqlite");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Berlin" });
const anonymous = await playwrightRequest.newContext({ baseURL: origin });
page.setDefaultTimeout(20000);
page.setDefaultNavigationTimeout(90000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const button = (name, scope = page) => scope.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
const impulse = () => page.getByRole("region", { name: "Lernimpuls", exact: true });
const insertTest = () => button(/^\d+ Fragen? einschieben$/, impulse());
const studyQuestion = () => page.locator(".study-question");
let initial;
let temporaryKeyId;
let heldRuntime;
let heldRating;

async function click(name, scope = page) {
  const target = button(name, scope);
  await expect(target).toBeEnabled();
  await target.click();
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
    assert.equal(row?.revision, current.revision, "The running API must use the selected local SQLite database.");
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
  return response.json();
}
async function reloadTutor() {
  const response = await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  await click("Tutor");
  await expect(page.locator(".learning-tutor")).toBeVisible();
}
async function uiSave(action, predicate) {
  const before = await snapshot();
  await verifyLocal(before);
  const request = page.waitForRequest(request => request.url() === api && request.method() === "PUT");
  const response = page.waitForResponse(response => response.url() === api && response.request().method() === "PUT");
  await action();
  assert.equal((await request).postDataJSON().revision, before.revision, "UI writes use the current revision.");
  const answered = await response;
  assert.equal(answered.status(), 200, await answered.text());
  await expect.poll(async () => {
    const after = await snapshot();
    return after.revision === before.revision + 1 && predicate(after.workspace);
  }).toBe(true);
  await expect(page.locator(".save-state")).toHaveText("Gespeichert");
  const after = await snapshot();
  await verifyLocal(after);
  return after.workspace;
}
async function rate(index, known = true) {
  await expect(studyQuestion()).toContainText(cards[index].question);
  await click("Antwort aufdecken");
  return uiSave(() => click(known ? /^Gewusst/ : /^Noch üben/, page.getByRole("group", { name: "Bewertung der Lernkarte", exact: true })), workspace =>
    workspace.cards.find(card => card.id === cards[index].id)?.reviews === 1 && workspace.flashcardSession?.index === index + 1);
}
async function startFixture(workspace = fixture) {
  await write(structuredClone(workspace));
  await reloadTutor();
  await expect(page.locator(".learning-tutor").getByRole("region", { name: "Lernimpuls", exact: true })).toHaveCount(0);
  await expect(page.locator(".learning-tutor .tutor-primary-action")).toHaveCount(1);
  await click("Lernkarten");
  await page.getByLabel("Lernsammlung für Lernkarten", { exact: true }).selectOption(collection.id);
  await uiSave(() => click("Lernrunde starten"), workspace => workspace.flashcardSession?.index === 0 && workspace.flashcardSession.collectionId === collection.id && !workspace.tutorSession);
  await expect(studyQuestion()).toContainText(cards[0].question);
}
async function reachImpulse() {
  for (let index = 0; index < 5; index++) {
    await rate(index, index !== 1);
    if (index < 4) await expect(impulse()).toHaveCount(0);
  }
  await expect(impulse()).toBeVisible();
  await expect(impulse().getByRole("heading", { name: "Kurz prüfen, was hängen geblieben ist?", exact: true })).toBeVisible();
  await expect(insertTest()).toHaveText(/3 Fragen einschieben/);
  await expect(studyQuestion()).toContainText(cards[5].question);
}
async function holdFailedRating() {
  let release, arrived, finished;
  const gate = new Promise(resolve => { release = resolve; });
  const request = new Promise(resolve => { arrived = resolve; });
  const done = new Promise(resolve => { finished = resolve; });
  let captured = false;
  await page.route(api, async route => {
    if (route.request().method() !== "PUT") return route.continue();
    captured = true;
    arrived(route.request().postDataJSON());
    await gate;
    try { await route.fulfill({ status: 503, json: { error: "Lokaler Test: Bewertung konnte nicht gespeichert werden." } }); }
    finally { finished(); }
  }, { times: 1 });
  heldRating = { request, done, release, captured: () => captured };
}
async function responsiveImpulse() {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const targets = await impulse().getByRole("button").evaluateAll(elements => elements.map(element => ({ text: element.textContent, height: element.getBoundingClientRect().height })));
    assert.ok(targets.every(target => target.height >= 43.9), "Impulse actions remain touch-sized at " + width + "px: " + JSON.stringify(targets));
    await page.screenshot({ path: ".sites-runtime/qa/tutor-adaptive-impulse-" + width + ".png", fullPage: true, animations: "disabled" });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
async function holdNextRuntime(message = "VERSPÄTETER TUTORHINWEIS DARF NICHT ERSCHEINEN", invalidAction = false) {
  let openGate, arrived, finished;
  const gate = new Promise(resolve => { openGate = resolve; });
  const request = new Promise(resolve => { arrived = resolve; });
  const done = new Promise(resolve => { finished = resolve; });
  let targetKey = null, pending = 0, released = false;
  const finishWhenIdle = () => { if (released && pending === 0) finished(); };
  const release = () => { released = true; openGate(); finishWhenIdle(); };
  await page.route(tutorApi, async route => {
    const data = route.request().postDataJSON();
    const key = JSON.stringify(data);
    if (data.context !== "cards" || targetKey !== null && key !== targetKey) return route.continue();
    // StrictMode can abort the first mounted effect and immediately send the
    // same request again. Mock the entire original context, including its live
    // replacement; newer progress must still receive ordinary rules guidance.
    targetKey ??= key;
    pending++;
    try {
      const local = await route.fetch();
      const status = local.status();
      assert.ok(status === 200 || status === 409, "A held tutor request either uses its original revision or detects newer progress.");
      const rules = await local.json();
      if (status === 200) {
        assert.equal(rules.source, "rules");
        assert.ok(rules.action, "The delayed reply must carry a valid matching action to exercise stale-response protection.");
        arrived(data);
      }
      await gate;
      try {
        await route.fulfill({ status, json: status === 409 ? rules : { ...rules, source: "llm", message,
          ...(invalidAction ? { action: { ...rules.action, questionIds: [outsideQuestion.id], questionCount: 1 } } : {}) } });
      } catch (error) {
        if (!/closed|disposed|already handled|aborted|completed/i.test(String(error))) throw error;
      }
    } finally { pending--; finishWhenIdle(); }
  });
  heldRuntime = { request, done, release, captured: () => targetKey !== null, message };
  return heldRuntime;
}
async function releaseRuntime(visible = false) {
  const message = heldRuntime.message;
  heldRuntime.release();
  await heldRuntime.done;
  heldRuntime = null;
  await page.unroute(tutorApi);
  // Give the completed fetch and React state update an opportunity to settle.
  await page.waitForTimeout(150);
  const rendered = page.getByText(message, { exact: true });
  if (visible) await expect(rendered).toBeVisible();
  else await expect(rendered).toHaveCount(0);
}
async function runtimeRequest() {
  return Promise.race([heldRuntime.request, page.waitForTimeout(15000).then(() => { throw new Error("The learning impulse did not request runtime advice within 15 seconds."); })]);
}

const now = new Date().toISOString();
const subject = "Zusammenarbeit im Team";
const notes = ["Gemeinsame Ziele", "Feedback und Anpassung", "Noch nicht gelernter Bereich"].map((title, index) => ({
  id: "adaptive-note-" + index, title, summary: "Wissen für die Zusammenarbeit.", content: "## " + title + "\n\nEin gemeinsames Ziel gibt Orientierung; Feedback macht Anpassungen möglich.",
  topicId: null, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: now, updatedAt: now,
}));
const cards = Array.from({ length: 12 }, (_, index) => ({
  id: "adaptive-card-" + index, question: "Lernkarte " + (index + 1) + ": " + (index < 6 ? "Gemeinsame Ziele erklären" : "Feedback anwenden"),
  answer: "Ziele gemeinsam klären und Ergebnisse anhand von Feedback verbessern.", noteId: notes[index < 6 ? 0 : 1].id,
  priority: 1, reviews: 0, intervalDays: 0, dueAt: new Date(Date.UTC(2000, 0, 1, 0, 0, index)).toISOString(),
}));
const questions = notes.flatMap((note, index) => [1, 2, 3].map(difficulty => {
  const id = "adaptive-question-" + index + "-" + difficulty;
  return { id, subject, concept: note.title, difficulty, noteIds: [note.id], prompt: note.title + ": Aufgabe " + difficulty,
    options: [{ id: id + "-yes", text: "Richtig: Ziele und Feedback gemeinsam klären.", feedback: "" }, { id: id + "-no", text: "Falsch: Rückmeldungen ignorieren.", feedback: "Feedback unterstützt die Zusammenarbeit." }],
    correctOptionIds: [id + "-yes"], explanation: "Ein gemeinsames Ziel gibt Orientierung. Feedback hilft beim Anpassen.", source: "" };
}));
const unlinkedQuestion = { ...structuredClone(questions[0]), id: "adaptive-unlinked-question", noteIds: [], prompt: "Eine unverbundene Aufgabe im selben Fachthema" };
const outsideQuestion = { ...structuredClone(questions[0]), id: "adaptive-outside-question", prompt: "Eine Aufgabe aus einer anderen Sammlung" };
const collection = { id: "adaptive-collection", title: "Zusammenarbeit verstehen", description: "Ziele und Feedback aktiv üben.", noteIds: notes.map(note => note.id), cardIds: cards.map(card => card.id), questionIds: [...questions.map(question => question.id), unlinkedQuestion.id], pathIds: [] };
const outsideCollection = { id: "adaptive-other-collection", title: "Getrennte Lernsammlung", description: "Eine andere Auswahl.", noteIds: [], cardIds: [], questionIds: [outsideQuestion.id], pathIds: [] };
const fixture = { schemaVersion: 1, topics: [], notes, paths: [], completedStepIds: [], cards, quizQuestions: [...questions, unlinkedQuestion, outsideQuestion], quizRuns: [], learningReminders: [], learningCollections: [collection, outsideCollection], learningFocus: { collectionId: collection.id, subject, updatedAt: now } };

try {
  await reloadTutor();
  initial = (await snapshot()).workspace;
  await verifyLocal(await snapshot());
  await mkdir(".sites-runtime/qa", { recursive: true });
  await write(structuredClone(fixture));
  await reloadTutor();

  console.log("Checking the tutor runtime is session-only, revision-aware, read-only and local-rule based");
  const beforeRuntime = await snapshot();
  const runtimeData = { revision: beforeRuntime.revision, context: "overview" };
  assert.equal((await anonymous.post("/api/tutor", { headers: { Origin: origin }, data: runtimeData })).status(), 401);
  const keyResponse = await page.request.post(origin + "/api/keys", { headers: { Origin: origin }, data: { name: "Adaptive tutor browser test" } });
  assert.equal(keyResponse.status(), 201, await keyResponse.text());
  const keyResult = await keyResponse.json();
  const secret = keyResult.secret ?? keyResult.key;
  assert.match(secret, /^nh_[A-Za-z0-9_-]{43}$/);
  const listed = await (await page.request.get(origin + "/api/keys")).json();
  temporaryKeyId = listed.keys.find(key => key.name === "Adaptive tutor browser test")?.id;
  assert.ok(temporaryKeyId, "The temporary access key is recorded for cleanup.");
  const keyHeaders = { Origin: origin, Authorization: "Bearer " + secret };
  assert.equal((await anonymous.get("/api/brain", { headers: keyHeaders })).status(), 200, "The real key grants access to its permitted data route.");
  assert.equal((await anonymous.post("/api/tutor", { headers: keyHeaders, data: runtimeData })).status(), 401, "A valid data key does not authorize the runtime tutor.");
  assert.equal((await page.request.post(tutorApi, { headers: { Origin: "https://example.invalid" }, data: runtimeData })).status(), 403);
  assert.equal((await page.request.post(tutorApi, { headers: { Origin: origin }, data: { ...runtimeData, revision: beforeRuntime.revision - 1 } })).status(), 409);
  assert.equal((await page.request.post(tutorApi, { headers: { Origin: origin }, data: { ...runtimeData, userId: "another-owner" } })).status(), 400);
  assert.equal((await page.request.post(tutorApi, { headers: { Origin: origin, "Content-Type": "text/plain" }, data: "invalid" })).status(), 415);
  assert.equal((await page.request.post(tutorApi, { headers: { Origin: origin, "Content-Type": "application/json" }, data: "{" })).status(), 400);
  assert.equal((await page.request.post(tutorApi, { headers: { Origin: origin }, data: { ...runtimeData, padding: "x".repeat(1400) } })).status(), 413);
  const fallback = await page.request.post(tutorApi, { headers: { Origin: origin }, data: runtimeData });
  assert.equal(fallback.status(), 200, await fallback.text());
  const advice = await fallback.json();
  assert.equal(advice.revision, beforeRuntime.revision);
  assert.equal(advice.source, "rules", "Run this suite with NEWHOPE_TUTOR_LLM_ENABLED disabled; no external model is called.");
  assert.equal(typeof advice.message, "string");
  assert.ok(advice.message.length <= 420);
  assert.deepEqual(await snapshot(), beforeRuntime, "Generating advice never writes knowledge or progress.");
  assert.equal((await page.request.delete(origin + "/api/keys/" + temporaryKeyId, { headers: { Origin: origin } })).status(), 200);
  temporaryKeyId = null;

  console.log("Checking five saved ratings offer a contextual test without changing the next card");
  await startFixture();
  for (let index = 0; index < 4; index++) await rate(index, index !== 1);
  await expect(impulse()).toHaveCount(0);
  const beforeFailedRating = await snapshot();
  await holdFailedRating();
  await click("Antwort aufdecken");
  await click(/^Gewusst/, page.getByRole("group", { name: "Bewertung der Lernkarte", exact: true }));
  await Promise.race([heldRating.request, page.waitForTimeout(15000).then(() => { throw new Error("The card rating did not submit a save request within 15 seconds."); })]);
  await expect(impulse()).toHaveCount(0);
  assert.deepEqual(await snapshot(), beforeFailedRating, "An optimistic fifth card does not count before its rating is saved.");
  heldRating.release();
  await heldRating.done;
  heldRating = null;
  await page.unroute(api);
  await expect(page.locator(".error-banner")).toBeVisible();
  await expect(studyQuestion()).toContainText(cards[4].question);
  await expect(impulse()).toHaveCount(0);
  assert.deepEqual(await snapshot(), beforeFailedRating, "A failed rating neither advances the durable queue nor creates an impulse.");
  await uiSave(() => click(/^Gewusst/, page.getByRole("group", { name: "Bewertung der Lernkarte", exact: true })), workspace => workspace.flashcardSession?.index === 5 && workspace.cardReviewEvents?.length === 5);
  await expect(impulse()).toBeVisible();
  await expect(impulse().getByRole("heading", { name: "Kurz prüfen, was hängen geblieben ist?", exact: true })).toBeVisible();
  await expect(insertTest()).toHaveText(/3 Fragen einschieben/);
  await expect(studyQuestion()).toContainText(cards[5].question);
  const offered = await snapshot();
  assert.equal(offered.workspace.cardReviewEvents.length, 5);
  assert.ok(offered.workspace.cardReviewEvents.every(event => event.collectionId === collection.id && event.noteId === notes[0].id));
  assert.equal(offered.workspace.cardReviewEvents.filter(event => event.known).length, 4);
  assert.equal(offered.workspace.quizRuns.length, 0, "An offer does not start a test automatically.");
  await responsiveImpulse();
  await reloadTutor();
  await expect(impulse(), "The Tutor surface keeps one guided action instead of duplicating an optional card impulse.").toHaveCount(0);
  await expect(page.locator(".learning-tutor .tutor-primary-action")).toHaveCount(1);
  await uiSave(() => click("Kartenrunde fortsetzen", page.locator(".learning-tutor")), workspace => workspace.flashcardSession?.index === 5);
  await expect(impulse()).toBeVisible();
  await expect(studyQuestion()).toContainText(cards[5].question);

  const interleaved = await uiSave(() => insertTest().click(), workspace => workspace.quizRuns.filter(run => !run.finishedAt).length === 1 && workspace.tutorCheckpointDecisions?.some(decision => decision.decision === "started"));
  await expect(page.locator(".quiz-question")).toBeVisible();
  const run = interleaved.quizRuns.find(run => !run.finishedAt);
  assert.equal(run.mode, "exam");
  assert.equal(run.collectionId, collection.id);
  assert.equal(run.questions.length, 3);
  assert.equal(new Set(run.questions.map(question => question.id)).size, 3);
  assert.ok(run.questions.every(question => questions.slice(0, 3).some(current => current.id === question.id)), "The test only samples tasks explicitly linked to reviewed notes in this collection.");
  assert.equal(interleaved.flashcardSession.index, 5);
  assert.equal(run.cardCheckpoint.sessionId, interleaved.flashcardSession.id);
  for (let index = 0; index < run.questions.length; index++) {
    const question = run.questions[index];
    await expect(page.locator(".quiz-question")).toContainText(question.prompt);
    await page.getByRole("checkbox", { name: question.options[0].text, exact: true }).check();
    await uiSave(() => click("Antwort speichern"), workspace => workspace.quizRuns.find(current => current.id === run.id)?.answers.length === index + 1);
    await expect(page.locator(".quiz-verdict, .quiz-option-review")).toHaveCount(0);
  }
  await uiSave(() => click("Test abgeben"), workspace => !!workspace.quizRuns.find(current => current.id === run.id)?.finishedAt);
  await expect(page.locator(".quiz-result-summary")).toContainText("3 von 3 richtig");
  await click("Mit deinen Karten weiterlernen");
  await expect(studyQuestion()).toContainText(cards[5].question);
  await expect(impulse()).toHaveCount(0);
  assert.equal((await snapshot()).workspace.flashcardSession.index, 5, "Returning resumes the sixth card without repeating a rated card.");

  console.log("Checking dismissal survives reload and allows a new offer after five more saved ratings");
  await startFixture();
  await reachImpulse();
  await uiSave(() => click("Weiter mit Karten", impulse()), workspace => workspace.tutorCheckpointDecisions?.some(decision => decision.decision === "later"));
  await expect(impulse()).toHaveCount(0);
  await expect(studyQuestion()).toContainText(cards[5].question);
  await reloadTutor();
  await expect(impulse()).toHaveCount(0);
  await uiSave(() => click("Kartenrunde fortsetzen", page.locator(".learning-tutor")), workspace => workspace.flashcardSession?.index === 5);
  await expect(impulse()).toHaveCount(0);
  for (let index = 5; index < 10; index++) {
    await rate(index);
    if (index < 9) await expect(impulse()).toHaveCount(0);
  }
  await expect(impulse()).toBeVisible();
  await expect(studyQuestion()).toContainText(cards[10].question);

  console.log("Checking historical daily counters and old queue positions never invent contextual learning evidence");
  const legacy = structuredClone(fixture);
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  legacy.cardReviewDays = [{ date: day, collectionId: collection.id, reviewed: 500, known: 500 }];
  legacy.flashcardSession = { id: "legacy-adaptive-session", collectionId: collection.id, mode: "due", queue: cards.map(card => ({ id: card.id, reviews: card.reviews, dueAt: card.dueAt })), index: 5, startedAt: now, updatedAt: now };
  for (const card of legacy.cards.slice(0, 5)) { card.reviews = 100; card.dueAt = "2099-01-01T00:00:00.000Z"; }
  await write(legacy);
  await reloadTutor();
  await uiSave(() => click("Kartenrunde fortsetzen", page.locator(".learning-tutor")), workspace => workspace.flashcardSession?.index === 5);
  await expect(impulse()).toHaveCount(0);
  await rate(5);
  await expect(impulse()).toHaveCount(0);

  console.log("Checking cards-only and unlinked cards cannot offer an unrelated runnable test");
  const cardsOnly = structuredClone(fixture);
  cardsOnly.quizQuestions = [];
  for (const selected of cardsOnly.learningCollections) selected.questionIds = [];
  await startFixture(cardsOnly);
  for (let index = 0; index < 5; index++) await rate(index);
  await expect(impulse()).toHaveCount(0);
  const unlinked = structuredClone(fixture);
  for (const card of unlinked.cards) card.noteId = null;
  await startFixture(unlinked);
  for (let index = 0; index < 5; index++) await rate(index);
  await expect(impulse()).toHaveCount(0);

  console.log("Checking matching runtime advice renders while an unavailable action keeps local guidance");
  await startFixture();
  for (let index = 0; index < 4; index++) await rate(index);
  await holdNextRuntime("PASSENDER KI-LERNIMPULS AUS DEM LOKALEN TEST");
  await rate(4);
  await runtimeRequest();
  const beforeAdvice = await snapshot();
  await releaseRuntime(true);
  await expect(impulse().getByText("KI-Lernimpuls", { exact: true })).toBeVisible();
  assert.deepEqual(await snapshot(), beforeAdvice, "Showing matching runtime advice neither writes progress nor starts its suggested action.");
  await expect(studyQuestion()).toContainText(cards[5].question);

  await startFixture();
  for (let index = 0; index < 4; index++) await rate(index);
  await holdNextRuntime("UNPASSENDER KI-LERNIMPULS DARF NICHT ERSCHEINEN", true);
  await rate(4);
  await runtimeRequest();
  await releaseRuntime();
  await expect(impulse()).toBeVisible();
  await expect(insertTest()).toHaveText(/3 Fragen einschieben/);

  console.log("Checking a late runtime answer cannot restore an offer after dismissal or newer progress");
  await startFixture();
  for (let index = 0; index < 4; index++) await rate(index);
  await holdNextRuntime();
  await rate(4);
  await runtimeRequest();
  await expect(impulse()).toBeVisible();
  await uiSave(() => click("Weiter mit Karten", impulse()), workspace => workspace.tutorCheckpointDecisions?.some(decision => decision.decision === "later"));
  await releaseRuntime();
  await expect(impulse()).toHaveCount(0);

  await startFixture();
  for (let index = 0; index < 4; index++) await rate(index);
  await holdNextRuntime();
  await rate(4);
  await runtimeRequest();
  await expect(impulse()).toBeVisible();
  await rate(5);
  await releaseRuntime();
  await expect(studyQuestion()).toContainText(cards[6].question);
  assert.equal((await snapshot()).workspace.flashcardSession.index, 6);
  assert.deepEqual(errors, [], "No client runtime errors.");
  console.log("Adaptive tutor browser tests passed.");
} finally {
  if (heldRating) { heldRating.release(); if (heldRating.captured()) await heldRating.done.catch(() => {}); }
  if (heldRuntime) { heldRuntime.release(); if (heldRuntime.captured()) await heldRuntime.done.catch(() => {}); }
  await page.unroute(api);
  await page.unroute(tutorApi);
  if (temporaryKeyId) await page.request.delete(origin + "/api/keys/" + temporaryKeyId, { headers: { Origin: origin } });
  await page.goto("about:blank");
  if (initial) await write(initial);
  await anonymous.dispose();
  await browser.close();
}
