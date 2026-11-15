import type { Topic } from "./model";

/**
 * Each top-level topic („Gebiet“) gets its own tone for orientation.
 * The tone is derived from the order of the root topics, so the stored
 * topic colour (four values) stays untouched and old clients keep working.
 */
export const AREA_TONES = ["forest", "teal", "violet", "sky", "clay"] as const;
export type AreaTone = (typeof AREA_TONES)[number];

export function rootTopics(topics: Topic[]): Topic[] {
  const ids = new Set(topics.map(topic => topic.id));
  return topics.filter(topic => !topic.parentId || !ids.has(topic.parentId));
}

export function rootTopicId(topics: Topic[], topicId: string | null | undefined): string | null {
  if (!topicId) return null;
  const byId = new Map(topics.map(topic => [topic.id, topic]));
  let current = byId.get(topicId);
  const seen = new Set<string>();
  while (current?.parentId && byId.has(current.parentId) && !seen.has(current.id)) {
    seen.add(current.id);
    current = byId.get(current.parentId);
  }
  return current?.id ?? null;
}

export function areaTone(topics: Topic[], topicId: string | null | undefined): AreaTone | null {
  const root = rootTopicId(topics, topicId);
  if (!root) return null;
  const index = rootTopics(topics).findIndex(topic => topic.id === root);
  return index < 0 ? null : AREA_TONES[index % AREA_TONES.length];
}
