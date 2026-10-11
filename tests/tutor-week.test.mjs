import test from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace, workspaceSchema, tutorWeekSchema, quizRunSchema } from "../lib/brain/model.ts";
import { createTutorWeek, tutorWeekInsights, weekDate } from "../lib/brain/tutor-week.ts";
import { recommendLearning } from "../lib/brain/learning-resume.ts";
import { recordCardReview } from "../lib/brain/learning-tutor.ts";
import { compactQuizRuns, ARCHIVED_TEXT } from "../lib/brain/quiz.ts";
import { projectManagementLearning } from "../lib/brain/project-management-learning.ts";

const now = Date.parse("2026-10-11T08:00:00Z");
const timestamp = new Date(now).toISOString();
const subject = projectManagementLearning.subject;
function fixture(count = 16) {
  const concepts = [...projectManagementLearning.areas.map(area => area.concept), ...Array.from({ length: 8 }, (_, index) => `Zusatzbereich ${index}`)].slice(0, count);
  const notes = concepts.map((concept, index) => ({ id: `n${index}`, title: concept, summary: "", content: "Eine Erklärung.", topicId: null, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: timestamp, updatedAt: timestamp }));
  const cards = notes.flatMap(note => Array.from({ length: 8 }, (_, index) => ({ id: `c-${note.id}-${index}`, noteId: note.id, question: note.title, answer: "Ein Praxisbeispiel.", reviews: 0, intervalDays: 0, dueAt: timestamp })));
  const questions = notes.map((note, index) => ({ id: `q${index}`, subject, concept: note.title, noteIds: [note.id], difficulty: 1, prompt: `Aufgabe ${index}`, options: [{ id: "yes", text: "Richtig", feedback: "" }, { id: "no", text: "Falsch", feedback: "" }], correctOptionIds: ["yes"], explanation: "Erklärung", source: "" }));
  const collection = { id: "pm", title: "Projektmanagement", description: "", noteIds: notes.map(note => note.id), cardIds: [], questionIds: questions.map(question => question.id), pathIds: [] };
  return { ...structuredClone(emptyWorkspace), notes, cards, quizQuestions: questions, learningCollections: [collection], learningFocus: { collectionId: collection.id, subject, updatedAt: timestamp } };
}
function start(data, time = now) { return { ...data, tutorWeek: createTutorWeek(data, recommendLearning(data, time), time) }; }
const insights = (data, time = now) => tutorWeekInsights(data, recommendLearning(data, time), time);
function run(data, stage, correct = true, overrides = {}) {
  const questions = data.tutorWeek.checkpointQuestionIds.map(id => data.quizQuestions.find(question => question.id === id));
  return { id: stage, subject, collectionId: "pm", mode: "exam", startedAt: timestamp, finishedAt: timestamp, deadlineAt: null, questions, answers: questions.map(question => ({ questionId: question.id, selectedOptionIds: [correct ? "yes" : "no"], answeredAt: timestamp, reflection: "" })), tutorWeekCheckpoint: { startedOn: data.tutorWeek.startedOn, stage }, ...overrides };
}

test("a saved week survives a validated import without modifying source IDs or progress", () => {
  const data = fixture();
  const before = structuredClone(data);
  const planned = start(data);
  assert.deepEqual(data, before);
  assert.deepEqual(workspaceSchema.parse(JSON.parse(JSON.stringify(planned))), planned);
  assert.equal(planned.tutorWeek.startedOn, "2026-10-11");
  assert.equal(planned.tutorWeek.checkpointQuestionIds.length, 6);
  assert.equal(Object.hasOwn(workspaceSchema.parse(data), "tutorWeek"), false);
  assert.equal(createTutorWeek({ ...data, quizQuestions: [], learningCollections: [] }, { ...recommendLearning(data, now), collectionId: null }, now), null);
  for (const invalid of [{ startedOn: "2026-02-30" }, { checkpointQuestionIds: [] }, { checkpointQuestionIds: ["q0", "q0"] }]) assert.equal(tutorWeekSchema.safeParse({ ...planned.tutorWeek, ...invalid }).success, false);
});

test("16 project-management topics fit six days with three short sessions and adaptive review", () => {
  const data = start(fixture());
  const result = insights(data);
  assert.equal(result.days.length, 7);
  assert.deepEqual(result.days.slice(0, 5).flatMap(day => day.areas.map(area => area.concept)), projectManagementLearning.areas.slice(0, 15).map(area => area.concept));
  assert.equal(result.days[5].areas[0].concept, projectManagementLearning.areas[15].concept);
  assert.ok(result.days.every(day => day.areas.length === 3));
  assert.equal(result.extraAreas, 0);
  for (const day of result.days) for (const area of day.areas) {
    assert.equal(area.cardsAction.cardIds.length, 5);
    assert.equal(new Set(area.cardsAction.cardIds).size, 5);
    assert.ok(area.cardsAction.cardIds.every(id => data.cards.some(card => card.id === id && area.noteIds.includes(card.noteId))));
    assert.equal(area.practiceAction.tutorWeekStartedOn, data.tutorWeek.startedOn);
  }
  assert.equal(insights(start(fixture(24))).extraAreas, 6);
  assert.ok(insights(start(fixture(2))).days.every(day => day.areas.length === 2));
});

test("calendar days follow Berlin across midnight and daylight-saving changes", () => {
  const time = Date.parse("2026-10-24T22:30:00Z");
  const data = start(fixture(), time);
  assert.equal(data.tutorWeek.startedOn, "2026-10-25");
  assert.equal(weekDate(data.tutorWeek.startedOn, 6), "2026-10-31");
  assert.equal(insights(data, Date.parse("2026-10-25T23:30:00Z")).currentDay, 2);
  assert.equal(insights(data, Date.parse("2026-11-01T12:00:00Z")).ended, true);
});

test("week scope and card batches never include another collection or subject", () => {
  const data = start(fixture());
  const other = { ...data.quizQuestions[0], id: "outside", subject: "Statistik" };
  data.quizQuestions.push(other);
  data.cards.push({ ...data.cards[0], id: "outside-card", noteId: null });
  const result = insights(data);
  assert.ok(result.checkpoints.every(checkpoint => checkpoint.action.questionIds.every(id => id !== other.id)));
  assert.ok(result.areas.every(area => !area.cardsAction.cardIds.includes("outside-card")));
  assert.equal(tutorWeekInsights(data, { ...recommendLearning(data, now), subject: other.subject }, now), null);
  assert.equal(tutorWeekInsights(data, { ...recommendLearning(data, now), collectionId: null }, now), null);
  data.learningCollections = [];
  assert.equal(tutorWeekInsights(data, { ...recommendLearning(data, now), collectionId: "pm", subject }, now), null);
});

test("a final check uses the exact baseline tasks; incomplete and unrelated tests prove no completion", () => {
  const data = start(fixture());
  const result = insights(data);
  assert.deepEqual(result.checkpoints[0].action.questionIds, result.checkpoints[2].action.questionIds);
  data.quizRuns = [run(data, "baseline", false), run(data, "final", true, { finishedAt: null })];
  assert.equal(insights(data).final, null);
  data.quizRuns[1].finishedAt = timestamp;
  assert.equal(insights(data).comparable, true);
  data.quizRuns[1].questions = data.quizRuns[1].questions.map((question, index) => index === 0 ? { ...question, prompt: "Geänderte Frage" } : question);
  assert.equal(insights(data).comparable, false);
  data.quizRuns[1].tutorWeekCheckpoint.startedOn = "2026-10-10";
  assert.equal(insights(data).final, null);
  data.quizQuestions = data.quizQuestions.filter(question => question.id !== data.tutorWeek.checkpointQuestionIds[0]);
  assert.equal(insights(data).checkpoints[2].action, null);
});

test("week test metadata is validated and original wording survives more than five units", () => {
  const data = start(fixture());
  const baseline = run(data, "baseline", false);
  assert.equal(quizRunSchema.safeParse(baseline).success, true);
  for (const invalid of [{ mode: "practice" }, { tutorWeekCheckpoint: { startedOn: "2026-02-30", stage: "baseline" } }, { tutorWeekStartedOn: "2026-10-11" }]) assert.equal(quizRunSchema.safeParse({ ...baseline, ...invalid }).success, false);
  const topic = { ...run(data, "midpoint"), id: "topic", mode: "practice", questions: [data.quizQuestions[0]], answers: [baseline.answers[0]], preparationConcept: data.quizQuestions[0].concept, tutorWeekCheckpoint: undefined, tutorWeekStartedOn: data.tutorWeek.startedOn };
  data.quizRuns = [baseline, topic, ...Array.from({ length: 20 }, (_, index) => ({ ...run(data, "midpoint"), id: `practice-${index}`, tutorWeekCheckpoint: undefined }))];
  const compacted = compactQuizRuns(data);
  assert.notEqual(compacted.quizRuns[0].questions[0].prompt, ARCHIVED_TEXT);
  assert.notEqual(compacted.quizRuns[1].questions[0].prompt, ARCHIVED_TEXT);
  assert.equal(compacted.quizRuns[2].questions[0].prompt, ARCHIVED_TEXT);
  compacted.quizRuns.push(run(data, "final"));
  assert.equal(insights(compacted).comparable, true);
});

test("written card recall is durable self-assessment and never invents tested coverage", () => {
  const data = start(fixture());
  const reviewed = recordCardReview(data, { collectionId: "pm", cardId: data.cards[0].id, sessionId: "short-round", known: true, response: "  Mein eigenes Praxisbeispiel.  " }, new Date(now));
  assert.equal(reviewed.cardReviewEvents[0].response, "Mein eigenes Praxisbeispiel.");
  assert.equal(workspaceSchema.parse(reviewed).cardReviewEvents[0].response, "Mein eigenes Praxisbeispiel.");
  assert.ok(insights(reviewed).areas.every(area => area.answered === 0 && !area.secure));
  assert.equal(Object.hasOwn(data, "cardReviewEvents"), false);
});
