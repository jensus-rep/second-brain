import test from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace, workspaceSchema, flashcardSessionSchema } from "../lib/brain/model.ts";
import { recommendLearning, recommendLearningAfterRun, resumableFlashcardSession, selectCheckpointQuestions } from "../lib/brain/learning-resume.ts";

const subject = "Agiles Projektmanagement";
const timestamp = "2026-10-10T10:00:00.000Z";
const later = "2026-10-10T11:00:00.000Z";
const now = Date.parse("2026-10-10T12:00:00.000Z");
const note = (id = "n1") => ({ id, title: "Sprintziel", summary: "Ein gemeinsamer Fokus.", content: "Ein überprüfbares Ziel vereinbaren.", topicId: null, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: timestamp, updatedAt: timestamp });
const question = (id = "q1", concept = "Sprintziel", overrides = {}) => ({ id, subject, concept, difficulty: 1, prompt: "Was unterstützt den gemeinsamen Fokus?", options: [{ id: "yes", text: "Ein gemeinsames Ziel", feedback: "Ein Ziel gibt Orientierung." }, { id: "no", text: "Isolierte Aufgaben", feedback: "Ein gemeinsamer Fokus fehlt." }], correctOptionIds: ["yes"], explanation: "Das Team vereinbart ein gemeinsames Ziel.", source: "", ...overrides });
const card = (id = "c1", overrides = {}) => ({ id, question: "Was hilft dem Team?", answer: "Ein gemeinsames Ziel.", noteId: null, dueAt: timestamp, intervalDays: 0, reviews: 0, ...overrides });
const collection = (questions = [question()], overrides = {}) => ({ id: "agile", title: "Agiles Projektmanagement", description: "Vorbereitung", noteIds: ["n1"], questionIds: questions.map(q => q.id), cardIds: [], pathIds: [], ...overrides });
const answer = (q, correct = true, answeredAt = timestamp) => ({ questionId: q.id, selectedOptionIds: [correct ? "yes" : "no"], answeredAt, reflection: "" });
const run = (id, questions = [question()], overrides = {}) => ({ id, subject, mode: "practice", startedAt: timestamp, deadlineAt: null, finishedAt: timestamp, questions, answers: questions.map(q => answer(q)), ...overrides });
const workspace = (questions = [question()], overrides = {}) => ({ ...structuredClone(emptyWorkspace), notes: [note()], quizQuestions: questions, learningCollections: [collection(questions)], ...overrides });
const session = (cards, overrides = {}) => ({ id: "session", collectionId: "agile", mode: "due", queue: cards.map(({ id, reviews, dueAt }) => ({ id, reviews, dueAt })), index: 0, startedAt: timestamp, updatedAt: timestamp, ...overrides });

test("legacy workspaces retain exact JSON without focus or session defaults", () => {
  const legacy = workspace();
  const parsed = workspaceSchema.parse(legacy);
  assert.deepEqual(parsed, legacy);
  assert.equal(Object.hasOwn(parsed, "learningFocus"), false);
  assert.equal(Object.hasOwn(parsed, "flashcardSession"), false);
});

test("session metadata validates unique queues, integer snapshots, positions and ISO timestamps", () => {
  const saved = session([card()]);
  assert.equal(flashcardSessionSchema.safeParse(saved).success, true);
  for (const invalid of [
    { ...saved, queue: [...saved.queue, saved.queue[0]] },
    { ...saved, index: 2 },
    { ...saved, index: -1 },
    { ...saved, index: 0.5 },
    { ...saved, queue: [{ ...saved.queue[0], reviews: 1.5 }] },
    { ...saved, queue: [{ ...saved.queue[0], dueAt: "tomorrow" }] },
    { ...saved, updatedAt: "today" },
    { ...saved, queue: Array.from({ length: 3001 }, (_, index) => ({ ...saved.queue[0], id: `c${index}` })) },
  ]) assert.equal(flashcardSessionSchema.safeParse(invalid).success, false);
  assert.equal(flashcardSessionSchema.safeParse({ ...saved, index: 1 }).success, true);
});

test("historical focus and session references do not invalidate a workspace after content deletion", () => {
  const data = workspace([], { learningCollections: [], learningFocus: { collectionId: "deleted", subject, updatedAt: timestamp }, flashcardSession: session([card("deleted-card")], { collectionId: "deleted" }) });
  assert.equal(workspaceSchema.safeParse(data).success, true);
  assert.equal(resumableFlashcardSession(data), null);
});

test("legacy quiz history restores the latest subject and a fully containing collection", () => {
  const q = question();
  const data = workspace([q], { quizRuns: [run("old", [q], { subject: "Historical subject", startedAt: "2026-10-09T10:00:00.000Z" }), run("latest", [q])] });
  const before = structuredClone(data);
  const result = recommendLearning(data, now);
  assert.equal(result.collectionId, "agile");
  assert.equal(result.subject, subject);
  assert.equal(result.recentResult.runId, "latest");
  assert.deepEqual(data, before, "Recommendations must not mutate persisted history.");
});

test("a partial legacy round does not leak results, weaknesses or completion into a smaller focus", () => {
  const inside = question("inside", "Sprintziel", { noteIds: ["n1"] }), outside = question("outside", "Anderer Bereich");
  const mixed = run("mixed", [inside, outside], { answers: [answer(inside, false), answer(outside)] });
  const data = workspace([inside, outside], {
    learningCollections: [collection([inside]), collection([outside], { id: "other", title: "Weitere Sammlung" })],
    learningFocus: { collectionId: "agile", subject, updatedAt: later }, quizRuns: [mixed],
  });
  const result = recommendLearning(data, now);
  assert.equal(result.recentResult, null);
  assert.deepEqual(result.weaknesses, []);
  assert.equal(result.preparation.completed, 0);
  assert.equal(result.primaryAction.kind, "preparation");
});

test("an unfinished exam takes priority without exposing score or answer correctness", () => {
  const q = question("q1", "Sprintziel", { noteIds: ["n1"] });
  const data = workspace([q], { cards: [card()], learningCollections: [collection([q], { cardIds: ["c1"] })], quizRuns: [run("active", [q], { mode: "exam", finishedAt: null, answers: [answer(q, false)] })], flashcardSession: session([card()]) });
  const result = recommendLearning(data, now);
  assert.deepEqual(result.primaryAction, { kind: "resume-quiz", runId: "active", collectionId: "agile" });
  assert.equal(result.recentResult, null);
  assert.deepEqual(result.weaknesses, []);
  assert.equal(result.preparation.completed, 0);
});

test("a paused card round skips earlier positions, changed schedules and deleted cards", () => {
  const cards = [card("reviewed"), card("changed"), card("valid")];
  const saved = session([...cards, card("deleted")], { index: 1 });
  const data = workspace([], { cards: cards.map(c => c.id === "changed" ? { ...c, reviews: 1 } : c), learningCollections: [collection([], { cardIds: cards.map(c => c.id) })], flashcardSession: saved });
  const resumable = resumableFlashcardSession(data);
  assert.deepEqual(resumable.remaining.map(c => c.id), ["valid"]);
  assert.equal(recommendLearning(data, now).primaryAction.kind, "resume-cards");
  assert.equal(recommendLearning(data, now).primaryAction.remaining, 1);
  assert.equal(resumableFlashcardSession({ ...data, flashcardSession: { ...saved, index: saved.queue.length } }), null);
});

test("a deleted collection can resume only the original cards with unchanged snapshots", () => {
  const c = card("original"), outside = card("new-card");
  const data = workspace([], { learningCollections: [], cards: [c, outside], flashcardSession: session([c, card("missing")], { collectionId: "deleted" }) });
  assert.deepEqual(resumableFlashcardSession(data).remaining.map(item => item.id), [c.id]);
  const result = recommendLearning(data, now);
  assert.equal(result.title, "Gespeicherte Lernrunde");
  assert.equal(result.collectionId, null);
  assert.equal(result.cards.total, 1);
  assert.equal(result.primaryAction.remaining, 1);
});

test("cards removed from an existing selection do not re-enter its paused queue", () => {
  const c = card();
  const data = workspace([], { cards: [c], flashcardSession: session([c]), learningCollections: [collection([])] });
  assert.equal(resumableFlashcardSession(data), null);
  assert.notEqual(recommendLearning(data, now).primaryAction?.kind, "resume-cards");
});

test("only unresolved latest question answers recommend remediation using explicit note links", () => {
  const q = question("linked", "Sprintziel", { noteIds: ["n1"] }), unlinked = question("unlinked", "Entscheidungen");
  const old = run("old", [q, unlinked], { answers: [answer(q, false), answer(unlinked, false)] });
  const corrected = run("corrected", [q], { startedAt: later, finishedAt: later, answers: [answer(q, true, later)] });
  const data = workspace([q, unlinked], { quizRuns: [old, corrected], notes: [note(), { ...note("unrelated"), title: "Entscheidungen" }] });
  const result = recommendLearning(data, now);
  assert.deepEqual(result.weaknesses.map(item => [item.concept, item.noteIds]), [["Entscheidungen", []]]);
  assert.equal(result.primaryAction.kind, "review-concept");
  assert.equal(result.primaryAction.concept, "Entscheidungen");
  assert.deepEqual(result.primaryAction.noteIds, []);
});

test("a correct answer to another task of the same concept never hides an unresolved mistake", () => {
  const wrong = question("wrong", "Sprintziel", { noteIds: ["n1"] }), right = question("right", "Sprintziel");
  const earlier = run("earlier", [wrong], { answers: [answer(wrong, false)] });
  const laterCorrect = run("later-correct", [right], { startedAt: later, finishedAt: later, answers: [answer(right, true, later)] });
  const data = workspace([wrong, right], { quizRuns: [earlier, laterCorrect] });
  const result = recommendLearning(data, now);
  assert.deepEqual(result.weaknesses.map(item => item.questionId), [wrong.id]);
  assert.equal(result.primaryAction.kind, "review-concept");
  const next = recommendLearningAfterRun(data, laterCorrect);
  assert.equal(next.reason, "repair");
  assert.deepEqual(next.questions.map(item => item.id), [wrong.id]);
  const repaired = run("repaired", [wrong], { startedAt: "2026-10-10T11:30:00.000Z", finishedAt: "2026-10-10T11:30:00.000Z", answers: [answer(wrong, true, "2026-10-10T11:30:00.000Z")] });
  assert.deepEqual(recommendLearning({ ...data, quizRuns: [...data.quizRuns, repaired] }, now).weaknesses, []);
});

test("weaknesses collect explicit notes from every still unresolved task in a concept", () => {
  const first = question("first", "Sprintziel", { noteIds: ["n1"] }), second = question("second", "Sprintziel", { noteIds: ["n2"] });
  const wrong = run("wrong", [first, second], { answers: [answer(first, false), answer(second, false, later)] });
  const result = recommendLearning(workspace([first, second], { notes: [note("n1"), note("n2")], quizRuns: [wrong] }), now);
  assert.equal(result.weaknesses.length, 1);
  assert.deepEqual(new Set(result.weaknesses[0].noteIds), new Set(["n1", "n2"]));
});

test("work completed and cards already reviewed are counted without claiming mastery", () => {
  const first = question("q1", "Sprintziel"), second = question("q2", "Planung");
  const wrongButCompleted = run("completed", [first], { preparationConcept: first.concept, answers: [answer(first, false)] });
  const corrected = run("corrected", [first], { startedAt: later, finishedAt: later, answers: [answer(first, true, later)] });
  const data = workspace([first, second], { quizRuns: [wrongButCompleted, corrected], cards: [card("reviewed", { reviews: 4, dueAt: "2026-10-15T10:00:00.000Z" }), card("new", { dueAt: "2026-10-15T10:00:00.000Z" })], learningCollections: [collection([first, second], { cardIds: ["reviewed", "new"] })] });
  const result = recommendLearning(data, now);
  assert.deepEqual(result.preparation, { completed: 1, total: 2 });
  assert.deepEqual(result.cards, { reviewed: 1, total: 2, due: 0 });
  assert.deepEqual(result.primaryAction, { kind: "preparation", subject, concept: "Planung", collectionId: "agile" });
});

test("due cards take priority over the next new preparation unit", () => {
  const data = workspace([question()], { cards: [card()], learningCollections: [collection([question()], { cardIds: ["c1"] })] });
  assert.deepEqual(recommendLearning(data, now).primaryAction, { kind: "review-cards", mode: "due", collectionId: "agile" });
});

test("only equivalent finished rounds produce a percentage-point comparison", () => {
  const q = question(), other = question("q-other");
  const previous = run("previous", [q], { answers: [answer(q, false)] });
  const latest = run("latest", [q], { startedAt: later, finishedAt: later, answers: [answer(q, true, later)] });
  const data = workspace([q, other], { quizRuns: [previous, latest] });
  assert.deepEqual([recommendLearning(data, now).recentResult.previousPercent, recommendLearning(data, now).recentResult.change], [0, 100]);
  for (const incomparable of [
    { ...previous, mode: "exam" },
    { ...previous, preparationConcept: q.concept },
    run("different-count", [q, other], { answers: [answer(q, false), answer(other, false)] }),
    run("different-scope", [other], { answers: [answer(other, false)] }),
    run("edited-task", [{ ...q, prompt: "A different task retaining the same ID" }], { answers: [answer(q, false)] }),
    run("edited-level", [{ ...q, difficulty: 3 }], { answers: [answer(q, false)] }),
    run("edited-solution", [{ ...q, correctOptionIds: ["no"] }], { answers: [answer(q, false)] }),
  ]) {
    const result = recommendLearning({ ...data, quizRuns: [incomparable, latest] }, now).recentResult;
    assert.equal(result.previousPercent, null);
    assert.equal(result.change, null);
  }
});

test("completed short preparation continues with unseen tasks before a checkpoint", () => {
  const questions = [question("a1", "Ziele"), question("a2", "Ziele"), question("b1", "Planung"), question("c1", "Zusammenarbeit")];
  const completed = questions.filter(q => q.id !== "a2").map(q => run(`done-${q.id}`, [q], { preparationConcept: q.concept }));
  const data = workspace(questions, { quizRuns: completed });
  assert.deepEqual(recommendLearning(data, now).primaryAction, { kind: "preparation", subject, concept: "Ziele", collectionId: "agile" });
  const allAnswered = { ...data, quizRuns: [...completed, run("done-a2", [questions[1]], { preparationConcept: questions[1].concept })] };
  assert.equal(recommendLearning(allAnswered, now).primaryAction.kind, "checkpoint");
  const selected = selectCheckpointQuestions(questions, completed, subject, 3);
  assert.equal(new Set(selected.map(q => q.concept)).size, 3);
  assert.equal(selected[0].id, "a2", "The less-used question is preferred within a concept.");
  const large = Array.from({ length: 12 }, (_, index) => question(`large-${index}`, `Concept ${index}`));
  assert.equal(selectCheckpointQuestions(large, [], subject, 100).length, 6);
  assert.equal(selectCheckpointQuestions([questions[0], questions[0]], [], subject).length, 1);
  assert.deepEqual(selectCheckpointQuestions(questions, [], "Missing subject"), []);
  assert.deepEqual(selectCheckpointQuestions(questions, [], subject, 0), []);
});

test("continuation covers untouched concepts before extending a correctly completed short round", () => {
  const basic = question("basic", "Ziele"), application = question("application", "Ziele", { difficulty: 2 }), newArea = question("new-area", "Planung");
  const completed = run("completed", [basic], { preparationConcept: "Ziele" });
  const data = workspace([basic, application, newArea], { quizRuns: [completed], cards: [card()], learningFocus: { collectionId: "other-focus", subject: "Anderes Thema", updatedAt: later } });
  const before = structuredClone(data);
  const next = recommendLearningAfterRun(data, completed);
  assert.equal(next.collectionId, "agile");
  assert.equal(next.reason, "coverage");
  assert.equal(next.concept, "Planung");
  assert.deepEqual(next.questions.map(item => item.id), [newArea.id]);
  assert.deepEqual(next.progress, { covered: 1, total: 2, secure: 0 });
  assert.deepEqual(data, before, "Continuation must not mutate stored content or history.");
  const coverage = run("covered", [newArea], { startedAt: later, finishedAt: later, preparationConcept: newArea.concept, answers: [answer(newArea, true, later)] });
  const afterCoverage = recommendLearningAfterRun({ ...data, quizRuns: [...data.quizRuns, coverage] }, coverage);
  assert.equal(afterCoverage.reason, "application");
  assert.equal(afterCoverage.concept, "Ziele");
  assert.deepEqual(afterCoverage.questions.map(item => item.id), [application.id]);
  assert.deepEqual(afterCoverage.progress, { covered: 2, total: 2, secure: 1 });
});

test("continuation repairs mistakes before introducing another topic and distinguishes work from evidence", () => {
  const wrong = question("wrong", "Ziele"), unseen = question("unseen", "Planung");
  const completed = run("completed-wrong", [wrong], { preparationConcept: wrong.concept, answers: [answer(wrong, false)] });
  const next = recommendLearningAfterRun(workspace([wrong, unseen], { quizRuns: [completed] }), completed);
  assert.equal(next.reason, "repair");
  assert.equal(next.concept, "Ziele");
  assert.deepEqual(next.questions.map(item => item.id), [wrong.id]);
  assert.deepEqual(next.progress, { covered: 1, total: 2, secure: 0 });
});

test("an early finish continues unanswered tasks before introducing another concept", () => {
  const answered = question("answered", "Ziele"), skipped = question("skipped", "Ziele", { difficulty: 2 }), untouched = question("untouched", "Planung");
  const early = run("early", [answered, skipped], { answers: [answer(answered)] });
  const next = recommendLearningAfterRun(workspace([answered, skipped, untouched], { quizRuns: [early] }), early);
  assert.equal(next.reason, "repair");
  assert.equal(next.concept, "Ziele");
  assert.deepEqual(next.questions.map(item => item.id), [skipped.id]);
});

test("all current tasks need correct evidence before continuation becomes a mixed checkpoint", () => {
  const questions = [question("basic", "Ziele"), question("application", "Ziele", { difficulty: 2 }), question("transfer", "Ziele", { difficulty: 3 }), question("plan", "Planung")];
  const completed = run("completed", questions);
  const next = recommendLearningAfterRun(workspace(questions, { quizRuns: [completed] }), completed);
  assert.equal(next.reason, "checkpoint");
  assert.equal(next.action.kind, "checkpoint");
  assert.deepEqual(next.progress, { covered: 2, total: 2, secure: 2 });
  assert.equal(new Set(next.questions.map(item => item.id)).size, next.questionCount);
  assert.equal(new Set(next.questions.map(item => item.concept)).size, 2);
});

test("continuation uses current scoped history even when an older result is opened", () => {
  const q = question();
  const mistaken = run("mistaken", [q], { answers: [answer(q, false)], collectionId: "agile" });
  const corrected = run("corrected", [q], { startedAt: later, finishedAt: later, answers: [answer(q, true, later)], collectionId: "agile" });
  const next = recommendLearningAfterRun(workspace([q], { quizRuns: [mistaken, corrected] }), mistaken);
  assert.equal(next.reason, "checkpoint");
  assert.deepEqual(next.progress, { covered: 1, total: 1, secure: 1 });
});

test("continuation never borrows correct answers from another collection", () => {
  const q = question(), outside = question("outside", "Anderer Bereich");
  const mistaken = run("mistaken", [q], { answers: [answer(q, false)], collectionId: "agile" });
  const elsewhere = run("elsewhere", [q], { startedAt: later, finishedAt: later, answers: [answer(q, true, later)], collectionId: "other" });
  const data = workspace([q, outside], { quizRuns: [mistaken, elsewhere], learningCollections: [collection([q]), collection([q, outside], { id: "other" })] });
  const next = recommendLearningAfterRun(data, mistaken);
  assert.equal(next.reason, "repair");
  assert.deepEqual(next.questions.map(item => item.id), [q.id]);
  assert.deepEqual(next.progress, { covered: 1, total: 1, secure: 0 });
});

test("continuation stays inside the finished collection and covers its other subjects", () => {
  const first = question("first", "Ziele"), nextSubject = question("next-subject", "Entdeckung", { subject: "Produktmanagement" }), outside = question("outside", "Fremder Bereich");
  const completed = run("completed", [first], { collectionId: "agile" });
  const data = workspace([first, nextSubject, outside], { quizRuns: [completed], learningCollections: [collection([first, nextSubject])] });
  const next = recommendLearningAfterRun(data, completed);
  assert.equal(next.reason, "coverage");
  assert.equal(next.subject, "Produktmanagement");
  assert.deepEqual(next.questions.map(item => item.id), [nextSubject.id]);
  assert.deepEqual(next.progress, { covered: 1, total: 2, secure: 1 });
});

test("deleted, mismatched and empty collections cannot launch outside their original scope", () => {
  const q = question(), outside = question("outside", "Fremder Bereich");
  for (const [completed, data, requested] of [
    [run("deleted", [q], { collectionId: "deleted" }), workspace([outside], { learningCollections: [] }), undefined],
    [run("mismatch", [q]), workspace([q, outside], { learningCollections: [collection([outside])] }), "agile"],
    [run("empty", [q], { collectionId: "agile" }), workspace([outside], { learningCollections: [collection([])] }), undefined],
  ]) {
    const next = recommendLearningAfterRun(data, completed, requested);
    assert.equal(next.action, null);
    assert.equal(next.reason, "unavailable");
    assert.deepEqual(next.questions, []);
  }
});

test("unfinished exams never expose a continuation or correct-answer evidence", () => {
  const q = question();
  const activeExam = run("exam", [q], { mode: "exam", finishedAt: null });
  assert.equal(recommendLearningAfterRun(workspace([q], { quizRuns: [activeExam] }), activeExam), null);
});

test("edited current tasks do not inherit correct evidence from the old snapshot", () => {
  const old = question("stable-id"), edited = { ...old, prompt: "Eine neue Anwendungsfrage.", difficulty: 2 };
  const completed = run("old-round", [old]);
  const next = recommendLearningAfterRun(workspace([edited], { quizRuns: [completed] }), completed);
  assert.equal(next.reason, "coverage");
  assert.deepEqual(next.progress, { covered: 0, total: 1, secure: 0 });
  assert.equal(next.questions[0].prompt, edited.prompt);
});

test("an empty workspace has no invented scope or launch action", () => {
  const result = recommendLearning(structuredClone(emptyWorkspace), now);
  assert.equal(result.collectionId, null);
  assert.equal(result.primaryAction, null);
  assert.equal(result.recentResult, null);
  assert.deepEqual(result.preparation, { completed: 0, total: 0 });
});
