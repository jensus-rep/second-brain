import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyWorkspace, flashcardSchema, learningCollectionSchema, quizRunSchema, reviewCard, workspaceSchema,
} from "../lib/brain/model.ts";
import {
  addToLearningCollection, collectionItems, flashcardContentFingerprint, flashcardPriority, learningCollections,
  priorityDescriptions, priorityLabels, removeFlashcard,
} from "../lib/brain/learning-collections.ts";
import { curatedLearningCollections } from "../lib/brain/curated-learning-collections.ts";
import { collectionTopicNavigation } from "../lib/brain/collection-topics.ts";
import { applyTopicStructure, proposeTopicStructure } from "../lib/brain/curated-topic-structure.ts";

const timestamp = "2026-10-10T08:00:00.000Z";

test("collection navigation exposes immediate children, direct notes and collection-scoped counts", () => {
  const topics = [
    { id: "ai", title: "Künstliche Intelligenz", description: "", color: "green" },
    { id: "ml", title: "Machine Learning", description: "", color: "green", parentId: "ai" },
    ...["supervised", "unsupervised", "self-supervised", "reinforcement"].map(id => ({ id, title: id, description: "", color: "green", parentId: "ml" })),
    { id: "other", title: "Weiteres Thema", description: "", color: "blue" },
    { id: "regression", title: "Regression", description: "", color: "green", parentId: "supervised" },
    { id: "classification", title: "Klassifikation", description: "", color: "green", parentId: "supervised" },
    { id: "excluded-branch", title: "Außerhalb der Auswahl", description: "", color: "green", parentId: "ml" },
  ];
  const notes = [note("intro", "ai"), note("ml-intro", "ml"), ...topics.slice(2, 6).map(topic => note(topic.id + "-note", topic.id)), note("excluded", "supervised"), note("outside", "other"), note("excluded-detail", "excluded-branch")];
  const data = workspace({ topics, notes, cards: [], quizQuestions: [], paths: [] });
  const selected = collection("ai-learning", { noteIds: notes.slice(0, 6).map(note => note.id), questionIds: [], cardIds: [], pathIds: [] });
  const before = structuredClone(data);
  const entry = collectionTopicNavigation(data, selected);
  assert.equal(entry.current.id, "ai");
  assert.deepEqual(entry.branches.map(branch => [branch.topic.id, branch.noteCount, branch.childCount]), [["ml", 5, 4]]);
  assert.deepEqual(entry.directNotes.map(note => note.id), ["intro"]);
  const ml = collectionTopicNavigation(data, selected, "ml");
  assert.deepEqual(ml.branches.map(branch => branch.topic.id), ["supervised", "unsupervised", "self-supervised", "reinforcement"]);
  assert.deepEqual(ml.path.map(topic => topic.id), ["ai", "ml"]);
  assert.deepEqual(ml.directNotes.map(note => note.id), ["ml-intro"]);
  assert.equal(collectionTopicNavigation(data, selected, "supervised").scopedNotes.length, 1);
  assert.deepEqual(collectionTopicNavigation(data, selected, "supervised").branches.map(branch => [branch.topic.id, branch.noteCount]), [["regression", 0], ["classification", 0]]);
  assert.equal(collectionTopicNavigation(data, selected, "regression").current.id, "regression");
  assert.equal(collectionTopicNavigation(data, selected, "regression").scopedNotes.length, 0);
  assert.equal(entry.topics.some(topic => topic.id === "excluded-branch"), false);
  assert.equal(collectionTopicNavigation(data, selected, "outside").current.id, "ai");
  assert.deepEqual(data, before);
});

test("multiple collection roots and unassigned notes remain reachable", () => {
  const data = workspace({ notes: [note(), note("second", "fixture-topic-2"), note("unassigned", null)] });
  const selected = collection("multi", { noteIds: data.notes.map(note => note.id) });
  const entry = collectionTopicNavigation(data, selected);
  assert.equal(entry.current, undefined);
  assert.equal(entry.branches.length, 2);
  assert.deepEqual(entry.directNotes.map(note => note.id), ["unassigned"]);
  assert.deepEqual(collectionTopicNavigation(data, selected, "::unassigned").scopedNotes.map(note => note.id), ["unassigned"]);
});

test("topic fallback collections combine a subject's descendants under its existing root", () => {
  withProposals([], {}, () => {
    const topics = [{ id: "root", title: "Fachthema", description: "", color: "blue" }, { id: "child", title: "Unterthema", description: "", color: "blue", parentId: "root" }];
    const data = workspace({ topics, notes: [note("one", "root"), note("two", "child")], cards: [], quizQuestions: [], paths: [] });
    const values = learningCollections(data);
    assert.equal(values.length, 1);
    assert.equal(values[0].title, "Fachthema");
    assert.deepEqual(values[0].noteIds, ["one", "two"]);
    const partial = { ...data, learningCollections: [collection("partial", { title: "Fachthema", noteIds: ["one"], cardIds: [], questionIds: [], pathIds: [] })] };
    const complete = learningCollections(partial).find(item => item.id !== "partial");
    assert.equal(complete.title, "Fachthema – gesamter Themenbestand");
    assert.deepEqual(complete.noteIds, ["one", "two"]);
  });
});

test("curated structure orders PM approaches and ML paradigms while preserving all IDs and progress", () => {
  const ids = ["agpm1-topic", "pm-klassisch", "agile-umsetzung", "pm-hybrid", "pm-agil-frameworks", "pm-scrum", "ki", "ki-machine-learning", "ki-ml-supervised", "ki-ml-unsupervised", "ki-ml-self-supervised", "ki-ml-reinforcement"];
  const data = workspace({ topics: ids.map(id => ({ id, title: id, description: "", color: "blue" })), notes: [note("agpm1-note-projektauftrag", "agpm1-topic"), note("agpm1-note-risiko", "pm-klassisch")], cards: [], quizQuestions: [], paths: [], completedStepIds: [] });
  const before = structuredClone(data);
  const proposal = proposeTopicStructure(data);
  assert.ok(proposal);
  assert.deepEqual(data, before, "Preview never mutates the workspace");
  const result = applyTopicStructure(data);
  assert.deepEqual(result.topics.filter(topic => topic.parentId === "agpm1-topic").map(topic => topic.id), ["pm-grundlagen", "agile-umsetzung", "pm-klassisch", "pm-hybrid"]);
  assert.equal(result.topics.find(topic => topic.id === "pm-scrum").parentId, "pm-agil-frameworks");
  assert.equal(result.topics.find(topic => topic.id === "ki-machine-learning").parentId, "ki");
  assert.equal(result.topics.filter(topic => topic.parentId === "ki-machine-learning").length, 4);
  assert.ok(result.notes.every(note => note.topicId === "pm-grundlagen"));
  assert.deepEqual(result.notes.map(note => note.id), data.notes.map(note => note.id));
  for (const key of ["cards", "quizQuestions", "paths", "completedStepIds", "learningCollections"]) assert.deepEqual(result[key], data[key]);
  assert.equal(proposeTopicStructure(result), null, "Applying is idempotent");
  const manual = { ...result, notes: result.notes.map(note => ({ ...note, topicId: "agpm1-topic" })) };
  assert.equal(proposeTopicStructure(manual), null, "Later manual note assignments are respected");
});

test("curated structure respects explicit parents, incomplete imports and cycles", () => {
  const topic = (id, parentId) => ({ id, title: id, description: "", color: "blue", ...(parentId !== undefined ? { parentId } : {}) });
  const data = workspace({ topics: [topic("ki"), topic("ki-machine-learning", null), topic("ki-ml-supervised", "ki")], notes: [], cards: [], quizQuestions: [], paths: [] });
  assert.equal(proposeTopicStructure(data), null);
  assert.equal(proposeTopicStructure({ ...data, topics: [topic("ki-machine-learning")] }), null);
  assert.equal(proposeTopicStructure({ ...data, topics: [topic("ki", "ki-machine-learning"), topic("ki-machine-learning")] }), null);
  const unrelated = workspace();
  assert.equal(applyTopicStructure(unrelated), unrelated);
});
const note = (id = "fixture-note-1", topicId = "fixture-topic-1", overrides = {}) => ({
  id, topicId, title: "Anforderungen und Nachweise", summary: "Ergebnisse überprüfbar machen.", content: "Vereinbarte Kriterien schaffen Orientierung.",
  tags: [], relatedIds: [], favorite: false, archived: false, createdAt: timestamp, updatedAt: timestamp, ...overrides,
});
const card = (id = "fixture-card-1", noteId = "fixture-note-1", overrides = {}) => ({
  id, noteId, question: "Was macht eine Anforderung prüfbar?", answer: "Vereinbarte Kriterien und nachvollziehbare Nachweise.",
  dueAt: timestamp, intervalDays: 7, reviews: 4, ...overrides,
});
const question = (id = "fixture-question-1", overrides = {}) => ({
  id, subject: "Qualitätsmanagement", concept: "Anforderungen", difficulty: 3,
  prompt: "Welche Aussage beschreibt ein prüfbares Ergebnis?", noteIds: ["fixture-note-1"],
  options: [{ id: "criteria", text: "Die Kriterien sind vereinbart.", feedback: "Die Prüfung wird nachvollziehbar." }, { id: "guess", text: "Der persönliche Eindruck genügt.", feedback: "Ein Eindruck ersetzt keinen Nachweis." }],
  correctOptionIds: ["criteria"], explanation: "Gemeinsame Kriterien ermöglichen eine nachvollziehbare Prüfung.", source: "", ...overrides,
});
const collection = (id = "fixture-collection", overrides = {}) => ({
  id, title: "Qualität verstehen", description: "Begriffe und praktische Anwendung.",
  noteIds: ["fixture-note-1"], questionIds: ["fixture-question-1"], cardIds: ["fixture-card-1"], pathIds: ["fixture-path-1"], ...overrides,
});
const workspace = (overrides = {}) => ({
  ...structuredClone(emptyWorkspace),
  topics: [{ id: "fixture-topic-1", title: "Qualität", description: "Anforderungen und Nachweise.", color: "blue" }, { id: "fixture-topic-2", title: "Zusammenarbeit", description: "Gemeinsam lernen.", color: "green" }],
  notes: [note(), note("fixture-note-2", "fixture-topic-2")],
  cards: [card(), card("fixture-card-2", "fixture-note-2"), card("fixture-standalone", null)],
  quizQuestions: [question()],
  paths: [{ id: "fixture-path-1", title: "Qualität anwenden", description: "Vom Begriff zum Nachweis.", steps: [{ id: "fixture-step-1", noteId: "fixture-note-1", objective: "Einen Qualitätsnachweis erklären." }] }],
  completedStepIds: ["fixture-step-1"], ...overrides,
});

function withProposals(proposals, priorities, callback) {
  const previousCollections = curatedLearningCollections.collections;
  const previousPriorities = curatedLearningCollections.priorities;
  curatedLearningCollections.collections = proposals;
  curatedLearningCollections.priorities = priorities;
  try { return callback(); }
  finally {
    curatedLearningCollections.collections = previousCollections;
    curatedLearningCollections.priorities = previousPriorities;
  }
}

test("legacy imports gain empty collections without changing IDs, progress or card priorities", () => {
  const original = workspace();
  delete original.learningCollections;
  const before = structuredClone(original);
  const parsed = workspaceSchema.parse(original);
  assert.deepEqual(parsed.learningCollections, []);
  const { learningCollections: ignored, ...rest } = parsed;
  assert.equal(ignored.length, 0);
  assert.deepEqual(rest, before);
  assert.equal(Object.hasOwn(parsed.cards[0], "priority"), false);
  assert.deepEqual(original, before);
});

test("priorities accept three importance levels and an intentional null independently of quiz difficulty", () => {
  for (const priority of [1, 2, 3, null]) assert.equal(flashcardSchema.parse(card("fixture-priority", null, { priority })).priority, priority);
  for (const priority of [0, 4, -1, 1.5, "1"]) assert.equal(flashcardSchema.safeParse(card("invalid-priority", null, { priority })).success, false);
  const data = workspace({ cards: [card("fixture-priority", "fixture-note-1", { priority: 1 })] });
  const parsed = workspaceSchema.parse(data);
  assert.equal(parsed.cards[0].priority, 1);
  assert.equal(parsed.quizQuestions[0].difficulty, 3);
  assert.equal(priorityLabels[1], "Kernwissen");
  assert.equal(priorityLabels[2], "Vertiefung");
  assert.equal(priorityLabels[3], "Ergänzung");
  assert.match(priorityDescriptions[1], /sitzen/i);
});

test("collection membership rejects duplicates within each list and duplicate collection IDs", () => {
  for (const key of ["noteIds", "questionIds", "cardIds", "pathIds"]) {
    const duplicate = collection("fixture-duplicate", { [key]: ["same-id", "same-id"] });
    assert.equal(learningCollectionSchema.safeParse(duplicate).success, false, key);
  }
  assert.equal(workspaceSchema.safeParse(workspace({ learningCollections: [collection(), collection()] })).success, false);
  assert.equal(workspaceSchema.safeParse(workspace({ learningCollections: [collection("fixture-shared-a"), collection("fixture-shared-b")] })).success, true, "Two collections may deliberately share the same items.");
});

test("persisted collections reject missing notes, questions, cards and paths", () => {
  for (const key of ["noteIds", "questionIds", "cardIds", "pathIds"]) {
    const invalid = collection("fixture-missing", { [key]: ["missing-item"] });
    assert.equal(workspaceSchema.safeParse(workspace({ learningCollections: [invalid] })).success, false, key);
  }
  const valid = workspace({ learningCollections: [collection()] });
  assert.deepEqual(workspaceSchema.parse(valid).learningCollections, valid.learningCollections);
});

test("collection and membership limits bound imports while accepting their exact boundaries", () => {
  const limits = { noteIds: 1000, questionIds: 1000, cardIds: 3000, pathIds: 100 };
  for (const [key, limit] of Object.entries(limits)) {
    const ids = Array.from({ length: limit }, (_, index) => `item-${index}`);
    assert.equal(learningCollectionSchema.safeParse(collection("fixture-limit", { [key]: ids })).success, true, key);
    assert.equal(learningCollectionSchema.safeParse(collection("fixture-limit", { [key]: [...ids, "one-more"] })).success, false, key);
  }
  const empty = { noteIds: [], questionIds: [], cardIds: [], pathIds: [] };
  const many = Array.from({ length: 100 }, (_, index) => collection(`fixture-set-${index}`, empty));
  assert.equal(workspaceSchema.safeParse(workspace({ learningCollections: many })).success, true);
  assert.equal(workspaceSchema.safeParse(workspace({ learningCollections: [...many, collection("fixture-set-extra", empty)] })).success, false);
  assert.equal(learningCollectionSchema.safeParse(collection("fixture-description", { description: "x".repeat(601) })).success, false);
});

test("historical collection references remain valid after a saved collection is removed", () => {
  const q = question();
  const recorded = {
    id: "fixture-history", subject: q.subject, mode: "practice", collectionId: "removed-collection", startedAt: timestamp,
    deadlineAt: null, finishedAt: "2026-10-10T08:05:00.000Z", questions: [q],
    answers: [{ questionId: q.id, selectedOptionIds: ["criteria"], answeredAt: "2026-10-10T08:02:00.000Z", reflection: "Kriterien nennen." }],
  };
  assert.equal(quizRunSchema.safeParse(recorded).success, true);
  const parsed = workspaceSchema.parse(workspace({ quizRuns: [recorded] }));
  assert.equal(parsed.quizRuns[0].collectionId, "removed-collection");
  assert.deepEqual(parsed.quizRuns[0].answers, recorded.answers);
});

test("collection items use explicit note/question/path membership and include linked cards once", () => {
  const data = workspace({
    notes: [note("fixture-note-1", "fixture-topic-1", { relatedIds: ["fixture-note-2"] }), note("fixture-note-2", "fixture-topic-2")],
    quizQuestions: [question("fixture-question-1"), question("fixture-question-2", { noteIds: ["fixture-note-2"] })],
    cards: [card(), card("fixture-linked-extra", "fixture-note-1"), card("fixture-card-2", "fixture-note-2")],
  });
  const scoped = collection("fixture-explicit", { noteIds: ["fixture-note-1"], questionIds: ["fixture-question-2"], cardIds: ["fixture-card-2", "fixture-card-1"], pathIds: [] });
  const items = collectionItems(data, scoped);
  assert.deepEqual(items.notes.map(item => item.id), ["fixture-note-1"]);
  assert.deepEqual(items.questions.map(item => item.id), ["fixture-question-2"]);
  assert.deepEqual(items.paths, [], "A path is not inferred just because it contains a selected note.");
  assert.deepEqual(items.cards.map(item => item.id), ["fixture-card-2", "fixture-card-1", "fixture-linked-extra"]);
  assert.equal(new Set(items.cards.map(item => item.id)).size, items.cards.length);
  assert.deepEqual(items.topics.map(item => item.id), ["fixture-topic-1"]);
  assert.equal(items.cards.find(item => item.id === "fixture-card-1"), data.cards[0]);
});

test("unavailable proposed memberships are filtered without mutating proposals or adding phantom collections", () => {
  const proposed = collection("fixture-curated", { noteIds: ["missing-note", "fixture-note-1"], questionIds: ["missing-question"], cardIds: ["missing-card"], pathIds: ["missing-path"] });
  const before = structuredClone(proposed);
  withProposals([proposed, collection("fixture-fully-missing", { noteIds: ["missing-note"], questionIds: [], cardIds: [], pathIds: [] })], {}, () => {
    const values = learningCollections(workspace());
    const matching = values.find(item => item.id === proposed.id);
    assert.deepEqual(matching.noteIds, ["fixture-note-1"]);
    assert.deepEqual(matching.questionIds, []);
    assert.deepEqual(matching.cardIds, []);
    assert.deepEqual(matching.pathIds, []);
    assert.equal(values.some(item => item.id === "fixture-fully-missing"), false);
    assert.deepEqual(proposed, before);
    assert.deepEqual(learningCollections(structuredClone(emptyWorkspace)), []);
  });
});

test("a saved collection overrides a curated proposal with the same stable ID", () => {
  const saved = collection("fixture-curated", { title: "Meine Auswahl", noteIds: ["fixture-note-2"], questionIds: [], cardIds: [], pathIds: [] });
  const proposed = collection("fixture-curated");
  withProposals([proposed], {}, () => {
    const data = workspace({ learningCollections: [saved] });
    const before = structuredClone(data);
    const values = learningCollections(data);
    assert.equal(values.filter(item => item.id === saved.id).length, 1);
    assert.equal(values[0], saved);
    assert.equal(values[0].title, "Meine Auswahl");
    assert.deepEqual(values[0].noteIds, ["fixture-note-2"]);
    assert.deepEqual(data, before);
  });
});

test("a small custom collection coexists with a complete subject and topic fallback", () => {
  withProposals([], {}, () => {
    const questions = [question("fixture-question-1"), question("fixture-question-2", { noteIds: ["fixture-note-2"] })];
    const data = workspace({
      notes: [note(), note("fixture-note-2", "fixture-topic-1"), note("fixture-note-3", "fixture-topic-1")],
      quizQuestions: questions,
      cards: [card(), card("fixture-card-2", "fixture-note-2"), card("fixture-card-3", "fixture-note-3")],
      learningCollections: [collection("fixture-small", { questionIds: ["fixture-question-1"], cardIds: [], pathIds: [] })],
    });
    const values = learningCollections(data);
    const subjectSet = values.find(item => item.title === "Qualitätsmanagement");
    assert.deepEqual(subjectSet.questionIds, ["fixture-question-1", "fixture-question-2"]);
    assert.deepEqual(subjectSet.noteIds, ["fixture-note-1", "fixture-note-2"], "Only explicit question links add note membership to a subject group.");
    assert.deepEqual(collectionItems(data, subjectSet).cards.map(item => item.id), ["fixture-card-1", "fixture-card-2"]);
    const topicSet = values.find(item => item.title === "Qualität");
    assert.deepEqual(topicSet.noteIds, ["fixture-note-1", "fixture-note-2", "fixture-note-3"]);
    assert.equal(values.some(item => item.id === "fixture-small"), true);
  });
});

test("saved fallback IDs stay authoritative and uncovered content is explicitly labeled as unassigned", () => {
  withProposals([], {}, () => {
    const questions = [question("fixture-question-1"), question("fixture-question-2")];
    const data = workspace({ quizQuestions: questions });
    const automatic = learningCollections(data).find(item => item.title === "Qualitätsmanagement");
    const saved = { ...automatic, questionIds: ["fixture-question-1"] };
    const values = learningCollections({ ...data, learningCollections: [saved] });
    assert.equal(values.filter(item => item.title === "Qualitätsmanagement").length, 1);
    assert.equal(values.find(item => item.id === saved.id), saved);
    const rest = values.find(item => item.id === "learning-unassigned");
    assert.equal(rest.questionIds.includes("fixture-question-2"), true);
    assert.match(rest.description, /noch keiner Lernsammlung zugeordnet/i);
  });
});

test("shared cards retain one schedule and progress across all collection selections", () => {
  withProposals([], {}, () => {
    const shared = card();
    const first = collection("fixture-shared-1", { cardIds: [], questionIds: [], pathIds: [] });
    const second = collection("fixture-shared-2", { noteIds: [], cardIds: [shared.id], questionIds: [], pathIds: [] });
    const data = workspace({ cards: [shared], learningCollections: [first, second] });
    const before = structuredClone(data);
    const one = collectionItems(data, first).cards[0];
    const two = collectionItems(data, second).cards[0];
    assert.equal(one, shared);
    assert.equal(two, shared);
    assert.equal(one, two);
    assert.deepEqual([one.reviews, one.intervalDays, one.dueAt], [4, 7, timestamp]);
    assert.equal(collectionItems(data, collection("fixture-both", { cardIds: [shared.id] })).cards.length, 1);
    learningCollections(data);
    assert.deepEqual(data, before);
  });
});

test("curated priority is an exact content proposal and never changes existing learning progress", () => {
  const original = card();
  const proposal = { fingerprint: flashcardContentFingerprint(original), priority: 1 };
  withProposals([], { [original.id]: proposal }, () => {
    const before = structuredClone(original);
    assert.match(flashcardContentFingerprint(original), /^[0-9a-f]{8}$/);
    assert.equal(flashcardPriority(original), 1);
    assert.equal(flashcardPriority({ ...original, question: original.question + " Anders gefragt." }), null);
    assert.equal(flashcardPriority({ ...original, answer: original.answer + " Neue Aussage." }), null);
    assert.equal(flashcardPriority({ ...original, id: "unknown-card" }), null);
    const reviewed = reviewCard(original, true, new Date(timestamp));
    assert.equal(flashcardPriority(reviewed), 1, "Review dates and counters do not determine importance.");
    assert.deepEqual(original, before);
    assert.equal(Object.hasOwn(original, "priority"), false);
  });
});

test("explicit priority and an intentional unclassified choice override curated suggestions", () => {
  const original = card();
  withProposals([], { [original.id]: { fingerprint: flashcardContentFingerprint(original), priority: 1 } }, () => {
    for (const priority of [1, 2, 3, null]) {
      const explicit = { ...original, priority, answer: "Eine inzwischen überarbeitete Antwort." };
      assert.equal(flashcardPriority(explicit), priority);
      assert.equal(reviewCard(explicit, false, new Date(timestamp)).priority, priority);
    }
  });
});

test("deleting a shared card cleans persisted collection membership in one immutable update", () => {
  const data = workspace({ learningCollections: [collection("fixture-a"), collection("fixture-b", { cardIds: ["fixture-card-1", "fixture-card-2"] })] });
  const before = structuredClone(data);
  const updated = removeFlashcard(data, "fixture-card-1");
  assert.equal(updated.cards.some(item => item.id === "fixture-card-1"), false);
  assert.equal(updated.learningCollections.some(item => item.cardIds.includes("fixture-card-1")), false);
  assert.deepEqual(updated.learningCollections.find(item => item.id === "fixture-b").cardIds, ["fixture-card-2"]);
  assert.equal(updated.cards.find(item => item.id === "fixture-card-2"), data.cards[1]);
  assert.deepEqual(updated.completedStepIds, before.completedStepIds);
  assert.deepEqual(updated.quizRuns, before.quizRuns);
  assert.equal(workspaceSchema.safeParse(updated).success, true);
  assert.deepEqual(data, before);
});

test("reading older helper inputs and unresolved items stays safe without guessing extra membership", () => {
  withProposals([], {}, () => {
    const data = workspace();
    delete data.learningCollections;
    assert.doesNotThrow(() => learningCollections(data));
    const unresolved = collection("fixture-unresolved", { noteIds: ["missing-note"], questionIds: ["missing-question"], cardIds: ["missing-card"], pathIds: ["missing-path"] });
    assert.deepEqual(collectionItems(data, unresolved), { notes: [], questions: [], cards: [], paths: [], topics: [] });
  });
});

test("adding a new card or question preserves saved scope, item content and shared progress", () => {
  withProposals([collection("fixture-saved")], {}, () => {
    const selected = collection("fixture-saved", { title: "Meine aktuelle Auswahl", noteIds: [], cardIds: [], questionIds: [], pathIds: [] });
    const data = workspace({ learningCollections: [selected, collection("fixture-other")] });
    const before = structuredClone(data);
    const withCard = addToLearningCollection(data, selected.id, "cardIds", "fixture-standalone");
    const updated = addToLearningCollection(withCard, selected.id, "questionIds", "fixture-question-1");
    assert.deepEqual(updated.learningCollections[0], { ...selected, cardIds: ["fixture-standalone"], questionIds: ["fixture-question-1"] });
    assert.equal(updated.learningCollections[1], data.learningCollections[1]);
    for (const key of ["notes", "cards", "quizQuestions", "quizRuns", "completedStepIds", "paths"]) assert.equal(updated[key], data[key], key);
    assert.equal(workspaceSchema.safeParse(updated).success, true);
    assert.deepEqual(data, before);
    assert.equal(addToLearningCollection(updated, selected.id, "cardIds", "fixture-standalone"), updated, "An existing explicit membership is a no-op.");
  });
});

test("adding to a proposal adopts its current available members and deduplicates the new assignment", () => {
  const proposed = collection("fixture-proposal", { noteIds: ["fixture-note-1", "removed-note"], cardIds: ["fixture-standalone", "removed-card"], questionIds: ["fixture-question-1", "removed-question"] });
  withProposals([proposed], {}, () => {
    const data = workspace();
    const before = structuredClone(data);
    const updated = addToLearningCollection(data, proposed.id, "cardIds", "fixture-standalone");
    assert.deepEqual(updated.learningCollections, [{ ...proposed, noteIds: ["fixture-note-1"], cardIds: ["fixture-standalone"], questionIds: ["fixture-question-1"] }]);
    assert.equal(workspaceSchema.safeParse(updated).success, true);
    assert.equal(collectionItems(updated, updated.learningCollections[0]).cards.some(item => item.id === "fixture-standalone"), true);
    assert.deepEqual(data, before);
    assert.deepEqual(proposed.noteIds, ["fixture-note-1", "removed-note"]);
  });
});

test("adding to an automatic subject set uses the latest bank and materializes the selection", () => {
  withProposals([], {}, () => {
    const initial = workspace();
    const selected = learningCollections(initial).find(item => item.title === "Qualitätsmanagement");
    const newQuestion = question("fixture-new-question", { concept: "Neue Anwendung" });
    const latest = { ...initial, quizQuestions: [...initial.quizQuestions, newQuestion] };
    const updated = addToLearningCollection(latest, selected.id, "questionIds", newQuestion.id);
    assert.equal(updated.learningCollections.length, 1);
    assert.deepEqual(updated.learningCollections[0].questionIds, ["fixture-question-1", "fixture-new-question"]);
    assert.equal(updated.quizQuestions.at(-1), newQuestion);
    assert.equal(workspaceSchema.safeParse(updated).success, true);
  });
});

test("unknown selections and unavailable item IDs cannot create invalid membership", () => {
  withProposals([], {}, () => {
    const data = workspace({ learningCollections: [collection()] });
    assert.equal(addToLearningCollection(data, "missing-collection", "cardIds", "fixture-standalone"), data);
    assert.equal(addToLearningCollection(data, "", "questionIds", "fixture-question-1"), data);
    assert.equal(addToLearningCollection(data, "fixture-collection", "cardIds", "missing-card"), data);
    assert.equal(addToLearningCollection(data, "fixture-collection", "questionIds", "missing-question"), data);
  });
});

test("the saved collection limit blocks adoption transparently but permits existing assignments", () => {
  withProposals([collection("fixture-proposal")], {}, () => {
    const empty = { noteIds: [], questionIds: [], cardIds: [], pathIds: [] };
    const saved = Array.from({ length: 100 }, (_, index) => collection(`fixture-saved-${index}`, empty));
    const data = workspace({ learningCollections: saved });
    const before = structuredClone(data);
    assert.throws(() => addToLearningCollection(data, "fixture-proposal", "cardIds", "fixture-standalone"), /100 gespeicherten Lernsammlungen/);
    assert.deepEqual(data, before);
    const updated = addToLearningCollection(data, "fixture-saved-0", "cardIds", "fixture-standalone");
    assert.equal(updated.learningCollections.length, 100);
    assert.deepEqual(updated.learningCollections[0].cardIds, ["fixture-standalone"]);
    assert.equal(workspaceSchema.safeParse(updated).success, true);
  });
});
