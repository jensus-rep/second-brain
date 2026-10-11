"use client";

import { ArrowRight, ChevronRight, FolderOpen } from "lucide-react";
import type { Workspace } from "@/lib/brain/model";
import { getTopicDescendantIds } from "@/lib/brain/topics";

export function KnowledgeOrientation({ workspace, onTopic, onTopics }: {
  workspace: Workspace; onTopic: (id: string) => void; onTopics: () => void;
}) {
  const notes = workspace.notes.filter(note => !note.archived);
  const roots = workspace.topics.filter(topic => !topic.parentId);
  return <section className="knowledge-orientation" aria-label="Themen entdecken">
    <div className="section-heading"><h2>Deine Wissensgebiete</h2><FolderOpen size={17} aria-hidden="true" /></div>
    <p className="orientation-caption">{roots.length} Fachthemen · {notes.length} aktive Einträge</p>
    <div className="orientation-topics">{roots.slice(0, 5).map(topic => {
      const scope = getTopicDescendantIds(workspace.topics, topic.id);
      const count = notes.filter(note => note.topicId && scope.has(note.topicId)).length;
      const children = workspace.topics.filter(child => child.parentId === topic.id);
      return <button key={topic.id} className={"orientation-topic " + topic.color} onClick={() => onTopic(topic.id)}>
        <span className="orientation-topic-heading"><span className={"topic-dot " + topic.color} /><strong>{topic.title}</strong><span>{count}</span><ChevronRight size={14} aria-hidden="true" /></span>
        {children.length > 0 && <span className="orientation-topic-children">{children.slice(0, 2).map(child => child.title).join(" · ")}{children.length > 2 && ` · +${children.length - 2}`}</span>}
        <span className="orientation-topic-meter" aria-hidden="true"><span style={{ width: `${notes.length ? count / notes.length * 100 : 0}%` }} /></span>
      </button>;
    })}</div>
    {roots.length > 0 ? <p className="orientation-legend">Einträge einschließlich Unterthemen</p> : <p className="orientation-caption">Ordne deine Gedanken nach Fachthemen.</p>}
    <button className="workspace-text-link" onClick={onTopics}>Alle Themen ansehen<ArrowRight size={15} aria-hidden="true" /></button>
  </section>;
}
