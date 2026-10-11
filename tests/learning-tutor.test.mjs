import test from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace, workspaceSchema, tutorPlanSchema, cardReviewDaySchema, cardReviewEventSchema, tutorCheckpointDecisionSchema, quizRunSchema } from "../lib/brain/model.ts";
import { tutorInsights, tutorDate, recordCardReview, tutorCardCheckpoint, recordTutorCheckpoint, tutorCardContentFingerprint } from "../lib/brain/learning-tutor.ts";
import { recommendLearning } from "../lib/brain/learning-resume.ts";
import { compactQuizRuns, ARCHIVED_TEXT, ARCHIVED_EXPLANATION } from "../lib/brain/quiz.ts";
import { learningQuestionFingerprint } from "../lib/brain/quiz-content.ts";
import { projectManagementLearning } from "../lib/brain/project-management-learning.ts";

const subject = "Projektmanagement";
const timestamp = "2026-10-10T10:00:00.000Z";
const now = Date.parse("2026-10-10T12:00:00.000Z");
const question = (id = "q1", overrides = {}) => ({
  id, subject, concept: "Ziele", difficulty: 1, prompt: "Was gibt Orientierung?",
  options: [{ id: "yes", text: "Ein gemeinsames Ziel", feedback: "Richtig" }, { id: "no", text: "Zufällige Aufgaben", feedback: "Falsch" }],
  correctOptionIds: ["yes"], explanation: "Ein gemeinsames Ziel gibt Orientierung.", source: "", ...overrides,
});
const run = (id, questions = [question()], date = timestamp, overrides = {}) => ({
  id, subject: questions[0].subject, mode: "practice", startedAt: date, deadlineAt: null, finishedAt: date, questions,
  answers: questions.map(q => ({ questionId: q.id, selectedOptionIds: ["yes"], answeredAt: date, reflection: "" })), ...overrides,
});
const wrong = (result) => ({ ...result, answers: result.answers.map(answer => ({ ...answer, selectedOptionIds: ["no"] })) });
const collection = (id, ids, overrides = {}) => ({ id, title: id, description: "", noteIds: [], questionIds: ids, cardIds: [], pathIds: [], ...overrides });
const workspace = (questions = [question()], overrides = {}) => ({ ...structuredClone(emptyWorkspace), quizQuestions: questions, ...overrides });
const selection = (data, collectionId = null, selectedSubject = subject, time = now) => ({ ...recommendLearning(data, time), collectionId, subject: selectedSubject });
const insights = (data, collectionId = null, selectedSubject = subject, time = now) => tutorInsights(data, selection(data, collectionId, selectedSubject, time), time);
const plan = (overrides = {}) => ({ goal: "Zusammenhänge sicher anwenden", targetDate: "2026-10-20", weeklyDays: 3, updatedAt: timestamp, ...overrides });

test("legacy workspace JSON remains exact and tutor fields have no implicit defaults", () => {
  const data = workspace();
  const parsed = workspaceSchema.parse(data);
  assert.deepEqual(parsed, data);
  assert.equal(Object.hasOwn(parsed, "tutorPlan"), false);
  assert.equal(Object.hasOwn(parsed, "cardReviewDays"), false);
  const result = insights(parsed);
  assert.equal(result.plan, null);
  assert.deepEqual(result.cards, { reviewed: 0, known: 0, days: 0 });
  assert.deepEqual(result.history, []);
  assert.deepEqual(workspaceSchema.parse(JSON.parse(JSON.stringify(parsed))), data);
});

test("tutor plans validate actual Gregorian dates, bounded goals, days and ISO timestamps", () => {
  assert.equal(tutorPlanSchema.safeParse(plan()).success, true);
  assert.equal(tutorPlanSchema.safeParse(plan({ targetDate: "2028-02-29" })).success, true);
  assert.equal(tutorPlanSchema.safeParse(plan({ targetDate: null, goal: "", weeklyDays: 7 })).success, true);
  for (const invalid of [
    { targetDate: "2026-02-29" }, { targetDate: "2026-04-31" }, { targetDate: "2026-13-01" },
    { targetDate: "2026-00-10" }, { targetDate: "2026-10-00" }, { targetDate: "0000-01-01" },
    { targetDate: "2026-1-01" }, { targetDate: "2026-10-10T00:00:00.000Z" },
    { goal: "a".repeat(301) }, { weeklyDays: 0 }, { weeklyDays: 8 }, { weeklyDays: 2.5 }, { updatedAt: "today" },
  ]) assert.equal(tutorPlanSchema.safeParse(plan(invalid)).success, false, JSON.stringify(invalid));
});

test("card day validation requires complete nonnegative counts and unique date plus collection", () => {
  const day = { date: "2026-10-10", collectionId: null, reviewed: 2, known: 1 };
  assert.equal(cardReviewDaySchema.safeParse(day).success, true);
  for (const invalid of [{ date: "2026-02-30" }, { reviewed: -1 }, { reviewed: 1.5 }, { known: 3 }, { known: -1 }, { collectionId: "has spaces" }]) {
    assert.equal(cardReviewDaySchema.safeParse({ ...day, ...invalid }).success, false);
  }
  assert.equal(workspaceSchema.safeParse(workspace([], { cardReviewDays: [day, day] })).success, false);
  assert.equal(workspaceSchema.safeParse(workspace([], { cardReviewDays: [day, { ...day, collectionId: "deleted-collection" }] })).success, true, "Historical references survive collection deletion");
  assert.equal(workspaceSchema.safeParse(workspace([], { cardReviewDays: Array.from({ length: 3001 }, (_, index) => ({ ...day, collectionId: `c${index}` })) })).success, false);
});

test("card ratings increment one immutable daily bucket per collection in Berlin", () => {
  const data = workspace();
  const before = structuredClone(data);
  const first = recordCardReview(data, { collectionId: "alpha", known: true }, new Date("2026-10-10T22:01:00.000Z"));
  const second = recordCardReview(first, { collectionId: "alpha", known: false }, new Date("2026-10-11T06:00:00.000Z"));
  const third = recordCardReview(second, { collectionId: null, known: true }, new Date("2026-10-11T07:00:00.000Z"));
  assert.deepEqual(data, before);
  assert.deepEqual(first.cardReviewDays, [{ date: "2026-10-11", collectionId: "alpha", reviewed: 1, known: 1 }]);
  assert.deepEqual(second.cardReviewDays, [{ date: "2026-10-11", collectionId: "alpha", reviewed: 2, known: 1 }]);
  assert.deepEqual(third.cardReviewDays, [second.cardReviewDays[0], { date: "2026-10-11", collectionId: null, reviewed: 1, known: 1 }]);
  assert.equal(workspaceSchema.safeParse(third).success, true);
});

test("daily tracking retains the latest 3000 buckets without mutating old entries", () => {
  const cardReviewDays = Array.from({ length: 3000 }, (_, index) => ({
    date: new Date(Date.parse("2010-01-01T00:00:00.000Z") + index * 86400000).toISOString().slice(0, 10), collectionId: null, reviewed: 1, known: 0,
  }));
  const data = workspace([], { cardReviewDays });
  const result = recordCardReview(data, { collectionId: null, known: true }, new Date(timestamp));
  assert.equal(result.cardReviewDays.length, 3000);
  assert.equal(result.cardReviewDays[0].date, "2010-01-02");
  assert.equal(result.cardReviewDays.at(-1).date, "2026-10-10");
  assert.equal(data.cardReviewDays[0].date, "2010-01-01");
});

test("finished quiz history respects collection containment and selected subject", () => {
  const a = question("a"), b = question("b"), foreign = question("foreign", { subject: "Softwareentwicklung" });
  const data = workspace([a, b, foreign], {
    learningCollections: [collection("alpha", [a.id, foreign.id]), collection("beta", [b.id])],
    quizRuns: [run("legacy-contained", [a]), run("partial-overlap", [a, b]), run("explicit-alpha", [b], timestamp, { collectionId: "alpha" }),
      run("explicit-beta", [a], timestamp, { collectionId: "beta" }), run("different-subject", [foreign], timestamp, { collectionId: "alpha" })],
  });
  assert.deepEqual(insights(data, "alpha").history.map(item => item.runId).sort(), ["explicit-alpha", "legacy-contained"]);
  assert.equal(insights(data, "alpha", null).history.length, 3);
  assert.deepEqual(insights(data, "deleted").history, []);
  assert.equal(insights(data, "deleted").coverage.total, 0);
});

test("history grades unanswered questions against the complete saved round and sorts by finish", () => {
  const a = question("a"), b = question("b");
  const early = run("early", [a], "2026-10-08T10:00:00.000Z", { finishedAt: "2026-10-10T11:00:00.000Z" });
  const partial = run("partial", [a, b], "2026-10-10T10:00:00.000Z", { answers: early.answers });
  const pending = run("pending", [a], timestamp, { finishedAt: null });
  const future = run("future", [a], "2026-10-11T10:00:00.000Z");
  const result = insights(workspace([a, b], { quizRuns: [partial, pending, early, future] }));
  assert.deepEqual(result.history.map(item => item.runId), ["early", "partial"]);
  assert.deepEqual([result.history[1].correct, result.history[1].total, result.history[1].percent], [1, 2, 50]);
});

test("improvement compares only identical tasks, solution, level, mode and concept condition", () => {
  const q = question();
  const older = wrong(run("older", [q], "2026-10-08T10:00:00.000Z"));
  const latest = run("latest", [{ ...q, options: [...q.options].reverse() }]);
  const result = insights(workspace([q], { quizRuns: [older, latest] })).history[0];
  assert.deepEqual([result.previousRunId, result.previousPercent, result.change], ["older", 0, 100]);
  for (const changed of [
    { questions: [question("different")] }, { questions: [{ ...q, prompt: "Ein anderes Problem" }] },
    { questions: [{ ...q, difficulty: 2 }] }, { questions: [{ ...q, concept: "Planung" }] },
    { questions: [{ ...q, options: q.options.map(o => ({ ...o, text: o.text + " geändert" })) }] },
    { questions: [{ ...q, correctOptionIds: ["no"] }] }, { mode: "exam" }, { preparationConcept: q.concept },
  ]) {
    const current = insights(workspace([q], { quizRuns: [{ ...older, ...changed }, latest] })).history[0];
    assert.equal(current.previousPercent, null, JSON.stringify(changed));
    assert.equal(current.change, null);
  }
});

test("learning comparisons require known archived wording and reject edited or unavailable snapshots", () => {
  const q = question();
  const older = wrong(run("older", [q], "2026-10-08T10:00:00.000Z"));
  const latest = run("latest", [q]);
  const compacted = compactQuizRuns(workspace([q], { quizRuns: [older, latest] }), undefined, 1);
  assert.equal(compacted.quizRuns[0].questions[0].prompt, ARCHIVED_TEXT);
  assert.equal(insights(compacted).history[0].change, null, "Fully compacted wording cannot prove a matching task");
  const retainedWording = { ...compacted, quizRuns: [{ ...older, questions: [{ ...q, explanation: ARCHIVED_EXPLANATION }] }, latest] };
  assert.equal(insights(retainedWording).history[0].change, 100, "Archived explanations do not invalidate explicitly retained question wording");
  const edited = { ...q, prompt: "Eine neu formulierte Aufgabe" };
  const next = run("next", [edited], "2026-10-10T11:00:00.000Z");
  const saved = compactQuizRuns({ ...compacted, quizQuestions: [edited], quizRuns: [...compacted.quizRuns, next] }, compacted, 1);
  assert.equal(saved.quizRuns[0].questions[0].prompt, q.prompt, "Old task wording is retained on a bank edit");
  assert.equal(insights(saved).history[0].change, null, "Edited tasks never masquerade as better results");
  assert.equal(insights({ ...compacted, quizQuestions: [] }).history[0].change, null, "Unknown archived wording cannot prove equivalence");
});

test("a direct import of an edited bank cannot turn unknown archived answers into mastery or improvement", () => {
  const q = question();
  const older = run("older", [q], "2026-10-08T10:00:00.000Z");
  const unrelated = question("unrelated", { concept: "Risiken" });
  const compacted = compactQuizRuns(workspace([q, unrelated], { quizRuns: [older, run("other", [unrelated], "2026-10-09T10:00:00.000Z")] }), undefined, 1);
  assert.equal(compacted.quizRuns[0].questions[0].prompt, ARCHIVED_TEXT);
  const edited = { ...q, prompt: "Eine ganz andere Aufgabenstellung unter derselben ID" };
  const imported = workspaceSchema.parse({ ...compacted, quizQuestions: [edited, unrelated] });
  const result = insights(imported);
  assert.deepEqual(result.coverage.areas.find(area => area.concept === q.concept), {
    subject, concept: q.concept, covered: false, secure: false, answered: 0, correct: 0, total: 1,
  });
  assert.equal(result.continuity.weeklyActiveDays, 2, "Actual archived learning activity remains recorded");
  const repeated = { ...imported, quizRuns: [...imported.quizRuns, wrong(run("edited-repeat", [edited]))] };
  assert.equal(insights(repeated).history[0].change, null, "The old wording cannot establish a matching previous result");
});

test("a paused round from a removed collection never borrows global quiz or card evidence", () => {
  const q = question();
  const data = workspace([q], {
    cards: [{ id: "c", question: "Frage", answer: "Antwort", noteId: null, dueAt: timestamp, intervalDays: 0, reviews: 0 }],
    quizRuns: [run("unrelated", [q])],
    flashcardSession: { id: "saved-cards", collectionId: "deleted", mode: "due", queue: [{ id: "c", reviews: 0, dueAt: timestamp }], index: 0, startedAt: timestamp, updatedAt: timestamp },
    cardReviewDays: [{ date: "2026-10-10", collectionId: "other", reviewed: 99, known: 99 }, { date: "2026-10-09", collectionId: "deleted", reviewed: 2, known: 1 }],
  });
  assert.equal(workspaceSchema.safeParse(data).success, true);
  const recommendation = recommendLearning(data, now);
  assert.equal(recommendation.collectionId, null);
  assert.equal(recommendation.primaryAction.kind, "resume-cards");
  const result = tutorInsights(data, recommendation, now);
  assert.deepEqual(result.history, []);
  assert.deepEqual(result.coverage, { covered: 0, secure: 0, total: 0, areas: [] });
  assert.deepEqual(result.cards, { reviewed: 2, known: 1, days: 1 });
  assert.equal(result.continuity.weeklyActiveDays, 2, "Continuity intentionally remains global");
});

test("an active quiz from a removed collection keeps unrelated mastery and results outside its scope", () => {
  const q = question();
  const data = workspace([q], {
    quizRuns: [run("unrelated", [q]), run("saved-quiz", [q], "2026-10-10T11:00:00.000Z", { collectionId: "deleted", finishedAt: null })],
    cardReviewDays: [{ date: "2026-10-10", collectionId: "other", reviewed: 99, known: 99 }, { date: "2026-10-09", collectionId: "deleted", reviewed: 3, known: 1 }],
  });
  assert.equal(workspaceSchema.safeParse(data).success, true);
  const recommendation = recommendLearning(data, now);
  assert.equal(recommendation.collectionId, null);
  assert.equal(recommendation.primaryAction.kind, "resume-quiz");
  const result = tutorInsights(data, recommendation, now);
  assert.deepEqual(result.history, []);
  assert.deepEqual(result.coverage, { covered: 0, secure: 0, total: 0, areas: [] });
  assert.deepEqual(result.cards, { reviewed: 3, known: 1, days: 1 });
  assert.equal(result.continuity.weeklyActiveDays, 2);
});

test("coverage uses latest valid task evidence and secure means every current task is correct", () => {
  const a = question("a"), b = question("b", { difficulty: 2 }), c = question("c", { concept: "Risiken" });
  const data = workspace([a, b, c], { quizRuns: [run("basic", [a]), wrong(run("application", [b])), run("risk", [c])] });
  const result = insights(data).coverage;
  assert.deepEqual([result.covered, result.secure, result.total], [2, 1, 2]);
  assert.deepEqual(result.areas[0], { subject, concept: "Ziele", covered: true, secure: false, answered: 2, correct: 1, total: 2 });
  const repaired = { ...data, quizRuns: [...data.quizRuns, run("repaired", [b], "2026-10-10T11:00:00.000Z")] };
  assert.equal(insights(repaired).coverage.secure, 2);
  const changed = { ...repaired, quizQuestions: [{ ...a, prompt: "Neu formuliert" }, b, c] };
  assert.deepEqual([insights(changed).coverage.areas[0].answered, insights(changed).coverage.secure], [1, 1]);
});

test("unfinished practice counts actual answers while unfinished exams and empty starts add no evidence", () => {
  const a = question("a"), b = question("b", { concept: "Risiken" });
  const data = workspace([a, b], { quizRuns: [
    run("practice", [a], "2026-10-09T09:00:00.000Z", { finishedAt: null }),
    run("exam", [b], "2026-10-10T09:00:00.000Z", { mode: "exam", finishedAt: null }),
    run("start", [a], "2026-10-08T09:00:00.000Z", { answers: [], finishedAt: null }),
  ] });
  const result = insights(data);
  assert.deepEqual(result.history, []);
  assert.deepEqual([result.coverage.covered, result.coverage.secure], [1, 1]);
  assert.equal(result.continuity.weeklyActiveDays, 1);
  assert.equal(result.continuity.days.find(day => day.date === "2026-10-09").quizAnswers, 1);
  assert.equal(result.continuity.days.find(day => day.date === "2026-10-10").active, false);
});

test("continuity tracks global answer and card activity, deduplicates dates and keeps scopes honest", () => {
  const q = question();
  const data = workspace([q], {
    learningCollections: [collection("alpha", [q.id])],
    quizRuns: [run("mon", [q], "2026-10-05T10:00:00.000Z", { collectionId: "other" }), run("fri", [q], "2026-10-09T10:00:00.000Z")],
    cardReviewDays: [
      { date: "2026-10-06", collectionId: null, reviewed: 1, known: 0 }, { date: "2026-10-07", collectionId: "alpha", reviewed: 2, known: 1 },
      { date: "2026-10-09", collectionId: "alpha", reviewed: 3, known: 2 }, { date: "2026-10-09", collectionId: "other", reviewed: 1, known: 1 },
      { date: "2026-10-10", collectionId: "other", reviewed: 0, known: 0 }, { date: "2026-10-11", collectionId: "alpha", reviewed: 10, known: 10 },
    ],
  });
  const result = insights(data, "alpha");
  assert.deepEqual(result.cards, { reviewed: 5, known: 3, days: 2 });
  assert.deepEqual([result.continuity.weeklyActiveDays, result.continuity.currentStreak, result.continuity.bestStreak], [4, 1, 3]);
  assert.equal(result.continuity.days[0].date, "2026-10-05");
  assert.deepEqual(result.continuity.days.at(-1), { date: "2026-10-11", active: false, isFuture: true, quizAnswers: 0, cardReviews: 0 });
  assert.deepEqual(insights(data).cards, { reviewed: 7, known: 4, days: 3 });
});

test("legacy card totals never invent activity dates or remembered ratings", () => {
  const data = workspace([], { cards: [{ id: "legacy", question: "Frage", answer: "Antwort", noteId: null, dueAt: timestamp, intervalDays: 7, reviews: 100 }] });
  const result = insights(data);
  assert.deepEqual(result.cards, { reviewed: 0, known: 0, days: 0 });
  assert.equal(result.continuity.weeklyActiveDays, 0);
  assert.equal(result.continuity.bestStreak, 0);
});

test("Berlin dates handle local midnight and both daylight-saving transitions", () => {
  for (const [time, expected] of [
    ["2026-10-10T21:59:59.000Z", "2026-10-10"], ["2026-10-10T22:00:00.000Z", "2026-10-11"],
    ["2026-03-28T23:30:00.000Z", "2026-03-29"], ["2026-03-29T01:30:00.000Z", "2026-03-29"],
    ["2026-03-29T22:00:00.000Z", "2026-03-30"], ["2026-10-25T00:30:00.000Z", "2026-10-25"],
    ["2026-10-25T01:30:00.000Z", "2026-10-25"], ["2026-10-25T23:00:00.000Z", "2026-10-26"],
  ]) assert.equal(tutorDate(new Date(time)), expected, time);
  for (const [time, previous, current, target] of [
    ["2026-03-29T22:30:00.000Z", "2026-03-29", "2026-03-30", "2026-03-31"],
    ["2026-10-25T23:30:00.000Z", "2026-10-25", "2026-10-26", "2026-10-27"],
  ]) {
    const data = workspace([], { tutorPlan: plan({ targetDate: target }), cardReviewDays: [previous, current].map(date => ({ date, collectionId: null, reviewed: 1, known: 1 })) });
    const result = insights(data, null, null, Date.parse(time));
    assert.deepEqual([result.continuity.currentStreak, result.continuity.bestStreak, result.plan.daysRemaining], [2, 2, 1]);
    assert.equal(result.continuity.days[0].date, current, "A Monday starts a fresh calendar week across DST");
    assert.equal(result.continuity.weeklyActiveDays, 1);
  }
});

test("plan progress uses the Berlin calendar week and preserves a past target as overdue", () => {
  const data = workspace([], { tutorPlan: plan({ targetDate: "2026-10-09", weeklyDays: 2 }), cardReviewDays: ["2026-10-05", "2026-10-06", "2026-10-07"].map(date => ({ date, collectionId: null, reviewed: 1, known: 0 })) });
  const before = structuredClone(data);
  const result = insights(data);
  assert.deepEqual(result.plan, { goal: data.tutorPlan.goal, targetDate: "2026-10-09", weeklyDays: 2, daysRemaining: -1, weeklyRemaining: 0, weeklyPercent: 100 });
  assert.deepEqual(data, before, "Insights never save or alter a plan");
  assert.equal(insights({ ...data, tutorPlan: plan({ targetDate: null }) }).plan.daysRemaining, null);
});

test("future imported answers cannot claim current understanding or streaks", () => {
  const q = question();
  const practice = run("practice", [q], timestamp, { finishedAt: null, answers: run("future", [q], "2026-10-10T14:00:00.000Z").answers });
  const result = insights(workspace([q], { quizRuns: [practice] }));
  assert.equal(result.coverage.covered, 0);
  assert.equal(result.continuity.weeklyActiveDays, 0);
});

const adaptiveFixture = () => {
  const notes = Array.from({ length: 10 }, (_, index) => ({
    id: `n${index + 1}`, title: `Gedanke ${index + 1}`, summary: "", content: "Erklärung", topicId: null,
    tags: [], relatedIds: [], favorite: false, archived: false, createdAt: timestamp, updatedAt: timestamp,
  }));
  const cards = notes.map((note, index) => ({
    id: `c${index + 1}`, question: `Kartenfrage ${index + 1}`, answer: `Kartenantwort ${index + 1}`,
    noteId: note.id, dueAt: timestamp, intervalDays: 0, reviews: 0,
  }));
  const questions = notes.map((note, index) => question(`q${index + 1}`, { noteIds: [note.id], concept: note.title }));
  return workspace(questions, {
    notes, cards, learningCollections: [collection("adaptive", questions.map(q => q.id), { noteIds: notes.map(note => note.id), cardIds: cards.map(card => card.id) })],
    learningFocus: { collectionId: "adaptive", subject, updatedAt: timestamp },
  });
};
const rateCards = (data, indexes = [1, 2, 3, 4, 5], overrides = {}) => indexes.reduce((current, card, index) => recordCardReview(current, {
  collectionId: "adaptive", sessionId: "card-session", cardId: `c${card}`, known: card !== 5, ...overrides,
}, new Date(Date.parse(timestamp) + card * 60_000 + index)), data);
const pendingCheckpoint = data => tutorCardCheckpoint(data, "card-session", now);

test("individual review events are additive, bounded and validate durable decision markers", () => {
  const data = rateCards(adaptiveFixture());
  const parsed = workspaceSchema.parse(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(parsed, data);
  assert.equal(Object.hasOwn(workspaceSchema.parse(workspace()), "cardReviewEvents"), false);
  assert.equal(Object.hasOwn(workspaceSchema.parse(workspace()), "tutorCheckpointDecisions"), false);
  const event = data.cardReviewEvents[0];
  assert.equal(cardReviewEventSchema.safeParse(event).success, true);
  for (const invalid of [{ cardId: "missing id" }, { sessionId: "" }, { known: "yes" }, { reviewedAt: "yesterday" }, { contentFingerprint: "12345678" }, { contentFingerprint: "g".repeat(16) }]) {
    assert.equal(cardReviewEventSchema.safeParse({ ...event, ...invalid }).success, false, JSON.stringify(invalid));
  }
  assert.equal(workspaceSchema.safeParse({ ...data, cardReviewEvents: [event, event] }).success, false);
  const historical = { ...event, cardId: "deleted-card", noteId: "deleted-note", collectionId: "deleted-collection" };
  assert.equal(workspaceSchema.safeParse(workspace([], { cardReviewEvents: [historical] })).success, true, "Historical references remain portable after source deletion");
  const decision = { sessionId: event.sessionId, reviewedAt: event.reviewedAt, decision: "later", decidedAt: new Date(now).toISOString() };
  assert.equal(tutorCheckpointDecisionSchema.safeParse(decision).success, true);
  for (const invalid of [{ decision: "never" }, { reviewedAt: "today" }, { decidedAt: "2026-10-09T00:00:00.000Z" }]) {
    assert.equal(tutorCheckpointDecisionSchema.safeParse({ ...decision, ...invalid }).success, false);
  }
  assert.equal(workspaceSchema.safeParse({ ...data, tutorCheckpointDecisions: [decision, decision] }).success, false);
  assert.equal(workspaceSchema.safeParse({ ...data, cardReviewEvents: Array.from({ length: 1501 }, (_, index) => ({ ...event, sessionId: `s${index}` })) }).success, false);
  assert.equal(workspaceSchema.safeParse({ ...data, tutorCheckpointDecisions: Array.from({ length: 301 }, (_, index) => ({ ...decision, sessionId: `s${index}` })) }).success, false);
});

test("rating snapshots use the actual current card without inferring events from legacy totals", () => {
  const data = adaptiveFixture(), before = structuredClone(data);
  const rated = recordCardReview(data, { collectionId: "adaptive", cardId: "c1", sessionId: "saved", known: false, noteId: "invented-note" }, new Date(timestamp));
  assert.deepEqual(data, before);
  assert.equal(rated.cardReviewEvents[0].noteId, "n1");
  assert.equal(rated.cardReviewEvents[0].known, false);
  assert.match(rated.cardReviewEvents[0].contentFingerprint, /^[a-f0-9]{16}$/);
  assert.equal(recordCardReview(data, { collectionId: "adaptive", known: true }, new Date(timestamp)).cardReviewEvents, undefined);
  assert.equal(recordCardReview(data, { collectionId: "adaptive", cardId: "deleted", sessionId: "saved", known: true }, new Date(timestamp)).cardReviewEvents, undefined);
  assert.equal(recordCardReview(data, { collectionId: "adaptive", cardId: "c1", known: true }, new Date(timestamp)).cardReviewEvents, undefined);
  const legacy = { ...data, cards: data.cards.map(card => ({ ...card, reviews: 100 })), cardReviewDays: [{ date: "2026-10-10", collectionId: "adaptive", reviewed: 500, known: 400 }] };
  assert.equal(pendingCheckpoint(legacy), null);
});

test("the fifth actual linked card rating offers a short checkpoint and prioritizes uncertainty", () => {
  const data = rateCards(adaptiveFixture(), [1, 2, 3, 4]);
  assert.equal(pendingCheckpoint(data), null);
  const fifth = rateCards(data, [5]);
  const checkpoint = pendingCheckpoint(fifth);
  assert.deepEqual(checkpoint.action.questionIds, ["q5", "q1", "q2"]);
  assert.deepEqual([checkpoint.reviewedCount, checkpoint.knownCount, checkpoint.action.questionCount], [5, 4, 3]);
  assert.equal(checkpoint.action.collectionId, "adaptive");
  assert.equal(checkpoint.action.subject, subject);
  assert.equal(checkpoint.reviewedAt, fifth.cardReviewEvents.at(-1).reviewedAt);
  assert.deepEqual(checkpoint.action.cardCheckpoint, { sessionId: "card-session", reviewedAt: checkpoint.reviewedAt });
  assert.deepEqual(checkpoint.concepts, ["Gedanke 5", "Gedanke 1", "Gedanke 2"]);
  assert.equal(fifth.tutorCheckpointDecisions, undefined, "An offer itself saves no acceptance or dismissal");
});

test("card checkpoints use fingerprint-validated legacy links and preserve explicit source choices", () => {
  const q = question("legacy-audited-project-checkpoint", {
    subject: projectManagementLearning.subject, concept: "Projektstart und Stakeholder",
    prompt: "Welche Angaben machen einen Projektauftrag für die Beteiligten überprüfbar?",
  });
  const previous = projectManagementLearning.questions[q.id];
  projectManagementLearning.questions[q.id] = { fingerprint: learningQuestionFingerprint(q), noteIds: ["n5"], visualHints: [] };
  try {
    const fixture = adaptiveFixture();
    const data = rateCards({
      ...fixture, quizQuestions: [q],
      learningFocus: { ...fixture.learningFocus, subject: q.subject },
      learningCollections: [{ ...fixture.learningCollections[0], questionIds: [q.id] }],
    });
    const before = structuredClone(data);
    const checkpoint = pendingCheckpoint(data);
    assert.deepEqual(checkpoint.action.questionIds, [q.id]);
    assert.equal(checkpoint.action.subject, q.subject);
    assert.equal(checkpoint.action.questionCount, 1);
    assert.deepEqual(data, before, "The contextual test resolves audited links without editing existing questions.");
    for (const revised of [{ ...q, prompt: q.prompt + " Geändert." }, { ...q, noteIds: [] }, { ...q, noteIds: ["n10"] }]) {
      assert.equal(pendingCheckpoint({ ...data, quizQuestions: [revised] }), null, "A changed fingerprint or an explicit unrelated source cannot offer the legacy task.");
    }
  } finally {
    if (previous === undefined) delete projectManagementLearning.questions[q.id];
    else projectManagementLearning.questions[q.id] = previous;
  }
});

test("checkpoints require current explicit note links and current tasks from the same collection", () => {
  const data = rateCards(adaptiveFixture());
  const extra = question("foreign", { noteIds: ["n5"] });
  const withForeign = { ...data, quizQuestions: [...data.quizQuestions, extra], learningCollections: [...data.learningCollections, collection("other", [extra.id])] };
  assert.equal(pendingCheckpoint(withForeign).action.questionIds.includes("foreign"), false);
  const noExplicitLinks = { ...data, quizQuestions: data.quizQuestions.map(q => ({ ...q, noteIds: [] })) };
  assert.equal(pendingCheckpoint(noExplicitLinks), null, "Titles and concepts never infer a reviewed source");
  const onlyUnreviewed = { ...data, learningCollections: [collection("adaptive", ["q6"], { noteIds: data.notes.map(note => note.id), cardIds: data.cards.map(card => card.id) })] };
  assert.equal(pendingCheckpoint(onlyUnreviewed), null);
  for (const ids of [["q5"], ["q3", "q5"]]) {
    const small = { ...data, learningCollections: [{ ...data.learningCollections[0], questionIds: ids }] };
    assert.equal(pendingCheckpoint(small).action.questionCount, ids.length);
    assert.equal(pendingCheckpoint(small).action.questionIds.length, ids.length);
  }
});

test("mixed subject checkpoints prefer an eligible focus and otherwise choose one uncertain subject", () => {
  const data = rateCards(adaptiveFixture());
  const other = "Softwareentwicklung";
  const mixed = { ...data, quizQuestions: data.quizQuestions.map(q => ["q4", "q5"].includes(q.id) ? { ...q, subject: other } : q) };
  const focused = pendingCheckpoint(mixed);
  assert.equal(focused.action.subject, subject);
  assert.deepEqual(focused.action.questionIds, ["q1", "q2", "q3"]);
  const unfocused = pendingCheckpoint({ ...mixed, learningFocus: { ...mixed.learningFocus, subject: "Fachthema ohne Aufgaben" } });
  assert.equal(unfocused.action.subject, other);
  assert.deepEqual(unfocused.action.questionIds, ["q5", "q4"]);
  const foreignFocus = pendingCheckpoint({ ...mixed, learningFocus: { ...mixed.learningFocus, collectionId: "other", subject } });
  assert.equal(foreignFocus.action.subject, other, "A different collection's subject focus cannot shape this checkpoint");
});

test("card checkpoints cover several reviewed concepts and rotate toward less-used matching tasks", () => {
  const data = rateCards(adaptiveFixture());
  const unknownFresh = question("unknown-fresh", { concept: "Gedanke 5", noteIds: ["n5"], difficulty: 2 });
  const unknownUsed = question("unknown-used", { concept: "Gedanke 5", noteIds: ["n5"], difficulty: 1 });
  const knownFresh = question("known-fresh", { concept: "Gedanke 1", noteIds: ["n1"], difficulty: 3 });
  const unreviewed = question("unreviewed", { concept: "Gedanke 5", noteIds: ["n6"], difficulty: 1 });
  const pool = [...data.quizQuestions, unknownUsed, unknownFresh, knownFresh, unreviewed];
  const available = {
    ...data, quizQuestions: pool,
    learningCollections: [{ ...data.learningCollections[0], questionIds: pool.map(q => q.id) }],
    quizRuns: [
      run("used-before", [data.quizQuestions[4], unknownUsed, data.quizQuestions[0]], "2026-10-09T10:00:00.000Z", { collectionId: "adaptive" }),
      run("foreign-use", [unknownFresh, knownFresh], "2026-10-09T10:00:00.000Z", { collectionId: "other" }),
      run("future-use", [unknownFresh, knownFresh], "2026-10-11T10:00:00.000Z", { collectionId: "adaptive" }),
    ],
  };
  const checkpoint = pendingCheckpoint(available);
  assert.deepEqual(checkpoint.action.questionIds, ["unknown-fresh", "known-fresh", "q2"]);
  assert.equal(checkpoint.concepts.length, 3, "Several tasks in the uncertain concept cannot crowd out the other reviewed concepts");
  const selected = checkpoint.action.questionIds.map(id => pool.find(q => q.id === id));
  assert.deepEqual(selected.map(q => q.noteIds), [["n5"], ["n1"], ["n2"]]);
  assert.equal(workspaceSchema.safeParse(available).success, true);
});

test("uncertain notes remain preferred within a shared concept and spare slots use the remaining matches", () => {
  const data = rateCards(adaptiveFixture());
  const uncertain = { ...data.quizQuestions[4], concept: "Gemeinsamer Bereich" };
  const known = { ...data.quizQuestions[0], concept: "Gemeinsamer Bereich" };
  const knownExtra = question("known-extra", { concept: "Gemeinsamer Bereich", noteIds: ["n2"] });
  const pool = [known, knownExtra, uncertain];
  const available = { ...data, quizQuestions: pool, learningCollections: [{ ...data.learningCollections[0], questionIds: pool.map(q => q.id) }], quizRuns: [
    run("uncertain-used", [uncertain], "2026-10-09T10:00:00.000Z", { collectionId: "adaptive" }),
  ] };
  const checkpoint = pendingCheckpoint(available);
  assert.equal(checkpoint.action.questionIds[0], uncertain.id, "A known, unused question cannot replace the uncertain reviewed note");
  assert.equal(checkpoint.action.questionCount, 3, "Matching known tasks fill the remaining slots when only one uncertain task exists");
  assert.equal(new Set(checkpoint.action.questionIds).size, 3);
  assert.deepEqual(checkpoint.concepts, ["Gemeinsamer Bereich"]);
});

test("editing, relinking, removing or unassigning a source invalidates its reviewed evidence", () => {
  const data = rateCards(adaptiveFixture());
  const changed = [
    { cards: data.cards.filter(card => card.id !== "c1") },
    { notes: data.notes.filter(note => note.id !== "n1") },
    { cards: data.cards.map(card => card.id === "c1" ? { ...card, question: "Ein anderer Gedanke" } : card) },
    { cards: data.cards.map(card => card.id === "c1" ? { ...card, answer: "Eine andere Erklärung" } : card) },
    { cards: data.cards.map(card => card.id === "c1" ? { ...card, noteId: "n6" } : card) },
    { cards: data.cards.map(card => card.id === "c1" ? { ...card, noteId: null } : card) },
    { learningCollections: [] },
    { learningCollections: [{ ...data.learningCollections[0], noteIds: data.notes.filter(note => note.id !== "n1").map(note => note.id), cardIds: data.cards.filter(card => card.id !== "c1").map(card => card.id) }] },
  ];
  for (const edit of changed) assert.equal(pendingCheckpoint({ ...data, ...edit }), null, JSON.stringify(edit));
  const rescheduled = { ...data, cards: data.cards.map(card => ({ ...card, dueAt: "2026-10-11T12:00:00.000Z", reviews: 4, intervalDays: 1 })) };
  assert.equal(pendingCheckpoint(rescheduled).reviewedCount, 5, "Scheduling changes retain unchanged content evidence");
  assert.notEqual(tutorCardContentFingerprint({ question: "a\nb", answer: "c" }), tutorCardContentFingerprint({ question: "a", answer: "b\nc" }), "Word boundaries remain explicit");
});

test("future, expired, duplicate and cross-session or cross-collection events cannot reach the threshold", () => {
  const data = rateCards(adaptiveFixture());
  const alter = transform => ({ ...data, cardReviewEvents: data.cardReviewEvents.map((event, index) => index === 0 ? transform(event) : event) });
  assert.equal(pendingCheckpoint(alter(event => ({ ...event, reviewedAt: "2026-10-11T10:00:00.000Z" }))), null);
  assert.equal(pendingCheckpoint(alter(event => ({ ...event, reviewedAt: "2026-10-09T11:59:59.000Z" }))), null);
  assert.equal(pendingCheckpoint(alter(event => ({ ...event, sessionId: "different-session" }))), null);
  assert.equal(pendingCheckpoint(alter(event => ({ ...event, collectionId: "different-collection" }))), null);
  assert.equal(pendingCheckpoint({ ...data, cardReviewEvents: [...data.cardReviewEvents.slice(0, 4), data.cardReviewEvents[0]] }), null);
  assert.equal(pendingCheckpoint({ ...data, quizRuns: [run("active", [question()], timestamp, { finishedAt: null })] }), null);
  assert.equal(pendingCheckpoint({ ...data, cardReviewEvents: data.cardReviewEvents.map(event => ({ ...event, noteId: null })) }), null);
  assert.equal(pendingCheckpoint({ ...data, cardReviewEvents: data.cardReviewEvents.map(event => ({ ...event, collectionId: "deleted-collection" })) }), null);
});

test("the overview finds only a recent card session from the current learning focus", () => {
  const data = rateCards(adaptiveFixture());
  assert.deepEqual(tutorCardCheckpoint(data, undefined, now), pendingCheckpoint(data));
  assert.equal(tutorCardCheckpoint({ ...data, learningFocus: { ...data.learningFocus, collectionId: "other" } }, undefined, now), null);
  const nextSession = { id: "next-session", collectionId: "adaptive", mode: "all", queue: [], index: 0, startedAt: timestamp, updatedAt: timestamp };
  assert.equal(tutorCardCheckpoint({ ...data, flashcardSession: nextSession }, undefined, now), null, "A newly started session never inherits older session ratings");
  assert.equal(tutorCardCheckpoint({ ...data, flashcardSession: { ...nextSession, id: "card-session" } }, undefined, now).sessionId, "card-session");
  assert.equal(tutorCardCheckpoint(data, undefined, now + 86400000), null);
});

test("a durable later decision waits for five new ratings after reload and stale offers save nothing", () => {
  const data = rateCards(adaptiveFixture());
  const checkpoint = pendingCheckpoint(data), decisionTime = new Date("2026-10-10T10:06:00.000Z");
  const deferred = recordTutorCheckpoint(data, checkpoint, "later", decisionTime);
  assert.equal(pendingCheckpoint(deferred), null);
  const loaded = workspaceSchema.parse(JSON.parse(JSON.stringify(deferred)));
  assert.equal(pendingCheckpoint(loaded), null);
  assert.deepEqual(loaded.tutorCheckpointDecisions, [{ sessionId: "card-session", reviewedAt: checkpoint.reviewedAt, decision: "later", decidedAt: decisionTime.toISOString() }]);
  const fourMore = rateCards(loaded, [6, 7, 8, 9]);
  assert.equal(pendingCheckpoint(fourMore), null);
  const fiveMore = rateCards(fourMore, [10]);
  const next = pendingCheckpoint(fiveMore);
  assert.equal(next.reviewedCount, 5);
  assert.notEqual(next.reviewedAt, checkpoint.reviewedAt);
  assert.equal(recordTutorCheckpoint(fiveMore, checkpoint, "later", new Date(now)), fiveMore, "A stale checkpoint cannot consume new ratings");
  const nextDeferred = recordTutorCheckpoint(fiveMore, next, "later", new Date(now));
  assert.equal(nextDeferred.tutorCheckpointDecisions.length, 1, "Only the latest cooldown per session is retained");
  assert.equal(pendingCheckpoint(nextDeferred), null);
});

test("a started checkpoint and its saved quiz marker survive reload without reopening the same offer", () => {
  const data = rateCards(adaptiveFixture()), checkpoint = pendingCheckpoint(data);
  const accepted = recordTutorCheckpoint(data, checkpoint, "started", new Date(now));
  const selected = checkpoint.action.questionIds.map(id => data.quizQuestions.find(q => q.id === id));
  const exam = run("checkpoint", selected, new Date(now).toISOString(), { mode: "exam", collectionId: "adaptive", cardCheckpoint: checkpoint.action.cardCheckpoint, finishedAt: null, answers: [] });
  const loaded = workspaceSchema.parse(JSON.parse(JSON.stringify({ ...accepted, quizRuns: [exam] })));
  assert.deepEqual(loaded.quizRuns[0].cardCheckpoint, checkpoint.action.cardCheckpoint);
  assert.equal(pendingCheckpoint(loaded), null);
  assert.equal(pendingCheckpoint({ ...loaded, quizRuns: [{ ...exam, finishedAt: new Date(now + 60_000).toISOString() }] }), null);
  for (const changed of [{ mode: "practice" }, { startedAt: "2026-10-09T00:00:00.000Z" }]) {
    assert.equal(quizRunSchema.safeParse({ ...exam, ...changed }).success, false);
  }
});

test("an explicit whole-stock card session remains global while missing scopes and changed focus stay unavailable", () => {
  const data = adaptiveFixture();
  const global = rateCards({ ...data, learningFocus: { ...data.learningFocus, collectionId: null } }, [1, 2, 3, 4, 5], { collectionId: null });
  const checkpoint = pendingCheckpoint(global);
  assert.equal(checkpoint.action.collectionId, null);
  assert.equal(checkpoint.reviewedCount, 5);
  assert.deepEqual(tutorCardCheckpoint(global, undefined, now), checkpoint);
  assert.equal(tutorCardCheckpoint({ ...global, learningFocus: data.learningFocus }, undefined, now), null, "Completed global ratings are not attributed to a new focused collection");
  assert.equal(tutorCardCheckpoint({ ...global, learningFocus: undefined }, undefined, now), null, "A missing overview scope cannot borrow a completed session");
  const selected = checkpoint.action.questionIds.map(id => global.quizQuestions.find(q => q.id === id));
  const exam = run("global-checkpoint", selected, new Date(now).toISOString(), { mode: "exam", cardCheckpoint: checkpoint.action.cardCheckpoint });
  assert.equal(quizRunSchema.safeParse(exam).success, true);
  assert.equal(workspaceSchema.safeParse(global).success, true);
});

test("the event log retains 1500 actual ratings while keeping the newest source snapshot", () => {
  const data = rateCards(adaptiveFixture(), [1]), event = data.cardReviewEvents[0];
  const full = { ...data, cardReviewEvents: Array.from({ length: 1500 }, (_, index) => ({ ...event, sessionId: `past${index}` })) };
  const updated = rateCards(full, [2]);
  assert.equal(updated.cardReviewEvents.length, 1500);
  assert.equal(updated.cardReviewEvents[0].sessionId, "past1");
  assert.equal(updated.cardReviewEvents.at(-1).cardId, "c2");
  assert.equal(full.cardReviewEvents[0].sessionId, "past0");
  assert.equal(workspaceSchema.safeParse(updated).success, true);
});
