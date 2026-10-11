import test from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace, workspaceSchema, tutorSessionSchema, quizRunSchema, tutorPlanSchema, reviewCard } from "../lib/brain/model.ts";
import { recommendLearning } from "../lib/brain/learning-resume.ts";
import { recordCardReview } from "../lib/brain/learning-tutor.ts";
import { startTutorSession, tutorSessionInsights, validateTutorSessionQuiz } from "../lib/brain/tutor-session.ts";
import { ARCHIVED_EXPLANATION, ARCHIVED_TEXT, compactQuizRuns, isCorrect } from "../lib/brain/quiz.ts";

const now = Date.parse("2026-10-11T08:00:00.000Z");
const timestamp = new Date(now).toISOString();
const subject = "Projektmanagement";
function fixture(questionsPerConcept = 3) {
  const notes = ["Grundlagen", "Stakeholder", "Planung"].map((title, index) => ({ id: `n${index}`, title, summary: "", content: "Eine nachvollziehbare Erklärung.", topicId: null, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: timestamp, updatedAt: timestamp }));
  const cards = notes.flatMap(note => Array.from({ length: 8 }, (_, index) => ({ id: `c-${note.id}-${index}`, noteId: note.id, question: `${note.title}: Frage ${index}`, answer: "Ein Praxisbeispiel.", reviews: 0, intervalDays: 0, dueAt: timestamp })));
  const quizQuestions = notes.flatMap(note => Array.from({ length: questionsPerConcept }, (_, index) => ({ id: `q-${note.id}-${index}`, subject, concept: note.title, noteIds: [note.id], difficulty: Math.min(index + 1, 3), prompt: `${note.title}: Aufgabe ${index}`, options: [{ id: "yes", text: "Richtig", feedback: "Richtig" }, { id: "no", text: "Falsch", feedback: "Falsch" }], correctOptionIds: ["yes"], explanation: "Begründung.", source: "" })));
  const collection = { id: "pm", title: subject, description: "", noteIds: notes.map(note => note.id), cardIds: [], questionIds: quizQuestions.map(question => question.id), pathIds: [] };
  return { ...structuredClone(emptyWorkspace), notes, cards, quizQuestions, learningCollections: [collection], learningFocus: { collectionId: "pm", subject, updatedAt: timestamp } };
}
const recommendation = (data, time = now) => recommendLearning(data, time);
const insights = (data, time = now + 60_000) => tutorSessionInsights(data, recommendation(data, time), time);
const start = (data, id = "guided-1", time = now) => startTutorSession(data, recommendation(data, time), id, time);
function rate(data, count = data.tutorSession.cardIds.length, known = true, time = now + 1_000) {
  let result = data;
  for (const [index, cardId] of data.tutorSession.cardIds.slice(0, count).entries()) {
    const date = new Date(time + index * 1_000);
    result = recordCardReview(result, { cardId, sessionId: data.tutorSession.id, collectionId: data.tutorSession.collectionId, known }, date);
    result = { ...result, cards: result.cards.map(card => card.id === cardId ? reviewCard(card, known, date) : card),
      flashcardSession: { ...result.flashcardSession, index: index + 1, updatedAt: date.toISOString() } };
  }
  return result;
}
function quiz(data, { correct = true, finished = true, unanswered = false } = {}) {
  const questions = data.tutorSession.questionIds.map(id => data.quizQuestions.find(question => question.id === id));
  const startedAt = new Date(now + 10_000).toISOString();
  const finishedAt = new Date(now + 20_000).toISOString();
  return { id: "quiz-1", subject: data.tutorSession.subject, collectionId: data.tutorSession.collectionId ?? undefined, mode: "exam", tutorSessionId: data.tutorSession.id,
    startedAt, deadlineAt: null, finishedAt: finished ? finishedAt : null, questions,
    answers: questions.filter((_, index) => !unanswered || index > 0).map((question, index) => ({ questionId: question.id, selectedOptionIds: [correct || index > 0 ? "yes" : "no"], answeredAt: finishedAt, reflection: "" })) };
}

test("legacy workspaces round-trip exactly; additive tutor fields validate bounded unique tasks", () => {
  const data = fixture();
  assert.deepEqual(workspaceSchema.parse(data), data);
  assert.equal(Object.hasOwn(workspaceSchema.parse(data), "tutorSession"), false);
  const session = start(data).tutorSession;
  assert.equal(tutorSessionSchema.safeParse(session).success, true);
  for (const invalid of [{ cardIds: Array.from({ length: 6 }, (_, index) => `c${index}`) }, { questionIds: ["q1", "q2", "q3", "q4"] }, { cardIds: ["c1", "c1"] }, { cardIds: [], questionIds: [] }, { subject: null }, { startedAt: "yesterday" }]) {
    assert.equal(tutorSessionSchema.safeParse({ ...session, ...invalid }).success, false);
  }
  const plan = { goal: "Prüfung vorbereiten", targetDate: null, weeklyDays: 3, updatedAt: timestamp, instructions: "Fünf Karten, dann einen kurzen Test; Lücken zuerst." };
  assert.deepEqual(tutorPlanSchema.parse(plan), plan);
  assert.equal(tutorPlanSchema.safeParse({ ...plan, instructions: "x".repeat(2001) }).success, false);
});

test("starting saves five relevant cards plus at most three adaptive tasks in one immutable revision", () => {
  const data = fixture(8);
  const before = structuredClone(data);
  const planned = start(data);
  assert.deepEqual(data, before);
  assert.equal(planned.tutorSession.cardIds.length, 5);
  assert.equal(planned.tutorSession.questionIds.length, 3);
  assert.equal(planned.tutorSession.concept, "Grundlagen");
  assert.equal(planned.tutorSession.reason, "foundation");
  assert.equal(planned.flashcardSession.id, planned.tutorSession.id);
  assert.deepEqual(planned.flashcardSession.queue.map(card => card.id), planned.tutorSession.cardIds);
  assert.ok(planned.flashcardSession.queue.every(card => data.cards.find(source => source.id === card.id).noteId === "n0"));
  assert.deepEqual(workspaceSchema.parse(JSON.parse(JSON.stringify(planned))), planned);
  assert.deepEqual(planned.completedStepIds, before.completedStepIds);
  assert.deepEqual(insights(planned).untouched, ["Grundlagen", "Stakeholder", "Planung"]);
});

test("partial cards persist across reloads and days; new starts cannot replace an open unit", () => {
  const partlyReviewed = rate(start(fixture()), 2);
  const loaded = workspaceSchema.parse(JSON.parse(JSON.stringify(partlyReviewed)));
  const continuation = insights(loaded, now + 3 * 86_400_000);
  assert.equal(continuation.phase, "cards");
  assert.deepEqual(continuation.cardProgress, { done: 2, total: 5, known: 2 });
  assert.equal(continuation.action.kind, "resume-cards");
  assert.equal(continuation.action.remaining, 3);
  assert.throws(() => start(loaded, "replacement"), /offene Tutor-Einheit/);
  assert.deepEqual(continuation.progress, { covered: 0, secure: 0, total: 3 }, "Self-assessed cards never create tested mastery");
});

test("completed cards lead to the exact saved short quiz and stale launches are rejected", () => {
  const data = rate(start(fixture()));
  const state = insights(data);
  assert.equal(state.phase, "quiz");
  assert.deepEqual(state.action.questionIds, data.tutorSession.questionIds);
  assert.equal(state.action.tutorSessionId, data.tutorSession.id);
  const run = quiz(data, { finished: false });
  assert.equal(quizRunSchema.safeParse(run).success, true);
  assert.equal(validateTutorSessionQuiz(data, run), data);
  for (const invalid of [{ tutorSessionId: "another-session" }, { collectionId: "another-collection" }, { subject: "Statistik" }, { mode: "practice" }, { questions: [run.questions[1], run.questions[0], run.questions[2]] }, { questions: run.questions.map((question, index) => index === 0 ? { ...question, prompt: "Geändert" } : question) }]) {
    assert.throws(() => validateTutorSessionQuiz(data, { ...run, ...invalid }), /Tutor-Einheit hat sich geändert/);
  }
  assert.throws(() => validateTutorSessionQuiz(start(fixture()), run), /Tutor-Einheit hat sich geändert/);
  assert.throws(() => start(data, "skip-test", now + 30_000), /offene Tutor-Einheit/);
  assert.equal(quizRunSchema.safeParse({ ...run, mode: "practice" }).success, false);
  assert.equal(quizRunSchema.safeParse({ ...run, questions: [...run.questions, { ...run.questions[0], id: "extra" }] }).success, false);
});

test("guided card and quiz association must also survive validated imports", () => {
  const data = rate(start(fixture()));
  assert.equal(workspaceSchema.safeParse({ ...data, quizRuns: [quiz(data)] }).success, true);
  assert.equal(workspaceSchema.safeParse({ ...data, flashcardSession: { ...data.flashcardSession, queue: data.flashcardSession.queue.slice(1) } }).success, false);
  const changed = { ...quiz(data), collectionId: "unrelated" };
  assert.equal(workspaceSchema.safeParse({ ...data, quizRuns: [changed] }).success, false);
  const duplicate = { ...data, quizRuns: [quiz(data)] };
  assert.throws(() => validateTutorSessionQuiz(duplicate, quiz(data, { finished: false })), /Tutor-Einheit hat sich geändert/);
});

test("a failed short test feeds repair before untouched areas and a correct repair opens the next foundation", () => {
  const prepared = rate(start(fixture()));
  const wrong = { ...prepared, quizRuns: [quiz(prepared, { correct: false })] };
  const feedback = insights(wrong);
  assert.equal(feedback.phase, "result");
  assert.equal(feedback.result.correct, 2);
  assert.equal(feedback.next.reason, "repair");
  assert.equal(feedback.next.concept, "Grundlagen");
  assert.equal(feedback.next.questionIds[0], wrong.quizRuns[0].questions[0].id);
  assert.equal(feedback.progress.secure, 0);
  const correct = { ...prepared, quizRuns: [quiz(prepared)] };
  const successful = insights(correct);
  assert.deepEqual(successful.progress, { covered: 1, secure: 1, total: 3 });
  assert.equal(successful.next.concept, "Stakeholder");
  assert.equal(successful.next.reason, "foundation");
  const next = start(correct, "guided-2", now + 30_000);
  assert.equal(next.tutorSession.concept, "Stakeholder");
  assert.equal(next.quizRuns[0].id, "quiz-1");
});

test("unanswered tasks in a finished guided quiz remain open even after an older correct answer", () => {
  const prepared = rate(start(fixture()));
  const previous = { ...quiz(prepared), id: "previous", tutorSessionId: undefined, finishedAt: timestamp, startedAt: timestamp,
    answers: quiz(prepared).answers.map(answer => ({ ...answer, answeredAt: timestamp })) };
  const data = { ...prepared, quizRuns: [previous, quiz(prepared, { unanswered: true })] };
  const state = insights(data);
  assert.equal(state.next.reason, "repair");
  assert.equal(state.next.concept, "Grundlagen");
  assert.equal(state.next.questionIds[0], data.tutorSession.questionIds[0]);
  assert.equal(state.progress.secure, 0);
  assert.equal(state.result.correct, 2);
});

test("cards-only and quiz-only collections each execute a useful bounded unit", () => {
  const original = fixture();
  const cardsOnly = { ...original, quizQuestions: [], learningCollections: original.learningCollections.map(collection => ({ ...collection, questionIds: [] })), learningFocus: { ...original.learningFocus, subject: null } };
  const startedCards = start(cardsOnly);
  assert.equal(startedCards.tutorSession.questionIds.length, 0);
  assert.equal(startedCards.tutorSession.cardIds.length, 5);
  const completed = rate(startedCards);
  const result = insights(completed);
  assert.equal(result.phase, "result");
  assert.equal(result.result, null);
  assert.equal(result.progress.total, 0);
  assert.equal(start(completed, "cards-again", now + 30_000).tutorSession.cardIds.length, 5);
  const quizOnly = { ...original, cards: [] };
  const startedQuiz = start(quizOnly);
  assert.equal(startedQuiz.flashcardSession, null);
  assert.equal(startedQuiz.tutorSession.cardIds.length, 0);
  assert.equal(insights(startedQuiz).phase, "quiz");
  assert.equal(validateTutorSessionQuiz(startedQuiz, quiz(startedQuiz, { finished: false })), startedQuiz);
});

test("a two-card collection reaches its quiz without the legacy five-rating threshold", () => {
  const original = fixture();
  const data = { ...original, cards: original.cards.filter(card => card.id === "c-n0-0" || card.id === "c-n0-1") };
  const started = start(data);
  assert.equal(started.tutorSession.cardIds.length, 2);
  assert.equal(insights(rate(started)).phase, "quiz");
});

test("changed sources and foreign or future ratings cannot prove completion or tested coverage", () => {
  const prepared = rate(start(fixture()));
  const changed = { ...prepared, cards: prepared.cards.map(card => card.id === prepared.tutorSession.cardIds[0] ? { ...card, answer: "Neu formuliert." } : card) };
  assert.equal(insights(changed).phase, "unavailable");
  const foreign = { ...prepared, cardReviewEvents: prepared.cardReviewEvents.map(event => ({ ...event, collectionId: "other" })) };
  assert.equal(insights(foreign).phase, "unavailable");
  const future = { ...prepared, cardReviewEvents: prepared.cardReviewEvents.map(event => ({ ...event, reviewedAt: new Date(now + 86_400_000).toISOString() })) };
  assert.equal(insights(future).cardProgress.done, 0);
  const result = { ...prepared, quizRuns: [quiz(prepared)] };
  const editedQuestion = { ...result, quizQuestions: result.quizQuestions.map(question => question.id === result.tutorSession.questionIds[0] ? { ...question, prompt: "Eine neue Frage." } : question) };
  assert.equal(insights(editedQuestion).progress.secure, 0);
  const futureQuiz = { ...prepared, quizRuns: [{ ...quiz(prepared), finishedAt: new Date(now + 86_400_000).toISOString() }] };
  assert.equal(insights(futureQuiz).progress.covered, 0);
});

test("unrelated saved card or quiz rounds are resumed before a new guided plan", () => {
  const original = start(fixture());
  const otherCards = { ...original, tutorSession: undefined };
  const cards = insights(otherCards);
  assert.equal(cards.phase, "resume");
  assert.equal(cards.action.sessionId, original.flashcardSession.id);
  const prepared = rate(original);
  const active = { ...prepared, quizRuns: [quiz(prepared, { finished: false })] };
  assert.equal(insights(active).action.kind, "resume-quiz");
  assert.deepEqual(insights(active).cardProgress, { done: 5, total: 5, known: 5 });
  assert.throws(() => start(active, "new-session"), /offene Tutor-Einheit/);
});

test("deleted collections stay unavailable and no selection borrows cards from a foreign subject", () => {
  const data = fixture();
  data.quizQuestions.push({ ...data.quizQuestions[0], id: "foreign", subject: "Statistik", noteIds: ["n2"] });
  const planned = start(data);
  assert.ok(planned.tutorSession.questionIds.every(id => id !== "foreign"));
  assert.ok(planned.tutorSession.cardIds.every(id => data.cards.find(card => card.id === id).noteId === "n0"));
  const missing = { ...rate(planned), learningCollections: [] };
  const state = tutorSessionInsights(missing, { ...recommendation(missing), collectionId: "pm", subject }, now + 60_000);
  assert.equal(state.phase, "unavailable");
  assert.equal(state.action, null);
  assert.equal(state.progress.total, 0);
});

test("the saved plan orders untouched areas while observed mistakes still come first", () => {
  const data = fixture();
  const tutorPlan = { goal: "Projektmanagement vorbereiten", targetDate: null, weeklyDays: 3, updatedAt: timestamp,
    conceptOrder: ["Planung", "Nicht im Bestand", "Stakeholder", "Grundlagen"] };
  const ordered = { ...data, tutorPlan };
  assert.equal(insights(ordered).proposal.concept, "Planung");
  assert.deepEqual(insights(ordered).untouched, ["Planung", "Stakeholder", "Grundlagen"]);
  assert.equal(workspaceSchema.parse(ordered).tutorPlan.conceptOrder[0], "Planung");
  assert.equal(tutorPlanSchema.safeParse({ ...tutorPlan, conceptOrder: ["Planung", "Planung"] }).success, false);
  assert.equal(tutorPlanSchema.safeParse({ ...tutorPlan, conceptOrder: ["x".repeat(161)] }).success, false);
  const prepared = rate(start(data));
  const failed = { ...prepared, tutorPlan, quizRuns: [quiz(prepared, { correct: false })] };
  assert.equal(insights(failed).next.concept, "Grundlagen");
  assert.equal(insights(failed).next.reason, "repair");
  const week = { startedOn: "2026-10-11", collectionId: "pm", subject, checkpointQuestionIds: [data.quizQuestions[0].id], topicOrder: ["Stakeholder", "Planung"] };
  assert.equal(insights({ ...data, tutorWeek: week }).proposal.concept, "Stakeholder");
  assert.equal(insights({ ...ordered, tutorWeek: week }).proposal.concept, "Planung");
});

test("more than five guided areas keep durable task evidence after compaction and later bank edits", () => {
  const original = fixture();
  const notes = Array.from({ length: 7 }, (_, index) => ({ ...original.notes[0], id: `area-note-${index}`, title: `Lernbereich ${index}` }));
  const quizQuestions = notes.flatMap(note => Array.from({ length: 3 }, (_, index) => ({ ...original.quizQuestions[index],
    id: `area-question-${note.id}-${index}`, concept: note.title, noteIds: [note.id], prompt: `${note.title}: Aufgabe ${index}` })));
  let data = { ...original, notes, cards: [], quizQuestions,
    learningCollections: [{ ...original.learningCollections[0], noteIds: notes.map(note => note.id), questionIds: quizQuestions.map(question => question.id) }] };
  for (let index = 0; index < 7; index++) {
    const time = now + index * 30_000;
    data = start(data, `long-guided-${index}`, time);
    assert.equal(data.tutorSession.concept, notes[index].title);
    const questions = data.tutorSession.questionIds.map(id => data.quizQuestions.find(question => question.id === id));
    const finishedAt = new Date(time + 10_000).toISOString();
    const run = { id: `long-quiz-${index}`, subject, collectionId: "pm", mode: "exam", tutorSessionId: data.tutorSession.id,
      startedAt: new Date(time + 1_000).toISOString(), finishedAt, deadlineAt: null, questions,
      answers: questions.map(question => ({ questionId: question.id, selectedOptionIds: ["yes"], answeredAt: finishedAt, reflection: "" })) };
    validateTutorSessionQuiz(data, { ...run, finishedAt: null, answers: [] });
    data = { ...data, quizRuns: [...data.quizRuns, run] };
  }
  const time = now + 7 * 30_000;
  assert.deepEqual(insights(data, time).progress, { covered: 7, secure: 7, total: 7 });
  const compacted = compactQuizRuns(data);
  assert.equal(compacted.quizRuns[0].questions[0].explanation, ARCHIVED_EXPLANATION);
  assert.notEqual(compacted.quizRuns[0].questions[0].prompt, ARCHIVED_TEXT);
  assert.notEqual(compacted.quizRuns[0].questions[0].options[0].text, ARCHIVED_TEXT);
  const loaded = workspaceSchema.parse(JSON.parse(JSON.stringify(compacted)));
  assert.deepEqual(insights(loaded, time).progress, { covered: 7, secure: 7, total: 7 });
  assert.deepEqual(insights(loaded, time).untouched, []);
  assert.equal(insights(loaded, time).next.reason, "refresh");

  const changedId = loaded.quizRuns[0].questions[0].id;
  const edited = compactQuizRuns({ ...loaded, quizQuestions: loaded.quizQuestions.map(question => question.id === changedId
    ? { ...question, prompt: "Eine neue Aufgabenstellung.", correctOptionIds: ["no"] } : question) }, loaded);
  const evidence = insights(edited, time);
  assert.deepEqual(evidence.progress, { covered: 7, secure: 6, total: 7 });
  assert.equal(evidence.next.concept, notes[0].title);
  assert.ok(evidence.next.questionIds.includes(changedId));
  assert.equal(edited.quizRuns[0].questions[0].prompt, data.quizRuns[0].questions[0].prompt);
  assert.equal(isCorrect(edited.quizRuns[0].questions[0], edited.quizRuns[0].answers[0].selectedOptionIds), true,
    "The historical original answer keeps its original grading after the bank changes");
});

test("deleted active collection resumes original cards and quiz without borrowing unrelated same-subject evidence", () => {
  const original = fixture();
  const started = start(original);
  const foreignQuestion = { ...original.quizQuestions[0], id: "foreign-question", concept: "Andere Sammlung", noteIds: ["n1"] };
  const unrelated = { id: "other", title: "Andere Sammlung", description: "", noteIds: ["n1"], questionIds: [foreignQuestion.id], cardIds: [], pathIds: [] };
  const oldTimestamp = new Date(now - 60_000).toISOString();
  const foreignRun = { id: "foreign-correct", subject, collectionId: unrelated.id, mode: "practice", startedAt: oldTimestamp, finishedAt: oldTimestamp, deadlineAt: null,
    questions: [foreignQuestion], answers: [{ questionId: foreignQuestion.id, selectedOptionIds: ["yes"], answeredAt: oldTimestamp, reflection: "" }] };
  const removedCollection = { ...started, learningCollections: [unrelated], quizQuestions: [...started.quizQuestions, foreignQuestion], quizRuns: [foreignRun] };
  const actualRecommendation = recommendation(removedCollection);
  assert.equal(actualRecommendation.collectionId, null, "The general recommendation preserves deleted rounds without a current collection");
  const pausedState = tutorSessionInsights(removedCollection, actualRecommendation, now + 60_000);
  assert.equal(pausedState.phase, "cards");
  assert.equal(pausedState.action.collectionId, "pm");
  assert.equal(pausedState.action.sessionId, started.flashcardSession.id);
  assert.equal(pausedState.action.remaining, 5);
  assert.equal(pausedState.proposal, null);
  assert.equal(pausedState.next, null);
  assert.deepEqual(pausedState.progress, { covered: 0, secure: 0, total: 0 });
  assert.deepEqual(pausedState.untouched, []);
  assert.deepEqual(pausedState.weakConcepts, []);
  assert.throws(() => start(removedCollection, "replacement"), /offene Tutor-Einheit/);

  const reviewed = rate(removedCollection);
  const activeRun = quiz(reviewed, { finished: false });
  const active = { ...reviewed, flashcardSession: null, quizRuns: [foreignRun, activeRun] };
  assert.equal(recommendation(active).collectionId, null);
  const activeState = insights(active);
  assert.equal(activeState.phase, "resume");
  assert.equal(activeState.action.kind, "resume-quiz");
  assert.equal(activeState.action.collectionId, "pm");
  assert.equal(activeState.action.runId, activeRun.id);
  assert.equal(activeState.proposal, null);
  assert.equal(activeState.next, null);
  assert.deepEqual(activeState.progress, { covered: 0, secure: 0, total: 0 });
  assert.deepEqual(activeState.cardProgress, { done: 5, total: 5, known: 5 });
  assert.deepEqual(active.quizRuns[1], activeRun, "Resumption does not mutate or discard original saved answers/tasks");
  assert.throws(() => start(active, "new-plan"), /offene Tutor-Einheit/);
  const legacy = { ...active, tutorSession: undefined, quizRuns: [foreignRun, { ...activeRun, tutorSessionId: undefined }] };
  const legacyState = insights(legacy);
  assert.equal(legacyState.session, null);
  assert.equal(legacyState.action.runId, activeRun.id);
  assert.equal(legacyState.proposal, null);
  assert.deepEqual(legacyState.progress, { covered: 0, secure: 0, total: 0 });
});
