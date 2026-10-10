"use client";

import { useId, useMemo, useState, type CSSProperties } from "react";
import { ChevronDown, FolderOpen, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Note, Topic } from "@/lib/brain/model";
import { flattenTopics, getTopicAncestors, getTopicDescendantIds, getTopicPathLabel } from "@/lib/brain/topics";

export type TopicTreeProps = {
  topics: Topic[];
  notes: Note[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onEdit?: (topic: Topic) => void;
  onCreateChild?: (parentId: string) => void;
  compact?: boolean;
};

type TopicNode = { topic: Topic; depth: number; children: TopicNode[] };

export function TopicTree({ topics, notes, selectedId, onSelect, onEdit, onCreateChild, compact = false }: TopicTreeProps) {
  const treeId = useId();
  const [collapsed, setCollapsed] = useState<Map<string, string | undefined>>(() => new Map());
  const selectedAncestors = new Set(selectedId ? getTopicAncestors(topics, selectedId).map(topic => topic.id) : []);
  const roots = useMemo(() => {
    const tree: TopicNode[] = [];
    const ancestors: TopicNode[] = [];
    for (const { topic, depth } of flattenTopics(topics)) {
      const node: TopicNode = { topic, depth, children: [] };
      if (depth === 0) tree.push(node);
      else ancestors[depth - 1].children.push(node);
      ancestors[depth] = node;
      ancestors.length = depth + 1;
    }
    return tree;
  }, [topics]);
  const counts = useMemo(() => {
    const directCounts = new Map<string, number>();
    for (const note of notes) if (!note.archived && note.topicId) directCounts.set(note.topicId, (directCounts.get(note.topicId) ?? 0) + 1);
    return new Map(topics.map(topic => [topic.id, [...getTopicDescendantIds(topics, topic.id)].reduce((total, id) => total + (directCounts.get(id) ?? 0), 0)]));
  }, [topics, notes]);

  function toggle(id: string, isCollapsed: boolean) {
    setCollapsed(current => {
      const next = new Map(current);
      if (isCollapsed) next.delete(id);
      else next.set(id, selectedId);
      return next;
    });
  }

  function renderNode({ topic, depth, children }: TopicNode) {
    // Reveal a newly selected descendant, while still allowing its parent to be closed.
    const isCollapsed = collapsed.has(topic.id) && (!selectedAncestors.has(topic.id) || collapsed.get(topic.id) === selectedId);
    const count = counts.get(topic.id) ?? 0;
    const childId = treeId + "-" + topic.id;
    const isSelected = selectedId === topic.id;
    return <li key={topic.id} className="topic-tree-node">
      <div className={"topic-tree-row" + (isSelected ? " is-selected" : "")} style={{ "--topic-depth": depth } as CSSProperties}>
        {children.length > 0 ? <button type="button" className="topic-tree-toggle" aria-label={topic.title + (isCollapsed ? ": Unterthemen anzeigen" : ": Unterthemen ausblenden")} aria-expanded={!isCollapsed} aria-controls={childId} onClick={() => toggle(topic.id, isCollapsed)}><ChevronDown size={16} aria-hidden="true" /></button> : <span className="topic-tree-toggle-space" aria-hidden="true" />}
        <button type="button" className="topic-tree-open" onClick={() => onSelect(topic.id)} aria-current={isSelected ? "page" : undefined} title={getTopicPathLabel(topics, topic.id)}>
          <span className={"topic-dot " + topic.color} aria-hidden="true" />
          <span className="topic-tree-copy"><strong>{topic.title}</strong>{!compact && topic.description && <span className="topic-tree-description">{topic.description}</span>}{!compact && <small>{children.length > 0 && `${children.length} ${children.length === 1 ? "Unterthema" : "Unterthemen"} · `}{count} {count === 1 ? "Notiz" : "Notizen"}{children.length > 0 && " insgesamt"}</small>}</span>
          {compact && <span className="topic-tree-count" aria-label={`${count} ${count === 1 ? "Notiz" : "Notizen"}, einschließlich Unterthemen`}>{count}</span>}
        </button>
        {(onCreateChild || onEdit) && <div className="topic-tree-actions">{onCreateChild && <Button type="button" variant="ghost" size="icon" aria-label={"Unterthema für " + topic.title + " anlegen"} title="Unterthema anlegen" onClick={() => onCreateChild(topic.id)}><Plus size={16} /></Button>}{onEdit && <Button type="button" variant="ghost" size="icon" aria-label={topic.title + " bearbeiten"} title="Thema bearbeiten" onClick={() => onEdit(topic)}><Pencil size={15} /></Button>}</div>}
      </div>
      {children.length > 0 && <ul id={childId} className="topic-tree-children" aria-label={"Unterthemen von " + topic.title} hidden={isCollapsed}>{children.map(renderNode)}</ul>}
    </li>;
  }

  if (!topics.length) return <div className="topic-tree-empty"><FolderOpen size={24} aria-hidden="true" /><p>Lege ein Fachthema an. Unterthemen helfen dir, dein Wissen Schritt für Schritt zu ordnen.</p></div>;
  return <nav className={"topic-tree" + (compact ? " is-compact" : "")} aria-label="Themenstruktur"><ul className="topic-tree-roots">{roots.map(renderNode)}</ul></nav>;
}
