import type { LearningCollection, Note, Topic, Workspace } from "./model.ts";
import { collectionItems } from "./learning-collections.ts";
import { flattenTopics, getTopicAncestors, getTopicDescendantIds } from "./topics.ts";

export type CollectionTopicBranch = { topic: Topic; noteCount: number; childCount: number };

/** Only collection members contribute to navigation and counts, never the entire workspace. */
export function collectionTopicNavigation(workspace: Workspace, collection: LearningCollection, selectedId = "") {
  const { notes } = collectionItems(workspace, collection);
  const assignedIds = new Set(notes.flatMap(note => note.topicId ? [note.topicId] : []));
  const ordered = flattenTopics(workspace.topics).map(({ topic }) => topic);
  const includedIds = new Set(ordered.filter(topic =>
    [...getTopicDescendantIds(workspace.topics, topic.id)].some(id => assignedIds.has(id))).map(topic => topic.id));
  const workspaceAssignedIds = new Set(workspace.notes.flatMap(note => note.topicId ? [note.topicId] : []));
  // Empty subtopics still explain the subject's structure (e.g. regression and
  // classification). Branches containing only excluded notes remain out of scope.
  for (const topic of ordered) {
    if (topic.parentId && includedIds.has(topic.parentId)
      && ![...getTopicDescendantIds(workspace.topics, topic.id)].some(id => workspaceAssignedIds.has(id))) includedIds.add(topic.id);
  }
  const topics = ordered.filter(topic => includedIds.has(topic.id));
  const topicIds = new Set(topics.map(topic => topic.id));
  const roots = topics.filter(topic => !topic.parentId || !topicIds.has(topic.parentId));
  // A collection for one subject opens directly at that subject's next level.
  const entry = roots.length === 1 ? roots[0] : undefined;
  const selected = topics.find(topic => topic.id === selectedId);
  const unassigned = selectedId === "::unassigned" && notes.some(note => !note.topicId);
  const current = unassigned ? undefined : selected ?? entry;
  const scope = current ? getTopicDescendantIds(workspace.topics, current.id) : null;
  const scopedNotes = unassigned ? notes.filter(note => !note.topicId) : notes.filter(note => !scope || !!note.topicId && scope.has(note.topicId));
  const children = unassigned ? [] : current ? topics.filter(topic => topic.parentId === current.id) : roots;
  const branches: CollectionTopicBranch[] = children.map(topic => {
    const descendants = getTopicDescendantIds(workspace.topics, topic.id);
    return { topic, noteCount: notes.filter(note => !!note.topicId && descendants.has(note.topicId)).length,
      childCount: topics.filter(child => child.parentId === topic.id).length };
  });
  const directNotes: Note[] = unassigned ? scopedNotes : notes.filter(note => current ? note.topicId === current.id : !note.topicId);
  const path = current ? [...getTopicAncestors(workspace.topics, current.id), current].filter(topic => topicIds.has(topic.id)) : [];
  return { topics, current, branches, path, directNotes, scopedNotes, unassigned,
    unassignedCount: notes.filter(note => !note.topicId).length };
}
