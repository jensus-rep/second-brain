"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ClipboardCheck, FolderOpen, Layers3, Pencil, Play, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { learningCollectionSchema, type LearningCollection, type Workspace } from "@/lib/brain/model";
import { collectionItems, flashcardPriority, learningCollections, priorityDescriptions, priorityLabels } from "@/lib/brain/learning-collections";
import { flattenTopics, getTopicDescendantIds, getTopicPathLabel } from "@/lib/brain/topics";
import { withLearningNotes } from "@/lib/brain/quiz-content";
import type { SaveWorkspace } from "@/lib/brain/use-brain";
import { CollectionTopicBrowser } from "./collection-topic-browser";
import { TopicStructureSetup } from "./topic-structure-setup";

type Props = {
  workspace: Workspace;
  save: SaveWorkspace;
  saving: boolean;
  collectionId: string;
  onCollectionChange: (id: string) => void;
  onOpenNote: (id: string) => void;
  onOpenCards: (id: string) => void;
  onStartCards?: (id: string) => void;
  onOpenQuizzes: (id: string) => void;
  onOpenPath: (id: string) => void;
  compact?: boolean;
  onOpenCollection?: (id: string) => void;
  onOpenAllCollections?: () => void;
};

function CollectionEditor({ collection, workspace, save, saving, onClose, onSaved }: {
  collection: LearningCollection; workspace: Workspace; save: SaveWorkspace; saving: boolean;
  onClose: () => void; onSaved: (id: string) => void;
}) {
  const [draft, setDraft] = useState(collection);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const dirty = JSON.stringify(collection) !== JSON.stringify(draft);
  const matches = (text: string) => text.toLocaleLowerCase("de").includes(search.toLocaleLowerCase("de"));
  const included = collectionItems(workspace, draft);
  const topicBranches = flattenTopics(workspace.topics).map(({ topic, depth }) => {
    const scope = getTopicDescendantIds(workspace.topics, topic.id);
    const notes = workspace.notes.filter(note => !!note.topicId && scope.has(note.topicId));
    return { topic, depth, notes, activeNotes: notes.filter(note => !note.archived) };
  }).filter(branch => branch.notes.length > 0);
  const matchingNotes = workspace.notes.filter(note => matches(note.title + " " + (note.topicId ? getTopicPathLabel(workspace.topics, note.topicId) : "Ohne Thema")));
  const noteGroups = [
    ...flattenTopics(workspace.topics).map(({ topic }) => ({ id: topic.id, title: getTopicPathLabel(workspace.topics, topic.id), notes: matchingNotes.filter(note => note.topicId === topic.id) })),
    { id: "::unassigned", title: "Ohne Thema", notes: matchingNotes.filter(note => !note.topicId) },
  ].filter(group => group.notes.length > 0);
  function toggle(key: "noteIds" | "questionIds" | "cardIds" | "pathIds", id: string, checked: boolean) {
    setDraft(current => ({ ...current, [key]: checked ? [...new Set([...current[key], id])] : current[key].filter(value => value !== id) }));
  }
  function close() { if (!saving && (!dirty || window.confirm("Nicht gespeicherte Änderungen verwerfen?"))) onClose(); }
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="editor-dialog collection-editor" onInteractOutside={event => event.preventDefault()}><DialogHeader><DialogTitle>Lernsammlung zusammenstellen</DialogTitle><DialogDescription>Fasse zusammengehörende Themen zusammen. Lernkarten zu den gewählten Notizen gehören automatisch dazu.</DialogDescription></DialogHeader>
    <form className="editor-form" inert={saving} aria-busy={saving} onSubmit={async event => {
      event.preventDefault(); setError("");
      const parsed = learningCollectionSchema.safeParse(draft);
      if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Bitte die Sammlung prüfen."); return; }
      if (await save(current => ({ ...current, learningCollections: [...current.learningCollections.filter(item => item.id !== draft.id), parsed.data] }), "Lernsammlung gespeichert")) { onSaved(draft.id); onClose(); }
    }}>
      <label className="field"><span>Name der Lernsammlung</span><Input required maxLength={160} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
      <label className="field"><span>Umfang und Lernziel</span><Textarea maxLength={600} rows={3} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="Welche Inhalte gehören dazu? Was möchtest du sicher erklären können?" /></label>
      <p className="collection-editor-count" aria-live="polite">Enthalten: {included.notes.length} Notizen · {included.cards.length} Lernkarten · {included.questions.length} Testaufgaben · {included.paths.length} Lernpfade</p>
      <Input aria-label="Inhalte für Lernsammlung filtern" placeholder="Notizen, Fragen oder Themen finden …" value={search} onChange={event => setSearch(event.target.value)} />
      <details open className="collection-picker"><summary>Notizen und Fachthemen ({draft.noteIds.length})</summary>
        <p>Übergeordnete Themen übernehmen auch die aktiven Notizen ihrer Unterthemen.</p>
        <div className="collection-topic-actions collection-topic-tree" aria-label="Fachthemen zur Lernsammlung hinzufügen">{topicBranches.map(({ topic, depth, activeNotes }) => <div className="collection-topic-row" data-depth={Math.min(depth, 3)} key={topic.id}>
          <Button type="button" variant="outline" size="sm" disabled={!activeNotes.length} title={getTopicPathLabel(workspace.topics, topic.id)} onClick={() => setDraft(current => ({ ...current, noteIds: [...new Set([...current.noteIds, ...activeNotes.map(note => note.id)])] }))}>{depth > 0 && <span className="collection-topic-branch" aria-hidden="true">↳</span>}{topic.title} hinzufügen</Button>
          <small>{activeNotes.length} aktive {activeNotes.length === 1 ? "Notiz" : "Notizen"}{workspace.topics.some(child => child.parentId === topic.id) ? " · mit Unterthemen" : ""}</small>
        </div>)}</div>
        <div className="collection-picker-list">{noteGroups.map(group => <div className="collection-note-group" key={group.id}><h4>{group.title}</h4>{group.notes.map(note => <label key={note.id}><Checkbox checked={draft.noteIds.includes(note.id)} onCheckedChange={checked => toggle("noteIds", note.id, checked === true)} /><span>{note.title}{note.archived ? " · Archiviert" : ""}</span></label>)}</div>)}</div>
      </details>
      <details className="collection-picker"><summary>Testaufgaben ({draft.questionIds.length})</summary>
        <div className="collection-topic-actions"><Button type="button" variant="outline" size="sm" onClick={() => setDraft(current => ({ ...current, questionIds: [...new Set([...current.questionIds, ...workspace.quizQuestions.filter(question => withLearningNotes(question).noteIds?.some(id => current.noteIds.includes(id))).map(question => question.id)])] }))}>Verknüpfte Testaufgaben hinzufügen</Button>
          {[...new Set(workspace.quizQuestions.map(question => question.subject))].map(subject => <Button type="button" key={subject} variant="outline" size="sm" onClick={() => setDraft(current => ({ ...current, questionIds: [...new Set([...current.questionIds, ...workspace.quizQuestions.filter(question => question.subject === subject).map(question => question.id)])] }))}>{subject}: alle Aufgaben hinzufügen</Button>)}</div>
        <div className="collection-picker-list">{workspace.quizQuestions.filter(question => matches(question.prompt + " " + question.subject + " " + question.concept)).map(question => <label key={question.id}><Checkbox checked={draft.questionIds.includes(question.id)} onCheckedChange={checked => toggle("questionIds", question.id, checked === true)} /><span>{question.prompt}<small>{question.subject} · {question.concept}</small></span></label>)}</div>
      </details>
      <details className="collection-picker"><summary>Zusätzliche Lernkarten ({draft.cardIds.length})</summary><p>Karten aus den gewählten Notizen sind bereits enthalten. Hier kannst du weitere Karten hinzufügen.</p><div className="collection-picker-list">{workspace.cards.filter(card => !draft.noteIds.includes(card.noteId ?? "") && matches(card.question)).map(card => <label key={card.id}><Checkbox checked={draft.cardIds.includes(card.id)} onCheckedChange={checked => toggle("cardIds", card.id, checked === true)} /><span>{card.question.slice(0, 180)}</span></label>)}</div></details>
      <details className="collection-picker"><summary>Lernpfade ({draft.pathIds.length})</summary><div className="collection-picker-list">{workspace.paths.filter(path => matches(path.title)).map(path => <label key={path.id}><Checkbox checked={draft.pathIds.includes(path.id)} onCheckedChange={checked => toggle("pathIds", path.id, checked === true)} /><span>{path.title}</span></label>)}</div></details>
      {error && <p role="alert">{error}</p>}<div className="dialog-actions"><Button type="button" variant="outline" onClick={close}>Abbrechen</Button><Button type="submit" disabled={saving}>Sammlung speichern</Button></div>
    </form>
  </DialogContent></Dialog>;
}

export function LearningCollectionsOverview({ workspace, save, saving, collectionId, onCollectionChange, onOpenNote, onOpenCards, onStartCards, onOpenQuizzes, onOpenPath, compact = false, onOpenCollection, onOpenAllCollections }: Props) {
  const [editing, setEditing] = useState<LearningCollection | null>(null);
  const [topicFilter, setTopicFilter] = useState("");
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const overviewHeading = useRef<HTMLHeadingElement>(null);
  const previousSelection = useRef<string | null>(null);
  const collections = learningCollections(workspace);
  const entries = collections.map(collection => ({ collection, contents: collectionItems(workspace, collection) }));
  const displayedEntries = compact ? entries.slice(0, 4) : entries;
  const selected = collections.find(collection => collection.id === collectionId);
  const items = entries.find(entry => entry.collection.id === collectionId)?.contents ?? null;
  const coveredNotes = new Set(entries.flatMap(entry => entry.contents.notes.map(note => note.id)));
  const coveredCards = new Set(entries.flatMap(entry => entry.contents.cards.map(card => card.id)));
  const remainingNotes = workspace.notes.filter(note => !note.archived && !coveredNotes.has(note.id)).length;
  const remainingCards = workspace.cards.filter(card => !coveredCards.has(card.id)).length;
  const suggestions = items?.cards.filter(card => card.priority === undefined && flashcardPriority(card) !== null) ?? [];
  const selectedId = selected?.id ?? null;
  useEffect(() => {
    if (compact) return;
    const heading = selectedId ? detailHeading.current : previousSelection.current ? overviewHeading.current : null;
    previousSelection.current = selectedId;
    if (!heading) return;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: "start" });
  }, [compact, selectedId]);
  const choose = (id: string) => { setTopicFilter(""); onCollectionChange(id); if (compact) onOpenCollection?.(id); };
  const newCollection = () => setEditing({ id: crypto.randomUUID(), title: "", description: "", noteIds: [], questionIds: [], cardIds: [], pathIds: [] });
  return <section className="learning-collections" aria-label="Lernsammlungen">
    {!compact && <TopicStructureSetup workspace={workspace} save={save} saving={saving} />}
    {(compact || !selected) && <><div className="section-heading"><div><h2 ref={overviewHeading} tabIndex={-1}>Deine Lernsammlungen</h2><p>Bündle Wissen und Übungen aus mehreren Themen für ein gemeinsames Lernziel.</p></div><Button variant="outline" size="sm" disabled={saving || workspace.learningCollections.length >= 100} onClick={newCollection}><Plus size={15} />Neue Lernsammlung</Button></div>
    <div className="collection-cards">{displayedEntries.map(({ collection, contents }) => {
      return <button type="button" className={`collection-card${selected?.id === collection.id ? " is-selected" : ""}`} key={collection.id} onClick={() => choose(collection.id)} aria-pressed={selected?.id === collection.id}>
        <span className="collection-card-icon"><FolderOpen size={22} aria-hidden="true" /></span><h3>{collection.title}</h3>{collection.description && <p>{collection.description}</p>}
        <div className="collection-card-counts"><span>{contents.notes.length} Notizen</span><span>{contents.cards.length} Lernkarten</span><span>{contents.questions.length} Testaufgaben</span></div>
        <small>{contents.topics.length} Fachthemen · Gesamter Bestand dieser Sammlung</small>
        <span className="collection-card-open">Sammlung öffnen <ArrowRight size={16} aria-hidden="true" /></span>
      </button>;
    })}</div>
    {compact && entries.length > displayedEntries.length && onOpenAllCollections && <div className="collection-overview-footer"><span>{entries.length} Lernsammlungen insgesamt</span><Button variant="outline" size="sm" onClick={onOpenAllCollections}>Alle Lernsammlungen ansehen<ArrowRight size={15} aria-hidden="true" /></Button></div>}
    {!collections.length && <p className="collection-empty">Stelle deine erste Lernsammlung aus zusammengehörenden Notizen und Aufgaben zusammen.</p>}</>}
    {!compact && selected && items && <article className="collection-detail" aria-label={`Lernsammlung ${selected.title}`}>
      <Button className="collection-back" variant="ghost" size="sm" onClick={() => choose("")}><ArrowLeft size={16} />Alle Lernsammlungen</Button>
      <div className="collection-detail-heading"><div><span className="eyebrow">LERNSAMMLUNG</span><h2 ref={detailHeading} tabIndex={-1}>{selected.title}</h2>{selected.description && <p>{selected.description}</p>}</div><Button variant="outline" size="sm" disabled={saving} onClick={() => setEditing(selected)}><Pencil size={15} />Sammlung bearbeiten</Button></div>
      <div className="collection-actions">
        {onStartCards && <Button onClick={() => onStartCards(selected.id)} disabled={!items.cards.length}><Play size={16} />Jetzt lernen</Button>}
        <Button variant={onStartCards ? "outline" : "default"} onClick={() => onOpenCards(selected.id)} disabled={!items.cards.length}><Layers3 size={16} />Lernkarten öffnen</Button>
        <Button variant="outline" onClick={() => onOpenQuizzes(selected.id)} disabled={!items.questions.length}><ClipboardCheck size={16} />Tests öffnen</Button>
        {!workspace.learningCollections.some(collection => collection.id === selected.id) && <Button variant="ghost" disabled={saving || workspace.learningCollections.length >= 100} onClick={() => void save(current => ({ ...current, learningCollections: [...current.learningCollections.filter(collection => collection.id !== selected.id), selected] }), "Lernsammlung gespeichert")}><Save size={15} />Sammlung speichern</Button>}
      </div>
      <dl className="collection-inventory">{[["Notizen", items.notes.length], ["Lernkarten", items.cards.length], ["Testaufgaben", items.questions.length], ["Lernpfade", items.paths.length]].map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
      <CollectionTopicBrowser key={selected.id} workspace={workspace} collection={selected} topicId={topicFilter} onTopicChange={setTopicFilter} onOpenNote={onOpenNote} />
      {!!items.paths.length && <div className="collection-paths"><h3>Passende Lernpfade</h3>{items.paths.map(path => <Button key={path.id} variant="outline" size="sm" onClick={() => onOpenPath(path.id)}>{path.title}</Button>)}</div>}
      <div className="collection-priorities"><h4>Drei Stufen für deine Lernkarten</h4><div>{([1, 2, 3] as const).map(priority => <article key={priority}><span>STUFE {priority}</span><h5>{priorityLabels[priority]} <strong>{items.cards.filter(card => flashcardPriority(card) === priority).length}</strong></h5><p>{priorityDescriptions[priority]}</p></article>)}</div><p className="small-note">{items.cards.filter(card => flashcardPriority(card) === null).length} Karten sind noch nicht eingestuft.{suggestions.length > 0 && ` Für ${suggestions.length} Karten ist eine fachlich vorbereitete Einstufung vorgeschlagen. Du kannst sie beim Bearbeiten ändern.`}</p>{suggestions.length > 0 && <Button size="sm" variant="outline" disabled={saving} onClick={() => void save(current => {
        const ids = new Set(collectionItems(current, selected).cards.map(card => card.id));
        return { ...current, cards: current.cards.map(card => ids.has(card.id) && card.priority === undefined && flashcardPriority(card) !== null ? { ...card, priority: flashcardPriority(card) } : card) };
      }, "Prioritätsstufen gespeichert")}>Vorgeschlagene Stufen übernehmen ({suggestions.length})</Button>}</div>
    </article>}
    {(compact || !selected) && (remainingNotes > 0 || remainingCards > 0) && <p className="small-note collection-unassigned">Noch keiner Lernsammlung zugeordnet: {remainingNotes} aktive Notizen · {remainingCards} Lernkarten.</p>}
    {editing && <CollectionEditor key={editing.id} collection={editing} workspace={workspace} save={save} saving={saving} onClose={() => setEditing(null)} onSaved={id => onCollectionChange(id)} />}
  </section>;
}
