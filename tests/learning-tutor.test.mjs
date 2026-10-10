import test from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace, workspaceSchema, tutorPlanSchema, cardReviewDaySchema } from "../lib/brain/model.ts";
import { tutorInsights, tutorDate, recordCardReview } from "../lib/brain/learning-tutor.ts";
import { recommendLearning } from "../lib/brain/learning-resume.ts";
import { compactQuizRuns, ARCHIVED_TEXT, ARCHIVED_EXPLANATION } from "../lib/brain/quiz.ts";

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
