import test from "node:test";
import assert from "node:assert/strict";
import { workspaceSchema, normalizeTags, searchNotes, pathProgress, reviewCard } from "../lib/brain/model.ts";
import { isAllowedDiagram } from "../lib/brain/diagram.ts";
import { seedWorkspace } from "../lib/brain/seed.ts";
import { emptyWorkspace } from "../lib/brain/model.ts";
import { isCorrect, learningProfile, selectQuestions, reminderCalendar } from "../lib/brain/quiz.ts";
import { quizExamples } from "../lib/brain/quiz-examples.ts";
import { ACCESS_KEY_PATTERN, accessKeyHash, accessKeyName, bearerKey, newAccessKey } from "../lib/server/access-keys.ts";
test("seed is a valid portable workspace with no fake learning progress", () => {
  assert.equal(workspaceSchema.parse(seedWorkspace).notes.length, 6);
  assert.deepEqual(seedWorkspace.completedStepIds, []);
});
test("imports reject duplicate IDs and broken references", () => {
  const duplicate = structuredClone(seedWorkspace);
  duplicate.notes.push(duplicate.notes[0]);
  assert.equal(workspaceSchema.safeParse(duplicate).success, false);
  const broken = structuredClone(seedWorkspace);
  broken.paths[0].steps[0].noteId = "missing";
  assert.equal(workspaceSchema.safeParse(broken).success, false);
  const progress = structuredClone(seedWorkspace);
  progress.completedStepIds = ["not-a-step"];
  assert.equal(workspaceSchema.safeParse(progress).success, false);
});
test("tags are normalized and full-text search combines words and topic names", () => {
  assert.deepEqual(normalizeTags(" Lernen, lernen, , Wissen "), ["lernen", "wissen"]);
  assert.equal(searchNotes(seedWorkspace.notes, "FUNdstelle eigenes")[0].id, "understand");
  assert.equal(searchNotes(seedWorkspace.notes, "wissensarbeit", seedWorkspace.topics).length, 2);
});
test("progress survives reordering and handles an empty path", () => {
  const path = structuredClone(seedWorkspace.paths[0]);
  const completed = [path.steps[0].id];
  path.steps.reverse();
  assert.deepEqual(pathProgress(path, completed), { done: 1, total: 6, percent: 17 });
  assert.deepEqual(pathProgress({ ...path, steps: [] }, []), { done: 0, total: 0, percent: 0 });
});
test("old workspaces get cards without changing existing content", () => {
  const old = structuredClone(seedWorkspace); delete old.cards;
  assert.deepEqual(workspaceSchema.parse(old).cards, []);
  assert.equal(workspaceSchema.parse(old).notes.length, old.notes.length);
});
test("flashcards schedule atomically with stable UTC intervals", () => {
  const now = new Date("2026-10-03T12:00:00.000Z");
  let card = { id: "test-card", question: "Frage", answer: "Antwort", noteId: null, dueAt: now.toISOString(), intervalDays: 0, reviews: 0 };
  for (const interval of [1, 3, 7, 14, 30, 30]) {
    card = reviewCard(card, true, now);
    assert.equal(card.intervalDays, interval);
    assert.equal(Date.parse(card.dueAt) - now.getTime(), interval * 86400000);
  }
  card = reviewCard(card, false, now);
  assert.equal(card.reviews, 7);
  assert.equal(card.intervalDays, 0);
  assert.equal(card.dueAt, "2026-10-03T12:10:00.000Z");
  assert.equal(reviewCard(card, true, now).intervalDays, 1);
});
test("diagram boundary rejects network-capable image shapes and config", () => {
  assert.equal(isAllowedDiagram("flowchart LR\nA[Gedanke] --> B[Verstehen]"), true);
  assert.equal(isAllowedDiagram('flowchart LR\nA@{img: "https://example.com/pixel"}'), false);
  assert.equal(isAllowedDiagram('%%{init: {"securityLevel":"loose"}}%%\nflowchart LR\nA-->B'), false);
  assert.equal(isAllowedDiagram('flowchart LR\nA[<img src=x>]'), false);
});

const quizRun = (questions, selected = questions.map(q => q.correctOptionIds), overrides = {}) => ({
  id: "run-1", subject: questions[0].subject, mode: "practice", startedAt: "2026-10-06T10:00:00.000Z", deadlineAt: null, finishedAt: "2026-10-06T10:05:00.000Z", questions,
  answers: questions.map((q, index) => ({ questionId: q.id, selectedOptionIds: selected[index], answeredAt: "2026-10-06T10:01:00.000Z", reflection: "" })), ...overrides,
});
test("old workspaces gain empty quiz state and examples are a valid explicit addition", () => {
  const old = structuredClone(seedWorkspace); delete old.quizQuestions; delete old.quizRuns; delete old.learningReminders;
  const parsed = workspaceSchema.parse(old);
  assert.deepEqual(parsed.quizRuns, []); assert.deepEqual(parsed.learningReminders, []); assert.deepEqual(parsed.quizQuestions, []);
  assert.equal(workspaceSchema.safeParse({ ...parsed, quizQuestions: quizExamples }).success, true);
  assert.equal(quizExamples.length, 12);
});
test("multiple-choice grading requires exactly the complete set of correct options", () => {
  const q = quizExamples.find(q => q.correctOptionIds.length === 2);
  assert.equal(isCorrect(q, [...q.correctOptionIds].reverse()), true);
  assert.equal(isCorrect(q, q.correctOptionIds.slice(0, 1)), false);
  assert.equal(isCorrect(q, q.options.map(o => o.id)), false);
  assert.equal(isCorrect(q, []), false);
});
test("learning adapts gradually and prioritizes recent mistakes without forcing harder questions", () => {
  const q = quizExamples[0], advanced = quizExamples[1];
  const first = quizRun([q]);
  assert.equal(learningProfile([q], [first])[0].level, 1);
  const second = quizRun([q], undefined, { id: "run-2", startedAt: "2026-10-06T11:00:00.000Z" });
  assert.equal(learningProfile([q], [first, second])[0].level, 2);
  const pool = quizExamples.filter(q => q.subject === "Projektmanagement");
  const selected = selectQuestions(pool, [first, second], q.subject, "practice", 10, () => 0.5);
  assert.equal(selected.find(item => item.concept === q.concept).difficulty, 2);
  assert.equal(selected.length, 2, "Only questions at the suitable difficulty are selected");
  const wrong = quizRun([advanced], [[advanced.options.find(o => !advanced.correctOptionIds.includes(o.id)).id]], { id: "run-3", startedAt: "2026-10-06T12:00:00.000Z" });
  const profile = learningProfile(pool, [first, second, wrong]).find(p => p.concept === q.concept);
  assert.equal(profile.level, 1); assert.equal(profile.lastWrong, true); assert.equal(profile.wrong, 1);
  assert.equal(selectQuestions(pool, [first, second, wrong], q.subject, "practice", 1)[0].concept, q.concept);
  const exam = selectQuestions(pool, [], q.subject, "exam", 20, () => 0.5);
  assert.equal(exam.length, pool.length); assert.equal(new Set(exam.map(q => q.id)).size, pool.length);
  assert.deepEqual(pool[0].options, quizExamples[0].options, "Shuffling must not mutate the question bank");
});
test("exam answers affect the learning profile only after submission", () => {
  const q = quizExamples[0];
  const first = quizRun([q]);
  const exam = quizRun([q], undefined, { id: "exam", mode: "exam", finishedAt: null });
  assert.equal(learningProfile([q], [first, exam])[0].level, 1);
  assert.equal(learningProfile([q], [first, { ...exam, finishedAt: "2026-10-06T10:06:00.000Z" }])[0].level, 2);
});
test("quiz import validation rejects broken answer sets, repeated answers and concurrent runs", () => {
  const q = quizExamples[0], run = quizRun([q]);
  const valid = { ...emptyWorkspace, quizQuestions: [q], quizRuns: [run] };
  assert.equal(workspaceSchema.safeParse(valid).success, true);
  assert.equal(workspaceSchema.safeParse({ ...valid, quizQuestions: [{ ...q, correctOptionIds: ["missing"] }] }).success, false);
  assert.equal(workspaceSchema.safeParse({ ...valid, quizRuns: [{ ...run, answers: [{ ...run.answers[0], selectedOptionIds: ["missing"] }] }] }).success, false);
  assert.equal(workspaceSchema.safeParse({ ...valid, quizRuns: [{ ...run, answers: [...run.answers, ...run.answers] }] }).success, false);
  assert.equal(workspaceSchema.safeParse({ ...valid, quizRuns: [{ ...run, finishedAt: null }, { ...run, id: "another", finishedAt: null }] }).success, false);
  assert.equal(workspaceSchema.safeParse({ ...valid, quizRuns: [{ ...run, deadlineAt: "2026-10-06T09:00:00.000Z" }] }).success, false);
  assert.equal(workspaceSchema.safeParse({ ...valid, quizQuestions: [], quizRuns: [run] }).success, true, "Historical question snapshots survive bank changes");
});
test("calendar reminders escape content, use UTC and include a display alarm", () => {
  const reminder = { id: "reminder", subject: "Produkt, Projekt;\n" + "Ä".repeat(100), dueAt: "2026-10-25T09:00:00.000Z", completed: false };
  const calendar = reminderCalendar(reminder, new Date("2026-10-06T10:00:00.000Z"));
  assert.match(calendar, /DTSTART:20261025T090000Z/);
  assert.match(calendar, /DTEND:20261025T091500Z/);
  assert.match(calendar, /Produkt\\, Projekt\\;\\n/);
  assert.match(calendar, /BEGIN:VALARM/);
  for (const line of calendar.split("\r\n")) assert.ok(Buffer.byteLength(line, "utf8") <= 75);
});
test("access keys are random, stored only as hash and parsed strictly from the Authorization header", () => {
  const a = newAccessKey(), b = newAccessKey();
  assert.match(a.key, ACCESS_KEY_PATTERN);
  assert.notEqual(a.key, b.key);
  assert.equal(a.hash, accessKeyHash(a.key));
  assert.match(a.hash, /^[0-9a-f]{64}$/);
  assert.equal(a.hint, a.key.slice(-4));
  assert.equal(bearerKey(null), undefined);
  assert.equal(bearerKey("Bearer " + a.key), a.key);
  assert.equal(bearerKey("bearer  " + a.key + " "), a.key);
  assert.equal(bearerKey("Bearer nh_short"), null);
  assert.equal(bearerKey("Basic " + a.key), null);
  assert.equal(bearerKey(a.key), null);
  assert.equal(accessKeyName("  Laptop  "), "Laptop");
  assert.equal(accessKeyName(""), null);
  assert.equal(accessKeyName("x".repeat(61)), null);
  assert.equal(accessKeyName(42), null);
});
