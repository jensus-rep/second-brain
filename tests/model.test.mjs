import test from "node:test";
import assert from "node:assert/strict";
import { workspaceSchema, normalizeTags, searchNotes, pathProgress, reviewCard } from "../lib/brain/model.ts";
import { isAllowedDiagram } from "../lib/brain/diagram.ts";
import { seedWorkspace } from "../lib/brain/seed.ts";
import { emptyWorkspace } from "../lib/brain/model.ts";
import { isCorrect, learningProfile, selectQuestions, reminderCalendar, compactQuizRuns, restoreQuestion, ARCHIVED_EXPLANATION, ARCHIVED_TEXT, FULL_RUNS_PER_SUBJECT } from "../lib/brain/quiz.ts";
import { quizExamples } from "../lib/brain/quiz-examples.ts";
import { ACCESS_KEY_PATTERN, accessKeyHash, accessKeyName, bearerKey, newAccessKey } from "../lib/server/access-keys.ts";
import { flattenTopics, getTopicAncestors, getTopicDescendantIds, getTopicOptionLabel, getTopicPathLabel } from "../lib/brain/topics.ts";
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

const hierarchicalTopics = [
  { id: "supervised", title: "Supervised Learning", description: "", color: "blue", parentId: "ml" },
  { id: "ai", title: "Künstliche Intelligenz", description: "", color: "purple" },
  { id: "ml", title: "Machine Learning", description: "", color: "blue", parentId: "ai" },
  { id: "unsupervised", title: "Unsupervised Learning", description: "", color: "green", parentId: "ml" },
  { id: "writing", title: "Schreiben", description: "", color: "orange", parentId: null },
];

test("topic hierarchy round-trips through workspace validation while legacy root topics stay unchanged", () => {
  const old = workspaceSchema.parse(seedWorkspace);
  assert.deepEqual(old.topics, seedWorkspace.topics);
  const workspace = { ...emptyWorkspace, topics: hierarchicalTopics };
  assert.deepEqual(workspaceSchema.parse(JSON.parse(JSON.stringify(workspace))).topics, hierarchicalTopics);
});

test("topic imports reject missing parents, self-links and cycles at every depth", () => {
  const validate = topics => workspaceSchema.safeParse({ ...emptyWorkspace, topics });
  assert.equal(validate(hierarchicalTopics).success, true);
  const missing = validate(hierarchicalTopics.map(topic => topic.id === "ml" ? { ...topic, parentId: "missing" } : topic));
  assert.equal(missing.success, false);
  assert.deepEqual(missing.error.issues[0].path, ["topics", 2, "parentId"]);
  assert.equal(validate(hierarchicalTopics.map(topic => topic.id === "ml" ? { ...topic, parentId: "ml" } : topic)).success, false);
  assert.equal(validate(hierarchicalTopics.map(topic => topic.id === "ai" ? { ...topic, parentId: "supervised" } : topic)).success, false);
});

test("topic navigation follows parents and includes all nested knowledge without crossing siblings", () => {
  assert.deepEqual(flattenTopics(hierarchicalTopics).map(({ topic, depth }) => [topic.id, depth]), [["ai", 0], ["ml", 1], ["supervised", 2], ["unsupervised", 2], ["writing", 0]]);
  assert.deepEqual(getTopicAncestors(hierarchicalTopics, "supervised").map(topic => topic.id), ["ai", "ml"]);
  assert.deepEqual(getTopicAncestors(hierarchicalTopics, "ai"), []);
  assert.deepEqual([...getTopicDescendantIds(hierarchicalTopics, "ml")].sort(), ["ml", "supervised", "unsupervised"]);
  assert.deepEqual([...getTopicDescendantIds(hierarchicalTopics, "supervised")], ["supervised"]);
  assert.deepEqual([...getTopicDescendantIds(hierarchicalTopics, "missing")], []);
  assert.equal(getTopicPathLabel(hierarchicalTopics, "unsupervised"), "Künstliche Intelligenz › Machine Learning › Unsupervised Learning");
});

test("moving a topic preserves linked notes and progress and search includes the new ancestors", () => {
  const before = structuredClone(seedWorkspace);
  const originalTopic = before.topics[0];
  const root = { id: "new-root", title: "Übergreifendes Wissen", description: "", color: "purple" };
  const moved = workspaceSchema.parse({ ...before, topics: [root, ...before.topics.map(topic => topic.id === originalTopic.id ? { ...topic, parentId: root.id } : topic)] });
  assert.deepEqual(moved.notes, before.notes);
  assert.deepEqual(moved.paths, before.paths);
  assert.deepEqual(moved.completedStepIds, before.completedStepIds);
  assert.deepEqual(moved.cards, before.cards);
  assert.deepEqual(searchNotes(moved.notes, "übergreifendes", moved.topics).map(note => note.id).sort(), before.notes.filter(note => note.topicId === originalTopic.id).map(note => note.id).sort());
});

test("hierarchy helpers safely render invalid drafts until import validation rejects them", () => {
  const cycle = hierarchicalTopics.map(topic => topic.id === "ai" ? { ...topic, parentId: "supervised" } : topic);
  assert.equal(flattenTopics(cycle).length, cycle.length);
  assert.equal(new Set(flattenTopics(cycle).map(({ topic }) => topic.id)).size, cycle.length);
  assert.ok(getTopicAncestors(cycle, "ai").length < cycle.length);
  assert.deepEqual([...getTopicDescendantIds(cycle, "ai")].sort(), ["ai", "ml", "supervised", "unsupervised"]);
});

test("the maximum supported topic depth stays traversable and option labels retain the root and nearest parents", () => {
  const topics = Array.from({ length: 100 }, (_, index) => ({ id: `topic-${index}`, title: `Thema ${index}`, description: "", color: "blue", parentId: index ? `topic-${index - 1}` : null }));
  assert.equal(workspaceSchema.safeParse({ ...emptyWorkspace, topics }).success, true);
  assert.equal(flattenTopics(topics).at(-1).depth, 99);
  assert.equal(getTopicAncestors(topics, "topic-99").length, 99);
  assert.equal(getTopicDescendantIds(topics, "topic-0").size, 100);
  assert.equal(getTopicOptionLabel(topics, "topic-99"), "Thema 0 › … › Thema 98 › Thema 99");
  assert.equal(getTopicPathLabel(topics, "topic-99").split(" › ").length, 100);
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

const historyRun = (questions, n, overrides = {}) => {
  const start = Date.parse("2026-09-01T08:00:00.000Z") + n * 3600000;
  // Every third answer picks a wrong option so the profile has mistakes to keep.
  const selected = questions.map((q, i) => (n + i) % 3 ? q.correctOptionIds : [q.options.find(o => !q.correctOptionIds.includes(o.id)).id]);
  return quizRun(questions, selected, { id: "history-" + n, startedAt: new Date(start).toISOString(), finishedAt: new Date(start + 600000).toISOString(), ...overrides });
};
const runScore = run => run.questions.filter(q => isCorrect(q, run.answers.find(a => a.questionId === q.id)?.selectedOptionIds ?? [])).length;
const wordingTrimmed = q => q.explanation === ARCHIVED_EXPLANATION && q.prompt === ARCHIVED_TEXT && q.options.every(o => o.text === ARCHIVED_TEXT && o.feedback === "") && q.source === "";
test("older finished quiz runs are trimmed per subject without changing results or the learning profile", () => {
  assert.equal(FULL_RUNS_PER_SUBJECT, 5);
  const project = quizExamples.filter(q => q.subject === "Projektmanagement"), product = quizExamples.filter(q => q.subject === "Produktmanagement");
  const software = project.map(q => ({ ...q, id: q.id.replace("example", "software"), subject: "Softwareentwicklung" }));
  // Older project runs are stored after newer ones: the age comes from startedAt, not the array order.
  const projectRuns = Array.from({ length: 12 }, (_, n) => historyRun(project, n)).reverse();
  const productRuns = Array.from({ length: 3 }, (_, n) => historyRun(product, 20 + n));
  const softwareRuns = Array.from({ length: 6 }, (_, n) => historyRun(software, 40 + n));
  const active = historyRun(project, 0, { id: "active", startedAt: "2026-08-01T08:00:00.000Z", finishedAt: null, answers: [] });
  const bank = [...quizExamples, ...software];
  const workspace = workspaceSchema.parse({ ...emptyWorkspace, quizQuestions: bank, quizRuns: [active, ...projectRuns, ...productRuns, ...softwareRuns] });
  const compacted = compactQuizRuns(workspace);
  assert.equal(workspaceSchema.safeParse(compacted).success, true);
  const trimmed = compacted.quizRuns.filter(run => run.questions.some(q => q.explanation === ARCHIVED_EXPLANATION)).map(run => run.id).sort();
  assert.deepEqual(trimmed, ["history-0", "history-1", "history-2", "history-3", "history-4", "history-40", "history-5", "history-6"], "Only the oldest finished runs beyond five per subject");
  assert.deepEqual(compacted.quizRuns.find(run => run.id === "active"), active, "A running round is never trimmed");
  for (const id of ["history-7", "history-11", "history-20", "history-41"]) assert.deepEqual(compacted.quizRuns.find(run => run.id === id), workspace.quizRuns.find(run => run.id === id));
  for (const id of trimmed) {
    const old = compacted.quizRuns.find(run => run.id === id), original = workspace.quizRuns.find(run => run.id === id);
    assert.ok(old.questions.every(wordingTrimmed), "Unchanged bank questions lose their wording in the run");
    assert.deepEqual(old.answers, original.answers);
    assert.deepEqual(old.questions.map(({ id, subject, concept, difficulty, correctOptionIds, options }) => [id, subject, concept, difficulty, correctOptionIds, options.map(o => o.id)]),
      original.questions.map(({ id, subject, concept, difficulty, correctOptionIds, options }) => [id, subject, concept, difficulty, correctOptionIds, options.map(o => o.id)]));
    assert.deepEqual(old.questions.map(q => restoreQuestion(q, bank)), original.questions, "Lossless while the bank is unchanged");
  }
  assert.deepEqual(compacted.quizRuns.map(runScore), workspace.quizRuns.map(runScore));
  assert.deepEqual(learningProfile(bank, compacted.quizRuns), learningProfile(bank, workspace.quizRuns));
  for (const subject of ["Projektmanagement", "Softwareentwicklung"]) for (const mode of ["practice", "exam"]) {
    assert.deepEqual(selectQuestions(bank, compacted.quizRuns, subject, mode, 6, () => 0.3), selectQuestions(bank, workspace.quizRuns, subject, mode, 6, () => 0.3));
  }
  assert.equal(compactQuizRuns(compacted), compacted, "Trimming is idempotent and leaves an unchanged workspace as is");
  const few = { ...workspace, quizRuns: productRuns };
  assert.equal(compactQuizRuns(few), few, "Five or fewer finished runs per subject stay complete");
});
test("trimmed runs keep their wording unless the bank holds exactly the same question", () => {
  const [q, other] = quizExamples;
  const newer = Array.from({ length: FULL_RUNS_PER_SUBJECT }, (_, n) => historyRun([q, other], n + 1));
  const edited = { ...q, prompt: q.prompt + " (überarbeitet)" };
  const result = compactQuizRuns({ ...emptyWorkspace, quizQuestions: [edited], quizRuns: [historyRun([q, other], 0), ...newer] }).quizRuns[0];
  const [changed, missing] = result.questions;
  assert.equal(changed.prompt, q.prompt, "A changed prompt keeps the old wording");
  assert.deepEqual(changed.options.map(o => o.text), q.options.map(o => o.text));
  assert.equal(changed.explanation, ARCHIVED_EXPLANATION);
  assert.equal(missing.prompt, other.prompt, "A question missing from the bank keeps its wording");
  assert.deepEqual(missing.options.map(o => o.text), other.options.map(o => o.text));
  assert.equal(restoreQuestion(changed, [edited]).prompt, q.prompt, "Kept wording is shown as it was");
});
test("trimmed wording is restored from the bank, written back on bank changes and falls back to a notice", () => {
  const [q, other] = quizExamples;
  const runs = [historyRun([q, other], 0), ...Array.from({ length: FULL_RUNS_PER_SUBJECT }, (_, n) => historyRun([q, other], n + 1))];
  const before = compactQuizRuns({ ...emptyWorkspace, quizQuestions: [q, other], quizRuns: runs });
  const [archived] = before.quizRuns[0].questions;
  assert.ok(wordingTrimmed(archived));
  assert.deepEqual(restoreQuestion(archived, [q, other]), q);
  // Edited or removed in the app: the previous bank still had the wording, so it goes back into the run.
  const edited = { ...q, prompt: "Neu formuliert", options: q.options.map(o => ({ ...o, text: o.text + "!" })) };
  for (const bank of [[edited, other], [other]]) {
    const after = compactQuizRuns({ ...before, quizQuestions: bank }, before);
    const kept = after.quizRuns[0].questions[0];
    assert.equal(kept.prompt, q.prompt); assert.deepEqual(kept.options.map(o => o.text), q.options.map(o => o.text));
    assert.equal(kept.explanation, ARCHIVED_EXPLANATION);
    assert.ok(wordingTrimmed(after.quizRuns[0].questions[1]), "Unchanged questions stay trimmed");
    assert.equal(workspaceSchema.safeParse(after).success, true);
  }
  const untouched = { ...before, quizQuestions: [q, other] };
  assert.equal(compactQuizRuns(untouched, before), untouched, "A new but equal bank keeps runs trimmed");
  // Imported runs were trimmed against the imported bank: the old local bank must not fill them in.
  const imported = { ...before, quizQuestions: [edited, other], quizRuns: before.quizRuns.map(run => ({ ...run, id: "imported-" + run.id })) };
  assert.ok(wordingTrimmed(compactQuizRuns(imported, before).quizRuns[0].questions[0]));
  // Without the previous state (e.g. a direct API write) only a notice is possible.
  const gone = restoreQuestion(archived, [other]);
  assert.match(gone.prompt, /nicht mehr verfügbar/); assert.match(gone.explanation, /letzten 5 Runden/);
  assert.ok(gone.options.every(o => /nicht mehr verfügbar/.test(o.text) && o.feedback === ""));
  const solution = restoreQuestion(archived, [{ ...q, correctOptionIds: q.options.filter(o => !q.correctOptionIds.includes(o.id)).map(o => o.id) }]);
  assert.match(solution.prompt, /nicht mehr verfügbar/, "A changed solution never shows the new wording as the old one");
  // Only the explanation was trimmed (runs trimmed before wording was dropped): explanation comes back, texts stay.
  const partly = { ...q, options: q.options.map(o => ({ ...o, feedback: "" })), explanation: ARCHIVED_EXPLANATION, source: "" };
  assert.deepEqual(restoreQuestion(partly, [q]), q);
  assert.match(restoreQuestion(partly, []).explanation, /letzten 5 Runden/); assert.equal(restoreQuestion(partly, []).prompt, q.prompt);
  assert.equal(restoreQuestion(q, []), q, "Complete questions stay untouched");
});
