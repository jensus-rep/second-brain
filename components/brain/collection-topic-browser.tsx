"use client";

import { Fragment, useState } from "react";
import { BookOpen, ChevronRight, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import type { LearningCollection, Workspace } from "@/lib/brain/model";
import { collectionItems } from "@/lib/brain/learning-collections";
import { collectionTopicNavigation } from "@/lib/brain/collection-topics";
import { getTopicPathLabel } from "@/lib/brain/topics";
import { withLearningNotes } from "@/lib/brain/quiz-content";

export function CollectionTopicBrowser({ workspace, collection, topicId, onTopicChange, onOpenNote }: {
  workspace: Workspace; collection: LearningCollection; topicId: string; onTopicChange: (id: string) => void; onOpenNote: (id: string, sequence?: string[]) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const navigation = collectionTopicNavigation(workspace, collection, topicId);
  const path = navigation.path[0]?.title === collection.title ? navigation.path.slice(1) : navigation.path;
  const items = collectionItems(workspace, collection);
  const choose = (id: string) => { setShowAll(false); onTopicChange(id); };
  const displayedNotes = showAll || !navigation.branches.length ? navigation.scopedNotes : navigation.directNotes;
  const crossCuttingIds = new Set(["produktentwicklung", "fuehrung-zusammenarbeit", "datenprojekte"]);
  const groups = navigation.current?.id === "agpm1-topic" ? [
    { label: "Grundlagen und Vorgehensweisen", branches: navigation.branches.filter(branch => !crossCuttingIds.has(branch.topic.id)) },
    { label: "Übergreifende Fachthemen", branches: navigation.branches.filter(branch => crossCuttingIds.has(branch.topic.id)) },
  ] : [{ label: navigation.current?.id === "ki-machine-learning" ? "Lernparadigmen" : navigation.current ? "Nächste Ebene" : "Fachthemen", branches: navigation.branches }];
  return <section className="collection-topic-browser" aria-label="Themen in dieser Lernsammlung">
    <div className="collection-content-heading"><h3><BookOpen size={16} />Wissen in dieser Sammlung</h3><label className="field"><span>Direkt zu einem Fachthema</span><select aria-label="Inhalte der Lernsammlung nach Thema" value={navigation.unassigned ? "::unassigned" : navigation.current?.id ?? ""} onChange={event => choose(event.target.value)}><option value="">Sammlungsübersicht</option>{navigation.topics.map(topic => <option key={topic.id} value={topic.id}>{getTopicPathLabel(workspace.topics, topic.id)}</option>)}{navigation.unassignedCount > 0 && <option value="::unassigned">Ohne Thema</option>}</select></label></div>
    <Breadcrumb aria-label="Themenpfad der Lernsammlung" className="collection-topic-breadcrumb"><BreadcrumbList>
      <BreadcrumbItem>{path.length || navigation.unassigned ? <BreadcrumbLink asChild><button type="button" onClick={() => choose("")}>{collection.title}</button></BreadcrumbLink> : <BreadcrumbPage>{collection.title}</BreadcrumbPage>}</BreadcrumbItem>
      {path.map((topic, index) => <Fragment key={topic.id}><BreadcrumbSeparator /><BreadcrumbItem>{index === path.length - 1 ? <BreadcrumbPage>{topic.title}</BreadcrumbPage> : <BreadcrumbLink asChild><button type="button" onClick={() => choose(topic.id)}>{topic.title}</button></BreadcrumbLink>}</BreadcrumbItem></Fragment>)}
      {navigation.unassigned && <><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>Ohne Thema</BreadcrumbPage></BreadcrumbItem></>}
    </BreadcrumbList></Breadcrumb>
    {groups.filter(group => group.branches.length).map(group => <div className="collection-topic-group" key={group.label}><div className="collection-level-heading"><h4>{group.label}</h4><p>Wähle ein Thema, um seine Unterthemen und Einträge zu entdecken.</p></div><div className="collection-topic-branches">{group.branches.map(({ topic, noteCount, childCount }) => <button type="button" key={topic.id} className="collection-topic-branch-card" onClick={() => choose(topic.id)}>
      <span className="collection-branch-title"><FolderOpen size={18} aria-hidden="true" /><strong>{topic.title}</strong><ChevronRight size={17} aria-hidden="true" /></span>{topic.description && <span className="collection-branch-description">{topic.description}</span>}<small>{noteCount} {noteCount === 1 ? "Notiz" : "Notizen"}{childCount > 0 && ` · ${childCount} ${childCount === 1 ? "Unterthema" : "Unterthemen"}`}</small>
    </button>)}</div></div>)}
    {!navigation.current && !navigation.unassigned && navigation.unassignedCount > 0 && <Button className="collection-unassigned-link" variant="outline" onClick={() => choose("::unassigned")}>Ohne Thema · {navigation.unassignedCount} Notizen<ChevronRight size={16} /></Button>}
    <div className="collection-note-heading"><h4>{showAll ? "Alle Einträge dieser Ebene und ihrer Unterthemen" : navigation.branches.length ? "Einträge auf dieser Ebene" : "Einträge"} <span>({displayedNotes.length})</span></h4>{!!navigation.branches.length && <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll(value => !value)}>{showAll ? "Nur diese Ebene anzeigen" : `Alle ${navigation.scopedNotes.length} Einträge anzeigen`}</Button>}</div>
    <div className="collection-note-list">{displayedNotes.map(note => <article key={note.id}><button type="button" onClick={() => onOpenNote(note.id, displayedNotes.map(item => item.id))}><strong>{note.title}</strong><span>{note.topicId ? getTopicPathLabel(workspace.topics, note.topicId) : "Ohne Thema"}{note.archived ? " · Archiviert" : ""}</span></button><p>{items.cards.filter(card => card.noteId === note.id).length} Lernkarten · {items.questions.filter(question => withLearningNotes(question).noteIds?.includes(note.id)).length} verknüpfte Testaufgaben</p></article>)}</div>
    {!displayedNotes.length && !!navigation.branches.length && <p className="small-note">Die Einträge liegen in den Unterthemen. Öffne die nächste Ebene oder zeige alle Einträge an.</p>}
    {!displayedNotes.length && !navigation.branches.length && !!items.notes.length && <p className="small-note">Auf dieser Ebene sind in der Sammlung noch keine Notizen enthalten.</p>}
    {!items.notes.length && <p className="collection-empty">Diese Sammlung enthält noch keine Wissensnotizen. Über „Sammlung bearbeiten“ kannst du passende Grundlagen ergänzen.</p>}
  </section>;
}
