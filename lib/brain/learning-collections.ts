import type { Flashcard, FlashcardPriority, LearningCollection, LearningPath, Note, QuizQuestion, Topic, Workspace } from "./model.ts";
import { curatedLearningCollections } from "./curated-learning-collections.ts";

export const priorityLabels: Record<FlashcardPriority, string> = {
  1: "Kernwissen", 2: "Vertiefung", 3: "Ergänzung",
};
export const priorityDescriptions: Record<FlashcardPriority, string> = {
  1: "Muss sicher sitzen.",
  2: "Zusammenhänge und Anwendung vertiefen.",
  3: "Ergänzende Details und besondere Fälle.",
};

export function flashcardContentFingerprint(card: Pick<Flashcard, "question" | "answer">): string {
  const value = card.question + "\n" + card.answer;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function flashcardPriority(card: Flashcard): FlashcardPriority | null {
  if (card.priority !== undefined) return card.priority;
  const proposal = curatedLearningCollections.priorities[card.id];
  return proposal?.fingerprint === flashcardContentFingerprint(card) ? proposal.priority : null;
}

function resolveIds<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const byId = new Map(items.map(item => [item.id, item]));
  return [...new Set(ids)].flatMap(id => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

export function collectionItems(workspace: Workspace, collection: LearningCollection): {
  notes: Note[]; questions: QuizQuestion[]; cards: Flashcard[]; paths: LearningPath[]; topics: Topic[];
} {
  const notes = resolveIds(workspace.notes, collection.noteIds);
  const questions = resolveIds(workspace.quizQuestions, collection.questionIds);
  const paths = resolveIds(workspace.paths, collection.pathIds);
  const linkedNotes = new Set(collection.noteIds);
  const explicitCards = resolveIds(workspace.cards, collection.cardIds);
  const explicitIds = new Set(explicitCards.map(card => card.id));
  const cards = [...explicitCards, ...workspace.cards.filter(card => !explicitIds.has(card.id) && card.noteId !== null && linkedNotes.has(card.noteId))];
  const topicIds = new Set(notes.flatMap(note => note.topicId ? [note.topicId] : []));
  return { notes, questions, cards, paths, topics: workspace.topics.filter(topic => topicIds.has(topic.id)) };
}

function filteredProposal(workspace: Workspace, proposal: LearningCollection): LearningCollection {
  return {
    ...proposal,
    noteIds: resolveIds(workspace.notes, proposal.noteIds).map(note => note.id),
    questionIds: resolveIds(workspace.quizQuestions, proposal.questionIds).map(question => question.id),
    cardIds: resolveIds(workspace.cards, proposal.cardIds).map(card => card.id),
    pathIds: resolveIds(workspace.paths, proposal.pathIds).map(path => path.id),
  };
}

function fallbackId(prefix: string, value: string): string {
  return prefix + "-" + flashcardContentFingerprint({ question: value, answer: "" });
}

// Saved collections win over proposals with the same ID. Defaults do not alter
// the workspace and never bring in missing items from another user's collection.
export function learningCollections(workspace: Workspace): LearningCollection[] {
  const collections = [...(workspace.learningCollections ?? [])];
  const collectionIds = new Set(collections.map(collection => collection.id));
  for (const proposal of curatedLearningCollections.collections) {
    if (collectionIds.has(proposal.id)) continue;
    const available = filteredProposal(workspace, proposal);
    if (![available.noteIds, available.questionIds, available.cardIds, available.pathIds].some(ids => ids.length)) continue;
    collections.push(available);
    collectionIds.add(available.id);
  }

  const coveredNotes = new Set<string>();
  const coveredQuestions = new Set<string>();
  const coveredCards = new Set<string>();
  const coveredPaths = new Set<string>();
  const cover = (collection: LearningCollection) => {
    const items = collectionItems(workspace, collection);
    items.notes.forEach(note => coveredNotes.add(note.id));
    items.questions.forEach(question => coveredQuestions.add(question.id));
    items.cards.forEach(card => coveredCards.add(card.id));
    items.paths.forEach(path => coveredPaths.add(path.id));
  };
  const add = (collection: LearningCollection) => {
    // A saved version can intentionally contain a smaller selection. Do not
    // disguise an automatic second version behind a suffixed duplicate title.
    if (collectionIds.has(collection.id)) return;
    collections.push(collection);
    collectionIds.add(collection.id);
    cover(collection);
  };
  collections.forEach(cover);

  // These groups use structured subject/topic assignments only. Notes, questions
  // and paths are not expanded through text matching or related-note traversal.
  const subjects = [...new Set(workspace.quizQuestions.filter(question => !coveredQuestions.has(question.id)).map(question => question.subject))];
  for (const subject of subjects) {
    const questions = workspace.quizQuestions.filter(question => question.subject === subject);
    const linkedNoteIds = questions.flatMap(question => question.noteIds ?? []);
    add({
      id: fallbackId("learning-subject", subject), title: subject, description: "Testaufgaben dieses Fachthemas.",
      noteIds: resolveIds(workspace.notes, linkedNoteIds).map(note => note.id), questionIds: questions.map(question => question.id), cardIds: [], pathIds: [],
    });
  }
  for (const topic of workspace.topics) {
    const notes = workspace.notes.filter(note => note.topicId === topic.id);
    if (!notes.some(note => !coveredNotes.has(note.id))) continue;
    const noteIds = notes.map(note => note.id);
    add({ id: fallbackId("learning-topic", topic.id), title: topic.title, description: topic.description, noteIds, questionIds: [], cardIds: [], pathIds: [] });
  }
  const remainingNotes = workspace.notes.filter(note => !coveredNotes.has(note.id)).map(note => note.id);
  const remainingQuestions = workspace.quizQuestions.filter(question => !coveredQuestions.has(question.id)).map(question => question.id);
  const remainingCards = workspace.cards.filter(card => !coveredCards.has(card.id)).map(card => card.id);
  const remainingPaths = workspace.paths.filter(path => !coveredPaths.has(path.id)).map(path => path.id);
  if (remainingNotes.length || remainingQuestions.length || remainingCards.length || remainingPaths.length) {
    add({
      id: "learning-unassigned", title: "Weitere Lerninhalte", description: "Inhalte, die noch keiner Lernsammlung zugeordnet sind.",
      noteIds: remainingNotes, questionIds: remainingQuestions, cardIds: remainingCards, pathIds: remainingPaths,
    });
  }
  return collections;
}

// Resolve the selection from the latest state after adding the item. Adopting a
// proposal and adding its first explicit member happens in the same revision.
export function addToLearningCollection(workspace: Workspace, collectionId: string, key: "cardIds" | "questionIds", itemId: string): Workspace {
  const bank = key === "cardIds" ? workspace.cards : workspace.quizQuestions;
  if (!collectionId || !bank.some(item => item.id === itemId)) return workspace;
  const saved = workspace.learningCollections ?? [];
  const existing = saved.find(collection => collection.id === collectionId);
  const selected = existing ?? learningCollections(workspace).find(collection => collection.id === collectionId);
  if (!selected) return workspace;
  if (existing && existing[key].includes(itemId)) return workspace;
  if (!existing && saved.length >= 100) throw new Error("Die Grenze von 100 gespeicherten Lernsammlungen ist erreicht. Die neue Zuordnung konnte nicht gespeichert werden.");
  const updated = { ...selected, [key]: [...new Set([...selected[key], itemId])] };
  return {
    ...workspace,
    learningCollections: existing
      ? saved.map(collection => collection.id === collectionId ? updated : collection)
      : [...saved, updated],
  };
}

// Removing a card through the existing UI must clean persisted membership links
// in the same revision. Shared collections retain their other cards and progress.
export function removeFlashcard(workspace: Workspace, cardId: string): Workspace {
  return {
    ...workspace,
    cards: workspace.cards.filter(card => card.id !== cardId),
    learningCollections: (workspace.learningCollections ?? []).map(collection => collection.cardIds.includes(cardId)
      ? { ...collection, cardIds: collection.cardIds.filter(id => id !== cardId) } : collection),
  };
}
