import test from "node:test";
import assert from "node:assert/strict";
import { DAILY_PACKAGE_DECK, emptyWorkspace, quizRunSchema, reviewCard, workspaceSchema } from "../lib/brain/model.ts";
import { recordCardReview } from "../lib/brain/learning-tutor.ts";
import { recommendLearning, resumableFlashcardSession } from "../lib/brain/learning-resume.ts";
import { DAILY_PACKAGE_CARDS, DAILY_REVIEW_CARDS, NEW_CARDS_PER_DAY, dailyPackageStatus, dailySeries, markDailyReading, noteSections, proposeDailyPackage, settleDailyPackage, startDailyPackage, validateDailyPackageQuiz, withRoomForDailyRun } from "../lib/brain/daily-package.ts";

const now = Date.parse("2026-11-08T08:00:00.000Z");
const iso = new Date(now).toISOString();
const past = new Date(now - 86_400_000).toISOString();
const future = new Date(now + 5 * 86_400_000).toISOString();
const body = Array.from({ length: 90 }, (_, index) => `wort${index}`).join(" ");
const content = `## Erster Abschnitt\n\n${body}\n\n## Zweiter Abschnitt\n\n${body}\n\n## Quellen\n\n${body}`;

function note(id, topicId, extra = {}) {
  return { id, title: `Notiz ${id}`, summary: "", content, topicId, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: past, updatedAt: past, ...extra };
}
function card(id, noteId, reviews = 3, dueAt = past, intervalDays = 3) {
  return { id, noteId, question: `Frage ${id}`, answer: "Antwort", reviews, intervalDays, dueAt };
}
function question(id, noteIds, subject = "Fach A") {
  return { id, subject, concept: `Bereich ${id}`, noteIds, difficulty: 1, prompt: `Aufgabe ${id}`, options: [{ id: "yes", text: "Ja", feedback: "" }, { id: "no", text: "Nein", feedback: "" }], correctOptionIds: ["yes"], explanation: "Weil.", source: "" };
}
function fixture(overrides = {}) {
  const topics = [{ id: "a", title: "A", description: "", color: "blue", parentId: null }, { id: "a1", title: "A1", description: "", color: "blue", parentId: "a" }, { id: "b", title: "B", description: "", color: "green", parentId: null }];
  const notes = [note("n1", "a1"), note("n2", "b")];
  const cards = [...Array.from({ length: 12 }, (_, index) => card(`a${index}`, "n1")), ...Array.from({ length: 12 }, (_, index) => card(`b${index}`, "n2")), ...Array.from({ length: 8 }, (_, index) => card(`new${index}`, "n1", 0, past, 0))];
  return { ...structuredClone(emptyWorkspace), topics, notes, cards, quizQuestions: [question("q1", ["n1"]), question("q2", ["n1"]), question("q3", ["n1"]), question("q4", ["n1"]), question("q5", ["n2"], "Fach B")], ...overrides };
}
function rateAll(data, time = now + 1_000) {
  let result = data;
  const session = data.flashcardSession;
  for (const [index, entry] of session.queue.entries()) {
    const date = new Date(time + index);
    result = recordCardReview(result, { cardId: entry.id, sessionId: session.id, collectionId: session.collectionId, known: true }, date);
    const advanced = index + 1 < session.queue.length ? { ...session, index: index + 1, updatedAt: date.toISOString() } : null;
    result = settleDailyPackage({ ...result, cards: result.cards.map(item => item.id === entry.id ? reviewCard(item, true, date) : item), flashcardSession: advanced }, date);
  }
  return result;
}
function finishQuiz(data, time = now + 90_000) {
  const item = data.dailyPackage;
  const finishedAt = new Date(time).toISOString();
  const questions = item.questionIds.map(id => data.quizQuestions.find(entry => entry.id === id));
  const run = { id: `run-${item.id}`, subject: item.subject, mode: "exam", dailyPackageId: item.id, startedAt: finishedAt, deadlineAt: null, finishedAt, questions,
    answers: questions.map(entry => ({ questionId: entry.id, selectedOptionIds: ["yes"], answeredAt: finishedAt, reflection: "" })) };
  validateDailyPackageQuiz(data, run);
  return settleDailyPackage({ ...data, quizRuns: [...data.quizRuns, quizRunSchema.parse(run)] }, new Date(time));
}

test("sections split at level-two headings and leave out source lists", () => {
  const sections = noteSections({ content });
  assert.deepEqual(sections.map(section => section.key), ["Erster Abschnitt", "Zweiter Abschnitt"]);
  const fenced = noteSections({ content: "```\n## kein Abschnitt\n```\n\n" + content });
  assert.equal(fenced.some(section => section.key === "kein Abschnitt"), false);
  const long = noteSections({ content: Array.from({ length: 20 }, () => Array(100).fill("wort").join(" ")).join("\n\n") });
  assert.ok(long.length > 1 && long.every(section => section.words <= 750));
  assert.equal(new Set(long.map(section => section.key)).size, long.length);
});

test("a package caps cards, mixes fields and limits new cards", () => {
  const proposal = proposeDailyPackage(fixture(), false, now);
  assert.equal(proposal.cardIds.length, DAILY_PACKAGE_CARDS);
  assert.equal(proposal.newCards, 2);
  const review = proposal.cardIds.slice(0, DAILY_REVIEW_CARDS);
  assert.equal(review.filter(id => id.startsWith("a")).length, 4);
  assert.equal(review.filter(id => id.startsWith("b")).length, 4);
  assert.equal(proposal.questionIds.length, 3);
  assert.ok(proposal.minutes >= 8 && proposal.minutes <= 12, `about ten minutes, got ${proposal.minutes}`);
});

test("cards that are not due stay out, unsure cards come first", () => {
  const data = fixture({ cards: [card("later", "n1", 3, future), card("unsure", "n1", 3, future, 0), card("due", "n1")] });
  const ids = proposeDailyPackage(data, false, now).cardIds;
  assert.deepEqual(ids, ["unsure", "due"]);
});

test("the exam collection gets half of the review slots while its date is ahead", () => {
  const collection = { id: "exam", title: "Prüfung", description: "", noteIds: ["n2"], questionIds: [], cardIds: [], pathIds: [] };
  const data = fixture({ cards: [...Array.from({ length: 20 }, (_, index) => card(`a${index}`, "n1")), ...Array.from({ length: 20 }, (_, index) => card(`b${index}`, "n2"))], topics: [{ id: "a", title: "A", description: "", color: "blue", parentId: null }, { id: "c", title: "C", description: "", color: "blue", parentId: null }, { id: "d", title: "D", description: "", color: "blue", parentId: null }, { id: "b", title: "B", description: "", color: "green", parentId: null }],
    notes: [note("n1", "a"), note("n2", "b")], learningCollections: [collection], learningFocus: { collectionId: "exam", subject: null, updatedAt: iso },
    tutorPlan: { goal: "Bestehen", targetDate: "2026-12-01", weeklyDays: 5, updatedAt: iso } });
  assert.ok(proposeDailyPackage(data, false, now).cardIds.filter(id => id.startsWith("b")).length > 4, "more than an even share");
});

test("a full package runs through cards, reading and questions and counts the day", () => {
  let data = startDailyPackage(fixture(), "pack-1", false, now);
  assert.deepEqual(workspaceSchema.parse(data).dailyPackage, data.dailyPackage);
  assert.equal(dailyPackageStatus(data, now).stage, "cards");
  assert.equal(data.flashcardSession.collectionId, DAILY_PACKAGE_DECK);
  data = rateAll(data);
  assert.equal(dailyPackageStatus(data, now + 2_000).stage, "read");
  assert.equal(dailyPackageStatus(data, now + 2_000).section.key, "Erster Abschnitt");
  data = markDailyReading(data, "pack-1", new Date(now + 60_000));
  assert.equal(data.noteReads.length, 1);
  const status = dailyPackageStatus(data, now + 61_000);
  assert.equal(status.stage, "quiz");
  assert.equal(status.action.dailyPackageId, "pack-1");
  data = finishQuiz(data);
  const done = dailyPackageStatus(data, now + 100_000);
  assert.equal(done.stage, "done");
  assert.equal(done.completedToday, 1);
  assert.ok(data.dailyPackage.completedAt);
  assert.doesNotThrow(() => workspaceSchema.parse(data));
});

test("further packages stay within the daily limit for new cards and move to the next section", () => {
  let data = startDailyPackage(fixture(), "pack-1", false, now);
  data = finishQuiz(markDailyReading(rateAll(data), "pack-1", new Date(now + 60_000)));
  const first = data.dailyPackage.reading;
  data = startDailyPackage(data, "pack-2", false, now + 120_000);
  assert.equal(data.dailyPackage.number, 2);
  assert.notDeepEqual(data.dailyPackage.reading, first);
  assert.notEqual(data.dailyPackage.reading.noteId, first.noteId, "the next package reads in another field");
  let days = data.dailyPackageDays.find(day => day.date === "2026-11-08");
  data = finishQuiz(markDailyReading(rateAll(data, now + 130_000), "pack-2", new Date(now + 180_000)), now + 190_000);
  for (let number = 3; number < 8; number++) {
    data = startDailyPackage(data, `pack-${number}`, false, now + number * 200_000);
    if (data.dailyPackage.cardIds.length) data = rateAll(data, now + number * 201_000);
    if (data.dailyPackage.reading) data = markDailyReading(data, `pack-${number}`, new Date(now + number * 202_000));
    if (data.dailyPackage.questionIds.length) data = finishQuiz(data, now + number * 203_000);
    days = data.dailyPackageDays.find(day => day.date === "2026-11-08");
    assert.ok(days.newCards <= NEW_CARDS_PER_DAY);
  }
  assert.equal(days.completed, 7);
});

test("an open package cannot be replaced today and is replaced tomorrow", () => {
  const data = startDailyPackage(fixture(), "pack-1", false, now);
  assert.throws(() => startDailyPackage(data, "pack-2", false, now + 1_000), /offenes Paket/);
  const tomorrow = startDailyPackage(data, "pack-2", false, now + 86_400_000);
  assert.equal(tomorrow.dailyPackage.id, "pack-2");
  assert.equal(tomorrow.flashcardSession.id, "pack-2");
});

test("the short version is three cards and finishes the day", () => {
  let data = startDailyPackage(fixture(), "short-1", true, now);
  assert.equal(data.dailyPackage.cardIds.length, 3);
  assert.equal(data.dailyPackage.reading, null);
  data = rateAll(data);
  assert.equal(dailyPackageStatus(data, now + 5_000).stage, "done");
  assert.equal(dailyPackageStatus(data, now + 5_000).completedToday, 1);
});

test("a package round leaves the Tutor, the focus and saved decks alone", () => {
  const paused = { id: "open-all", collectionId: null, mode: "all", queue: [{ id: "a0", reviews: 3, dueAt: past }], index: 0, startedAt: iso, updatedAt: iso };
  const focus = { collectionId: null, subject: "Fach A", updatedAt: iso };
  const before = fixture({ flashcardSession: paused, learningFocus: focus });
  const data = startDailyPackage(before, "pack-1", false, now);
  assert.equal(data.pausedFlashcardSessions[0].id, "open-all");
  assert.deepEqual(data.learningFocus, focus);
  assert.equal(resumableFlashcardSession(data), null);
  assert.notEqual(recommendLearning(data, now).primaryAction?.kind, "resume-cards");
});

test("the series forgives a single missed day but not two", () => {
  const log = dates => ({ ...structuredClone(emptyWorkspace), dailyPackageDays: dates.map(date => ({ date, completed: 1, newCards: 0 })) });
  assert.equal(dailySeries(log(["2026-11-06", "2026-11-07", "2026-11-08"]), "2026-11-08"), 3);
  assert.equal(dailySeries(log(["2026-11-05", "2026-11-07"]), "2026-11-08"), 2);
  assert.equal(dailySeries(log(["2026-11-06"]), "2026-11-08"), 1, "yesterday missed and today still open");
  assert.equal(dailySeries(log(["2026-11-04", "2026-11-07"]), "2026-11-08"), 1);
  assert.equal(dailySeries(log(["2026-11-05"]), "2026-11-08"), 0);
});

test("questions fall back from the note to its field to the weakest overall", () => {
  const onlyB = fixture({ quizQuestions: [question("q5", ["n2"], "Fach B")], notes: [note("n1", "a1")], cards: [] });
  assert.equal(proposeDailyPackage({ ...onlyB, cards: [] }, false, now).subject, "Fach B", "global fallback");
  const unrelated = fixture({ quizQuestions: [question("q6", ["n3"], "Fach C"), question("q7", ["n2"], "Fach B")], notes: [note("n1", "a1", { title: "Quellen: A" }), note("n3", "a1", { content: "kurz" }), note("n2", "b")] });
  assert.ok(proposeDailyPackage(unrelated, false, now).questionIds.length > 0);
});

test("the shared round limit only ever gives up older daily rounds", () => {
  const run = (id, extra = {}) => ({ id, subject: "Fach A", mode: "practice", startedAt: iso, deadlineAt: null, finishedAt: iso, questions: [question(`q-${id}`, ["n1"])], answers: [], ...extra });
  const full = Array.from({ length: 199 }, (_, index) => run(`r${index}`));
  const daily = run("oldest-daily", { mode: "exam", dailyPackageId: "x" });
  assert.deepEqual(withRoomForDailyRun({ ...fixture(), quizRuns: [...full, daily] }).quizRuns.map(item => item.id), full.map(item => item.id));
  const noDaily = { ...fixture(), quizRuns: [...full, run("r200")] };
  assert.equal(withRoomForDailyRun(noDaily).quizRuns.length, 200);
  assert.deepEqual(proposeDailyPackage(noDaily, false, now).questionIds, []);
});
