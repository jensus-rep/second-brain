import type { Topic } from "./model.ts";

/** Ancestors from the root to the immediate parent, excluding the topic itself. */
export function getTopicAncestors(topics: Topic[], id: string): Topic[] {
  const byId = new Map(topics.map(topic => [topic.id, topic]));
  const ancestors: Topic[] = [];
  const visited = new Set([id]);
  let parentId = byId.get(id)?.parentId;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    ancestors.unshift(parent);
    parentId = parent.parentId;
  }
  return ancestors;
}

/** Includes the selected topic and every nested topic. Unknown IDs have no descendants. */
export function getTopicDescendantIds(topics: Topic[], id: string): Set<string> {
  if (!topics.some(topic => topic.id === id)) return new Set();
  const children = new Map<string, string[]>();
  for (const topic of topics) {
    if (!topic.parentId) continue;
    const siblings = children.get(topic.parentId) ?? [];
    siblings.push(topic.id);
    children.set(topic.parentId, siblings);
  }
  const descendants = new Set<string>();
  const pending = [id];
  while (pending.length) {
    const next = pending.pop()!;
    if (descendants.has(next)) continue;
    descendants.add(next);
    pending.push(...children.get(next) ?? []);
  }
  return descendants;
}

export function getTopicPathLabel(topics: Topic[], id: string): string {
  const topic = topics.find(topic => topic.id === id);
  return topic ? [...getTopicAncestors(topics, id), topic].map(item => item.title).join(" › ") : "Ohne Thema";
}

/** Keep deep selection lists readable; the full path remains available separately. */
export function getTopicOptionLabel(topics: Topic[], id: string): string {
  const topic = topics.find(topic => topic.id === id);
  if (!topic) return "Ohne Thema";
  const path = [...getTopicAncestors(topics, id), topic];
  return path.length > 4 ? [path[0].title, "…", ...path.slice(-2).map(item => item.title)].join(" › ") : path.map(item => item.title).join(" › ");
}

/** Preserve sibling ordering while keeping every parent next to its descendants. */
export function flattenTopics(topics: Topic[]): { topic: Topic; depth: number }[] {
  const ids = new Set(topics.map(topic => topic.id));
  const children = new Map<string | null, Topic[]>();
  for (const topic of topics) {
    const parentId = topic.parentId && ids.has(topic.parentId) ? topic.parentId : null;
    const siblings = children.get(parentId) ?? [];
    siblings.push(topic);
    children.set(parentId, siblings);
  }
  const ordered: { topic: Topic; depth: number }[] = [];
  const visited = new Set<string>();
  function visit(topic: Topic, depth: number) {
    if (visited.has(topic.id)) return;
    visited.add(topic.id);
    ordered.push({ topic, depth });
    for (const child of children.get(topic.id) ?? []) visit(child, depth + 1);
  }
  for (const root of children.get(null) ?? []) visit(root, 0);
  // Invalid imported drafts are still safe to render before validation reports a cycle.
  for (const topic of topics) if (!visited.has(topic.id)) visit(topic, 0);
  return ordered;
}
