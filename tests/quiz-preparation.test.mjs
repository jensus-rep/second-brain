import test from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace, quizQuestionSchema, quizRunSchema, workspaceSchema } from "../lib/brain/model.ts";
import { ARCHIVED_EXPLANATION, compactQuizRuns, isCorrect } from "../lib/brain/quiz.ts";
import { imageLearningSignature, learningQuestionFingerprint, questionLearningMaterial, withLearningNotes } from "../lib/brain/quiz-content.ts";
import { latestQuestionResults, preparationAreas, selectAdaptivePreparationQuestions, selectPreparationQuestions } from "../lib/brain/quiz-preparation.ts";
import { projectManagementLearning } from "../lib/brain/project-management-learning.ts";

const subject = "Wissensarbeit im Test";
const concept = "Qualität prüfen";
const timestamp = "2026-10-08T10:00:00.000Z";
const image = '![Qualität im Überblick](/api/media/12345678-1234-1234-1234-123456789abc "Eine illustrative Übersicht.")';

const note = (id = "quality-note", overrides = {}) => ({
  id, title: "Qualität: Erwartungen und Nachweise", summary: "Vereinbarte Kriterien prüfen.",
  content: image, topicId: null, tags: [], relatedIds: [], favorite: false, archived: false,
  createdAt: timestamp, updatedAt: timestamp, ...overrides,
});

const question = (id = "quality-question", difficulty = 1, overrides = {}) => ({
  id, subject, concept, difficulty, prompt: "Was macht ein Ergebnis überprüfbar?",
  options: [
    { id: "criteria", text: "Vereinbarte Kriterien und Nachweise", feedback: "Die Anforderungen werden überprüfbar." },
    { id: "guess", text: "Ein persönlicher Eindruck genügt", feedback: "Der Eindruck ersetzt die vereinbarte Prüfung nicht." },
  ],
  correctOptionIds: ["criteria"], explanation: "Ein gemeinsamer Standard macht die Prüfung nachvollziehbar.", source: "", ...overrides,
});

const answer = (q, selected = q.correctOptionIds) => ({
  questionId: q.id, selectedOptionIds: [...selected], answeredAt: "2026-10-08T10:02:00.000Z", reflection: "Kriterien prüfen.",
});

const run = (id, questions, overrides = {}) => ({
  id, subject: questions[0].subject, mode: "practice", preparationConcept: questions[0].concept,
  startedAt: timestamp, deadlineAt: null, finishedAt: "2026-10-08T10:05:00.000Z",
  questions, answers: questions.map(q => answer(q)), ...overrides,
});

const workspace = (questions = [question()], overrides = {}) => ({
  ...structuredClone(emptyWorkspace), notes: [note()], quizQuestions: questions, ...overrides,
});

// Synthetic mappings exercise the same audited-link path without importing or
// copying personal question wording. Each test restores its in-memory fixture.
function withCuratedFixture(q, mapping, callback, areas) {
  const previous = projectManagementLearning.questions[q.id];
  const previousAreas = projectManagementLearning.areas;
  projectManagementLearning.questions[q.id] = { fingerprint: learningQuestionFingerprint(q), ...mapping };
  if (areas) projectManagementLearning.areas = areas;
  try { return callback(); }
  finally {
    if (previous === undefined) delete projectManagementLearning.questions[q.id];
    else projectManagementLearning.questions[q.id] = previous;
    projectManagementLearning.areas = previousAreas;
  }
}

test("legacy questions and rounds retain their data without optional learning fields", () => {
  const q = question();
  const legacyRun = run("legacy-run", [q]);
  delete legacyRun.preparationConcept;
  const original = workspace([q], { quizRuns: [legacyRun] });
  const parsed = workspaceSchema.parse(original);
  assert.deepEqual(parsed, original);
  assert.equal(Object.hasOwn(parsed.quizQuestions[0], "noteIds"), false);
  assert.equal(Object.hasOwn(parsed.quizRuns[0], "preparationConcept"), false);
  assert.deepEqual(preparationAreas(parsed, subject).map(area => [area.completed, area.total]), [[false, 0]]);
});

test("question links reject duplicate, missing and over-limit note references", () => {
  assert.equal(quizQuestionSchema.safeParse(question("duplicate-links", 1, { noteIds: ["quality-note", "quality-note"] })).success, false);
  assert.equal(workspaceSchema.safeParse(workspace([question("missing-link", 1, { noteIds: ["missing-note"] })])).success, false);
  assert.equal(quizQuestionSchema.safeParse(question("many-links", 1, { noteIds: ["n1", "n2", "n3", "n4", "n5"] })).success, false);
  const linked = question("linked", 1, { noteIds: ["quality-note"] });
  assert.deepEqual(workspaceSchema.parse(workspace([linked])).quizQuestions[0].noteIds, ["quality-note"]);
  assert.deepEqual(quizQuestionSchema.parse(question("opt-out", 1, { noteIds: [] })).noteIds, []);
});

test("preparation metadata accepts a coherent practice round and rejects exam or mixed content", () => {
  const questions = [question("q1"), question("q2", 2)];
  assert.equal(quizRunSchema.safeParse(run("valid-preparation", questions)).success, true);
  assert.equal(quizRunSchema.safeParse(run("exam-preparation", questions, { mode: "exam" })).success, false);
  const otherSubject = [questions[0], question("q-other-subject", 2, { subject: "Ein anderes Fachthema" })];
  assert.equal(quizRunSchema.safeParse(run("mixed-subject", otherSubject)).success, false);
  const otherConcept = [questions[0], question("q-other-concept", 2, { concept: "Ein anderer Lernbereich" })];
  assert.equal(quizRunSchema.safeParse(run("mixed-concept", otherConcept)).success, false);
  assert.equal(quizRunSchema.safeParse(run("wrong-concept", questions, { preparationConcept: "Ein anderer Lernbereich" })).success, false);
});

test("all answers in an unfinished preparation round do not mark the area complete or reveal a score", () => {
  const questions = [question("q1"), question("q2", 2)];
  const active = run("active-preparation", questions, { finishedAt: null });
  const area = preparationAreas(workspace(questions, { quizRuns: [active] }), subject)[0];
  assert.equal(area.completed, false);
  assert.equal(area.correct, 0);
  assert.equal(area.total, 0);
});

test("early finish leaves an area open while a fully answered round marks work completed even after mistakes", () => {
  const questions = [question("q1"), question("q2", 2)];
  const early = run("early", questions, { answers: [answer(questions[0])] });
  const earlyArea = preparationAreas(workspace(questions, { quizRuns: [early] }), subject)[0];
  assert.deepEqual([earlyArea.completed, earlyArea.correct, earlyArea.total], [false, 1, 2]);
  const completedWithMistakes = run("completed-wrong", questions, { answers: questions.map(q => answer(q, ["guess"])) });
  const completedArea = preparationAreas(workspace(questions, { quizRuns: [completedWithMistakes] }), subject)[0];
  assert.deepEqual([completedArea.completed, completedArea.correct, completedArea.total], [true, 0, 2]);
});

test("the last round is determined by its date when imported history is unordered", () => {
  const questions = [question("q1"), question("q2", 2)];
  const olderComplete = run("older-complete", questions);
  const middle = run("middle", questions, {
    startedAt: "2026-10-09T10:00:00.000Z", finishedAt: "2026-10-09T10:05:00.000Z",
    answers: questions.map(q => answer(q, ["guess"])),
  });
  const latestEarly = run("latest-early", questions, {
    startedAt: "2026-10-10T10:00:00.000Z", finishedAt: "2026-10-10T10:05:00.000Z", answers: [answer(questions[0])],
  });
  const original = workspace(questions, { quizRuns: [latestEarly, olderComplete, middle] });
  const before = structuredClone(original);
  const area = preparationAreas(original, subject)[0];
  assert.deepEqual([area.completed, area.correct, area.total], [true, 1, 2]);
  assert.deepEqual(original, before, "Reading preparation must not reorder persisted history.");
});

test("only preparation rounds of the selected subject and area contribute to progress", () => {
  const q = question();
  const otherSubject = question("other-subject", 1, { subject: "Anderes Fachthema" });
  const otherConcept = question("other-concept", 1, { concept: "Anderer Lernbereich" });
  const ordinaryPractice = run("ordinary-practice", [q]);
  delete ordinaryPractice.preparationConcept;
  const data = workspace([q], { quizRuns: [run("other-subject-run", [otherSubject]), run("other-concept-run", [otherConcept]), ordinaryPractice] });
  const area = preparationAreas(data, subject)[0];
  assert.deepEqual([area.completed, area.correct, area.total], [false, 0, 0]);
});

test("a preparation round selects three distinct levels while excluding other subjects and concepts", () => {
  const questions = [1, 2, 3].flatMap(level => [question(`level-${level}-a`, level), question(`level-${level}-b`, level)]);
  const outside = [question("outside-subject", 1, { subject: "Anderes Thema" }), question("outside-concept", 2, { concept: "Anderer Bereich" })];
  const pool = [...outside, ...questions].reverse();
  const before = structuredClone(pool);
  const selected = selectPreparationQuestions(pool, [], subject, concept);
  assert.deepEqual(selected.map(q => q.difficulty), [1, 2, 3]);
  assert.equal(new Set(selected.map(q => q.id)).size, 3);
  assert.deepEqual(selected.map(q => q.id), ["level-1-a", "level-2-a", "level-3-a"]);
  assert.deepEqual(pool, before);
  assert.deepEqual(selectPreparationQuestions(pool, [], subject, "Fehlender Bereich"), []);
});

test("preparation rotates toward less used questions at every available level", () => {
  const questions = [1, 2, 3].flatMap(level => [question(`level-${level}-a`, level), question(`level-${level}-b`, level)]);
  const first = selectPreparationQuestions(questions, [], subject, concept);
  const history = [run("first-round", first)];
  const second = selectPreparationQuestions(questions, history, subject, concept);
  assert.deepEqual(second.map(q => q.id), ["level-1-b", "level-2-b", "level-3-b"]);
  assert.equal(second.some(q => first.some(previous => previous.id === q.id)), false);
});

test("short preparation repeats unresolved tasks before unused application tasks", () => {
  const basic = question("basic", 1), wrong = question("wrong", 2), newApplication = question("new-application", 2), transfer = question("transfer", 3);
  const previous = run("previous", [basic, wrong], { answers: [answer(basic), answer(wrong, ["guess"])] });
  const selected = selectAdaptivePreparationQuestions([basic, wrong, newApplication, transfer], [previous], subject, concept);
  assert.equal(selected[0].id, wrong.id);
  assert.deepEqual(new Set(selected.map(q => q.id)), new Set([wrong.id, newApplication.id, transfer.id]));
  assert.equal(selected.some(q => q.id === basic.id), false, "Already correct foundations should not replace open application tasks.");
});

test("correctly answered tasks of the same level cannot clear or replace another task's mistake", () => {
  const wrong = question("wrong", 2), right = question("right", 2);
  const old = run("old", [wrong], { answers: [answer(wrong, ["guess"])] });
  const correct = run("correct", [right], { startedAt: "2026-10-09T10:00:00.000Z", finishedAt: "2026-10-09T10:05:00.000Z", answers: [{ ...answer(right), answeredAt: "2026-10-09T10:02:00.000Z" }] });
  assert.deepEqual(selectPreparationQuestions([wrong, right], [old, correct], subject, concept).map(q => q.id), [wrong.id]);
});

test("adaptive preparation ignores answers in unfinished exams", () => {
  const first = question("a-first", 2), second = question("b-second", 2), third = question("c-third", 2), fourth = question("d-fourth", 2);
  const active = run("active", [first, second, third], { mode: "exam", preparationConcept: undefined, finishedAt: null });
  assert.deepEqual(selectPreparationQuestions([first, second, third, fourth], [active], subject, concept).map(q => q.id), [first.id, second.id, third.id]);
  assert.equal(latestQuestionResults([first, second, third], [active]).size, 0);
});

test("compacted unchanged history retains correct evidence but edited tasks require new practice", () => {
  const q = question();
  const data = compactQuizRuns(workspace([q], { quizRuns: [run("old", [q])] }), undefined, 0);
  assert.equal(latestQuestionResults([q], data.quizRuns).get(q.id).correct, true);
  for (const changed of [
    { ...q, prompt: "Eine andere Frage mit derselben ID." },
    { ...q, difficulty: 2 },
    { ...q, correctOptionIds: ["guess"] },
    { ...q, options: q.options.map(option => ({ ...option, text: "Neuer Wortlaut" })) },
  ]) {
    const edited = compactQuizRuns({ ...data, quizQuestions: [changed] }, data, 0);
    assert.equal(latestQuestionResults([changed], edited.quizRuns).size, 0);
  }
});

test("adaptive preparation returns unique question IDs without changing its bank or history", () => {
  const q = question();
  const pool = [q, structuredClone(q)];
  const history = [run("past", [q])];
  const before = structuredClone({ pool, history });
  assert.deepEqual(selectAdaptivePreparationQuestions(pool, history, subject, concept).map(item => item.id), [q.id]);
  assert.deepEqual({ pool, history }, before);
});

test("small custom banks return only their one or two available questions without duplication", () => {
  const one = [question("custom-one", 3)];
  assert.deepEqual(selectPreparationQuestions(one, [], subject, concept).map(q => q.id), ["custom-one"]);
  const two = [question("custom-first", 1), question("custom-second", 1)];
  const selected = selectPreparationQuestions(two, [], subject, concept);
  assert.equal(selected.length, 2);
  assert.equal(new Set(selected.map(q => q.id)).size, 2);
  assert.deepEqual(new Set(selected.map(q => q.id)), new Set(two.map(q => q.id)));
});

test("the complete-area mode includes every matching question instead of just the short round", () => {
  const questions = [1, 2, 3].flatMap(level => [question(`full-${level}-a`, level), question(`full-${level}-b`, level)]);
  const outside = [question("other-area", 1, { concept: "Anderer Bereich" }), question("other-subject", 1, { subject: "Anderes Fachthema" })];
  const full = selectPreparationQuestions([...outside, ...questions].reverse(), [], subject, concept, true);
  assert.equal(full.length, questions.length);
  assert.deepEqual(new Set(full.map(q => q.id)), new Set(questions.map(q => q.id)));
  assert.deepEqual(full.map(q => q.difficulty), [1, 1, 2, 2, 3, 3]);
  const large = Array.from({ length: 40 }, (_, index) => question(`large-${String(index).padStart(2, "0")}`, 1));
  const limited = selectPreparationQuestions(large, [], subject, concept, true);
  assert.equal(limited.length, 30, "A full round still respects the saved-run schema limit.");
  assert.equal(new Set(limited.map(q => q.id)).size, 30);
  assert.equal(quizRunSchema.safeParse(run("complete-area-limit", limited)).success, true);
});

test("custom preparation areas resolve only explicit note links and discard missing IDs", () => {
  const notes = [note("quality-note"), note("acceptance-note"), note("unrelated-note", { title: concept })];
  const questions = [
    question("q1", 1, { noteIds: ["acceptance-note", "quality-note"] }),
    question("q2", 2, { noteIds: ["quality-note", "missing-note"] }),
    question("q3", 3),
  ];
  const area = preparationAreas(workspace(questions, { notes }), subject)[0];
  assert.deepEqual(area.noteIds, ["acceptance-note", "quality-note"]);
  assert.equal(area.questionCount, 3);
  const unlinked = question("no-links");
  assert.deepEqual(questionLearningMaterial(unlinked, notes), []);
  assert.deepEqual(questionLearningMaterial({ ...unlinked, noteIds: ["quality-note"] }, notes).map(item => item.note.id), ["quality-note"]);
});

test("curated links require the audited subject, concept and prompt and preserve explicit author choices", () => {
  const q = question("synthetic-curated-fingerprint", 1, { subject: projectManagementLearning.subject });
  withCuratedFixture(q, { noteIds: ["quality-note"], visualHints: [] }, () => {
    const enriched = withLearningNotes(q);
    assert.deepEqual(enriched.noteIds, ["quality-note"]);
    assert.equal(Object.hasOwn(q, "noteIds"), false, "The question bank is not changed by enrichment.");
    for (const changed of [
      { ...q, prompt: "Eine anders formulierte Fragestellung" },
      { ...q, concept: "Ein anderer Lernbereich" },
      { ...q, subject: "Ein anderes Fachthema" },
      { ...q, id: "synthetic-unmapped-question" },
    ]) {
      assert.equal(withLearningNotes(changed), changed);
      assert.deepEqual(questionLearningMaterial(changed, [note()]), []);
    }
    const explicit = { ...q, noteIds: ["author-note"] };
    assert.equal(withLearningNotes(explicit), explicit);
    const optOut = { ...q, noteIds: [] };
    assert.equal(withLearningNotes(optOut), optOut);
    assert.deepEqual(questionLearningMaterial(optOut, [note()]), []);
  });
});

test("editor enrichment omits unavailable curated notes but leaves explicit author references unchanged", () => {
  const q = question("synthetic-editor-missing-notes", 1, { subject: projectManagementLearning.subject });
  withCuratedFixture(q, { noteIds: ["quality-note", "missing-note"], visualHints: [] }, () => {
    const available = [note()];
    const editable = withLearningNotes(q, available);
    assert.deepEqual(editable.noteIds, ["quality-note"]);
    assert.equal(workspaceSchema.safeParse(workspace([editable])).success, true);
    const standalone = withLearningNotes(q, []);
    assert.deepEqual(standalone.noteIds, []);
    assert.equal(workspaceSchema.safeParse(workspace([standalone], { notes: [] })).success, true);
    assert.equal(Object.hasOwn(q, "noteIds"), false);
    assert.deepEqual(withLearningNotes(q).noteIds, ["quality-note", "missing-note"], "Read-only enrichment remains independent of a particular collection.");
    const explicit = { ...q, noteIds: ["author-note"] };
    assert.equal(withLearningNotes(explicit, []), explicit, "Author-selected references must not be silently repaired.");
  });
});

test("complete-area selection enriches curated questions without passing array indices as note collections", () => {
  const q = question("synthetic-selected-curated", 2, { subject: projectManagementLearning.subject });
  const first = question("synthetic-unmapped-first", 1, { subject: projectManagementLearning.subject });
  withCuratedFixture(q, { noteIds: ["quality-note"], visualHints: [] }, () => {
    const selected = selectPreparationQuestions([first, q], [], q.subject, concept, true);
    assert.deepEqual(selected.map(item => item.id), [first.id, q.id]);
    assert.deepEqual(selected[1].noteIds, ["quality-note"]);
  });
});

test("curated graphics select the exact later comparison and never substitute an unrelated overview", () => {
  const q = question("synthetic-curated-visual", 1, { subject: projectManagementLearning.subject });
  const table = "| Begriff | Bezug |\n| --- | --- |\n| DoD | Qualitätsstandard eines Inkrements |\n| Abschluss | Befristetes Vorhaben |";
  const content = `${image}\n\n## Unterschiedliche Bezugsebenen\n\n${table}`;
  const hint = { noteId: "quality-note", kind: "comparison", contains: "| DoD | Qualitätsstandard eines Inkrements |" };
  withCuratedFixture(q, { noteIds: ["quality-note"], visualHints: [hint] }, () => {
    const material = questionLearningMaterial(q, [note("quality-note", { content })]);
    assert.equal(material.length, 1);
    assert.deepEqual(material[0].visuals.map(visual => visual.kind), ["comparison"]);
    assert.equal(material[0].visuals[0].markdown.includes(table), true);
    assert.equal(material[0].visuals[0].markdown.includes(image), false);
    const changed = questionLearningMaterial(q, [note("quality-note", { content: image })]);
    assert.equal(changed.length, 1, "The linked note stays available for reading.");
    assert.deepEqual(changed[0].visuals, [], "An absent audited comparison does not fall back to another figure.");
  });
});

test("partial explicit selections retain audited figures while added notes use the author's first safe figure", () => {
  const q = question("synthetic-curated-override", 1, { subject: projectManagementLearning.subject });
  const table = "| Ergebnis | Prüfung |\n| --- | --- |\n| Inkrement | Qualitätsstandard |";
  const notes = [note("quality-note", { content: `${image}\n\n${table}` }), note("author-note", { title: "Eigene Erläuterung" })];
  withCuratedFixture(q, {
    noteIds: ["quality-note", "second-curated-note"],
    visualHints: [{ noteId: "quality-note", kind: "comparison", contains: "| Inkrement | Qualitätsstandard |" }],
  }, () => {
    const partial = questionLearningMaterial({ ...q, noteIds: ["quality-note"] }, notes);
    assert.deepEqual(partial[0].visuals.map(visual => visual.kind), ["comparison"], "Removing another link must not substitute the first overview.");
    const changed = questionLearningMaterial({ ...q, noteIds: ["author-note"] }, notes);
    assert.deepEqual(changed.map(item => item.note.id), ["author-note"]);
    assert.deepEqual(changed[0].visuals.map(visual => visual.kind), ["image"]);
    const extended = questionLearningMaterial({ ...q, noteIds: ["quality-note", "author-note"] }, notes);
    assert.deepEqual(extended.map(item => item.note.id), ["quality-note", "author-note"]);
    assert.deepEqual(extended.map(item => item.visuals[0].kind), ["comparison", "image"]);
  });
});

test("image signatures normalize only private UUIDs and reject unsupported image syntax or mixed content", () => {
  const replacement = image.replace("12345678-1234-1234-1234-123456789abc", "abcdefab-cdef-abcd-efab-cdefabcdefab");
  assert.equal(imageLearningSignature(image), imageLearningSignature(replacement));
  assert.equal(imageLearningSignature(image).includes("Qualität im Überblick"), true);
  assert.equal(imageLearningSignature(image).includes("Eine illustrative Übersicht."), true);
  assert.notEqual(imageLearningSignature(image), imageLearningSignature(image.replace("Eine illustrative Übersicht.", "Eine andere Hauptaussage.")));
  assert.notEqual(imageLearningSignature(image), imageLearningSignature(image.replace("Qualität im Überblick", "Andere Darstellung")));
  const quotedUrl = image.replace("Eine illustrative Übersicht.", "Referenz /api/media/12345678-1234-1234-1234-123456789abc");
  assert.notEqual(imageLearningSignature(quotedUrl), imageLearningSignature(quotedUrl.replace("Referenz /api/media/12345678-1234-1234-1234-123456789abc", "Referenz /api/media/abcdefab-cdef-abcd-efab-cdefabcdefab")), "Only the destination UUID is normalized; caption text remains exact.");
  for (const unsupported of [
    "![Extern](https://example.org/image.png)",
    "![Inline](data:image/png;base64,abc)",
    "![Lokal](file:///C:/image.png)",
    image.replace("789abc ", "789abc?query=true "),
    `\`${image}\``,
    `${image}\n\nZusätzlicher Text.`,
    `${image}\n\n${replacement}`,
  ]) assert.equal(imageLearningSignature(unsupported), "", unsupported);
});

test("an unambiguous image signature restores the same figure after a private media UUID changes", () => {
  const q = question("synthetic-image-remap", 1, { subject: projectManagementLearning.subject });
  const oldUrl = "/api/media/12345678-1234-1234-1234-123456789abc";
  const replacement = image.replace(oldUrl, "/api/media/abcdefab-cdef-abcd-efab-cdefabcdefab");
  const hint = { noteId: "quality-note", kind: "image", contains: oldUrl, imageSignature: imageLearningSignature(image) };
  withCuratedFixture(q, { noteIds: ["quality-note"], visualHints: [hint] }, () => {
    const relocated = questionLearningMaterial(q, [note("quality-note", { content: replacement })]);
    assert.equal(relocated[0].visuals.length, 1);
    assert.equal(relocated[0].visuals[0].markdown, replacement);
    const changedCaption = questionLearningMaterial(q, [note("quality-note", { content: replacement.replace("Eine illustrative Übersicht.", "Eine neue Aussage.") })]);
    assert.deepEqual(changedCaption[0].visuals, [], "A changed caption does not qualify as the same imported image.");
    const changedKind = { ...hint, kind: "comparison" };
    projectManagementLearning.questions[q.id].visualHints = [changedKind];
    assert.deepEqual(questionLearningMaterial(q, [note("quality-note", { content: replacement })])[0].visuals, [], "Image relocation cannot replace a comparison.");
  });
});

test("ambiguous relocated image signatures stay absent and exact original URLs take priority", () => {
  const q = question("synthetic-image-ambiguity", 1, { subject: projectManagementLearning.subject });
  const oldUrl = "/api/media/12345678-1234-1234-1234-123456789abc";
  const first = image.replace(oldUrl, "/api/media/abcdefab-cdef-abcd-efab-cdefabcdefab");
  const second = image.replace(oldUrl, "/api/media/abcdefab-cdef-abcd-efab-cdefabcdefac");
  const hint = { noteId: "quality-note", kind: "image", contains: oldUrl, imageSignature: imageLearningSignature(image) };
  withCuratedFixture(q, { noteIds: ["quality-note"], visualHints: [hint] }, () => {
    const ambiguous = questionLearningMaterial(q, [note("quality-note", { content: `${first}\n\n${second}` })]);
    assert.deepEqual(ambiguous[0].visuals, []);
    const exact = questionLearningMaterial(q, [note("quality-note", { content: `${first}\n\n${image}\n\n${second}` })]);
    assert.equal(exact[0].visuals.length, 1);
    assert.equal(exact[0].visuals[0].markdown, image);
  });
});

test("curated area ordering remains complete and then appends custom areas", () => {
  const mappedSubject = projectManagementLearning.subject;
  const q = question("synthetic-area-order", 1, { subject: mappedSubject });
  const questions = [
    question("custom-area", 1, { subject: mappedSubject, concept: "Zusätzlicher Lernbereich" }),
    question("second-area", 2, { subject: mappedSubject, concept: "Anwendung" }),
    q,
  ];
  const areas = [{ concept, noteIds: ["quality-note"] }, { concept: "Anwendung", noteIds: ["quality-note"] }, { concept: "Nicht vorhandener Bereich", noteIds: [] }];
  withCuratedFixture(q, { noteIds: ["quality-note"], visualHints: [] }, () => {
    const result = preparationAreas(workspace(questions), mappedSubject);
    assert.deepEqual(result.map(area => area.concept), [concept, "Anwendung", "Zusätzlicher Lernbereich"]);
    assert.deepEqual(result.map(area => area.questionCount), [1, 1, 1]);
  }, areas);
});

test("round compaction preserves preparation progress, linked notes and saved grading", () => {
  const q = question("compact-question", 1, { noteIds: ["quality-note"] });
  const old = run("older-round", [q]);
  const latest = run("latest-round", [q], { startedAt: "2026-10-10T10:00:00.000Z", finishedAt: "2026-10-10T10:05:00.000Z" });
  const original = workspace([q], { quizRuns: [old, latest] });
  const before = structuredClone(original);
  const compacted = compactQuizRuns(original, undefined, 1);
  const archived = compacted.quizRuns.find(item => item.id === old.id);
  assert.equal(archived.preparationConcept, concept);
  assert.equal(archived.questions[0].explanation, ARCHIVED_EXPLANATION);
  assert.deepEqual(archived.questions[0].noteIds, ["quality-note"]);
  assert.deepEqual(archived.answers, old.answers);
  assert.equal(isCorrect(archived.questions[0], archived.answers[0].selectedOptionIds), true);
  assert.deepEqual(preparationAreas(compacted, subject).map(area => [area.completed, area.correct, area.total]), [[true, 1, 1]]);
  assert.equal(workspaceSchema.safeParse(compacted).success, true);
  assert.deepEqual(original, before, "Compaction is an immutable workspace update.");
});
