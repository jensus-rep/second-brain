import { workspaceSchema, type Topic, type Workspace } from "./model.ts";
import { getTopicPathLabel } from "./topics.ts";

// Explicit assignments for the existing knowledge corpus. No title/tag guessing.
// An explicit parentId (including null) is a user's choice and is never replaced.
const parentAssignments: Record<string, string> = {
  "pm-grundlagen": "agpm1-topic",
  "pm-klassisch": "agpm1-topic", "agile-umsetzung": "agpm1-topic", "pm-hybrid": "agpm1-topic",
  "produktentwicklung": "agpm1-topic", "fuehrung-zusammenarbeit": "agpm1-topic", "datenprojekte": "agpm1-topic",
  "pm-agil-frameworks": "agile-umsetzung", "pm-agil-praktiken": "agile-umsetzung",
  "organisation-skalierung": "agile-umsetzung", "pm-scrum": "pm-agil-frameworks",
  "pm-agil-anforderungen": "pm-agil-praktiken", "pm-agil-schaetzen": "pm-agil-praktiken", "pm-agil-planung": "pm-agil-praktiken",
  "ki-machine-learning": "ki",
  "ki-ml-supervised": "ki-machine-learning", "ki-ml-unsupervised": "ki-machine-learning",
  "ki-ml-self-supervised": "ki-machine-learning", "ki-ml-reinforcement": "ki-machine-learning",
  "ki-sl-regression": "ki-ml-supervised", "ki-sl-klassifikation": "ki-ml-supervised",
  "ki-ul-clustering": "ki-ml-unsupervised", "ki-ul-dimensionsreduktion": "ki-ml-unsupervised", "ki-ul-anomalien": "ki-ml-unsupervised",
  "ki-ssl-sprachmodelle": "ki-ml-self-supervised", "ki-ssl-kontrastiv": "ki-ml-self-supervised",
  "ki-rl-wertbasiert": "ki-ml-reinforcement", "ki-rl-policy": "ki-ml-reinforcement", "ki-rl-banditen": "ki-ml-reinforcement",
  "fm-quantitativ": "fm-topic", "fm-qualitativ": "fm-topic", "fm-konstruktiv": "fm-topic",
  "swe-python": "swe-topic", "swe-web": "swe-topic",
};

const fundamentals: Topic = { id: "pm-grundlagen", title: "Gemeinsame Grundlagen", color: "blue", parentId: "agpm1-topic",
  description: "Ziele, Auftrag, Stakeholder, Verantwortung, Risiken und Steuerung für klassische, agile und hybride Vorhaben." };

const sharedNotes: Record<string, string> = {
  "agpm1-note-start": "agpm1-topic", "agpm1-note-quellen": "agpm1-topic",
  "agpm1-note-projektauftrag": "agpm1-topic", "agpm1-note-stakeholder": "agpm1-topic",
  "agpm1-note-werkzeuge": "agpm1-topic", "agpm1-chapter-planung": "agpm1-topic",
  "agpm1-note-pm-grundlagen": "agpm1-topic", "agpm1-note-pm-dreieck": "agpm1-topic",
  "agpm1-note-risiko": "pm-klassisch", "agpm1-note-controlling": "pm-klassisch", "agpm1-note-raci": "pm-klassisch",
};

export type TopicStructureProposal = {
  topics: Topic[];
  topicChanges: { id: string; title: string; before: string; after: string }[];
  noteChanges: { id: string; title: string; before: string; after: string }[];
};

/** Propose missing hierarchy only. Existing custom hierarchies and IDs stay intact. */
export function proposeTopicStructure(workspace: Workspace): TopicStructureProposal | null {
  const original = new Map(workspace.topics.map(topic => [topic.id, topic]));
  const addFundamentals = original.has("agpm1-topic") && !original.has(fundamentals.id)
    && workspace.topics.length < 100
    && !workspace.topics.some(topic => topic.parentId === "agpm1-topic")
    && workspace.notes.some(note => note.topicId === sharedNotes[note.id]);
  const available = new Set([...original.keys(), ...(addFundamentals ? [fundamentals.id] : [])]);
  const topics = workspace.topics.map(topic => topic.parentId === undefined && available.has(parentAssignments[topic.id])
    ? { ...topic, parentId: parentAssignments[topic.id] } : topic);
  if (addFundamentals) topics.splice(topics.findIndex(topic => topic.id === "agpm1-topic") + 1, 0, { ...fundamentals });
  // Parent first, followed by the requested approaches; preserve order within each group.
  const pmOrder = ["pm-grundlagen", "agile-umsetzung", "pm-klassisch", "pm-hybrid", "produktentwicklung", "fuehrung-zusammenarbeit", "datenprojekte"];
  const pmChildren = topics.filter(topic => topic.parentId === "agpm1-topic");
  const newPmStructure = pmChildren.some(topic => original.get(topic.id)?.parentId === undefined);
  const ordered = newPmStructure ? [...pmChildren].sort((a, b) => {
    const rank = (id: string) => pmOrder.includes(id) ? pmOrder.indexOf(id) : pmOrder.length;
    return rank(a.id) - rank(b.id);
  }) : pmChildren;
  let childIndex = 0;
  const proposedTopics = topics.map(topic => topic.parentId === "agpm1-topic" ? ordered[childIndex++] : topic);
  const canMoveNotes = addFundamentals;
  const notes = workspace.notes.map(note => canMoveNotes && note.topicId === sharedNotes[note.id]
    ? { ...note, topicId: fundamentals.id } : note);
  const valid = workspaceSchema.safeParse({ ...workspace, topics: proposedTopics, notes });
  if (!valid.success) return null;
  const topicChanges = proposedTopics.filter(topic => !original.has(topic.id) || original.get(topic.id)?.parentId !== topic.parentId)
    .map(topic => ({ id: topic.id, title: topic.title, before: original.has(topic.id) ? getTopicPathLabel(workspace.topics, topic.id) : "Neues Unterthema",
      after: getTopicPathLabel(proposedTopics, topic.id) }));
  const noteChanges = notes.filter((note, index) => note.topicId !== workspace.notes[index].topicId).map(note => ({ id: note.id, title: note.title,
    before: getTopicPathLabel(workspace.topics, workspace.notes.find(item => item.id === note.id)!.topicId!),
    after: getTopicPathLabel(proposedTopics, note.topicId!) }));
  return topicChanges.length || noteChanges.length ? { topics: proposedTopics, topicChanges, noteChanges } : null;
}

/** Recompute from the latest queued revision, then validate before the normal API save. */
export function applyTopicStructure(workspace: Workspace): Workspace {
  const proposal = proposeTopicStructure(workspace);
  if (!proposal) return workspace;
  const moved = new Set(proposal.noteChanges.map(note => note.id));
  return workspaceSchema.parse({ ...workspace, topics: proposal.topics,
    notes: workspace.notes.map(note => moved.has(note.id) ? { ...note, topicId: fundamentals.id } : note) });
}
