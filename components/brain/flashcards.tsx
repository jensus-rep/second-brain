"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Check, Clock3, Layers3, LoaderCircle, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { reviewCard, type Flashcard, type Note, type Workspace } from "@/lib/brain/model";
import type { SaveWorkspace } from "@/lib/brain/use-brain";
import { addToLearningCollection, collectionItems, flashcardPriority, learningCollections, priorityDescriptions, priorityLabels, removeFlashcard } from "@/lib/brain/learning-collections";
import { Markdown } from "./markdown";
import { MediaToolbar } from "./media-toolbar";

export function newFlashcard(note?: Note): Flashcard {
  return { id: crypto.randomUUID(), question: note?.title ?? "", answer: note?.summary ?? "", noteId: note?.id ?? null, priority: null, dueAt: new Date().toISOString(), intervalDays: 0, reviews: 0 };
}
const reviewDate = (date: string) => new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(date));
const priorityLevels = [1, 2, 3] as const;
type Priority = 1 | 2 | 3 | null;
type PriorityFilter = "all" | "null" | "1" | "2" | "3";

function PriorityBadge({ priority, suggested = false }: { priority: Priority; suggested?: boolean }) {
  return <span className={`flashcard-priority-badge is-priority-${priority ?? "none"}`}>{priority === null ? "Noch nicht eingestuft" : `${priority} ${priorityLabels[priority]}`}{suggested && priority !== null && <span className="flashcard-priority-suggestion"> · Vorschlag</span>}</span>;
}

function CardContext({ note, topicTitle, collectionTitles, priority, suggested, onOpenNote }: {
  note?: Note; topicTitle: string; collectionTitles: string[]; priority: Priority; suggested?: boolean; onOpenNote?: (id: string) => void;
}) {
  return <div className="flashcard-context">
    <div className="flashcard-context-tags"><PriorityBadge priority={priority} suggested={suggested} /><span className="flashcard-topic-label">{topicTitle}</span></div>
    <p className="flashcard-collection-label">{collectionTitles.length ? `${collectionTitles.length === 1 ? "Sammlung" : "Sammlungen"}: ${collectionTitles.join(" · ")}` : "Ohne Lernsammlung"}</p>
    <div className="flashcard-source"><span>{note ? `Notiz: ${note.title}` : "Eigenständige Lernkarte"}</span>{note && onOpenNote && <Button type="button" variant="outline" size="sm" onClick={() => onOpenNote(note.id)} aria-label={`Lerninhalt öffnen: ${note.title}`}><BookOpen size={14} aria-hidden="true" />Lerninhalt öffnen</Button>}</div>
  </div>;
}

export function FlashcardEditor({ card, workspace, save, saving, onClose, collectionId }: { card: Flashcard; workspace: Workspace; save: SaveWorkspace; saving: boolean; onClose: () => void; collectionId?: string }) {
  const [draft, setDraft] = useState<Flashcard>(() => ({ ...card }));
  const [side, setSide] = useState("question");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const busy = saving || uploading;
  const dirty = draft.question !== card.question || draft.answer !== card.answer || draft.noteId !== card.noteId || draft.priority !== card.priority;
  const draftPriority = flashcardPriority(draft);
  const exists = workspace.cards.some(c => c.id === card.id);
  const collection = !exists && collectionId ? learningCollections(workspace).find(item => item.id === collectionId) : undefined;
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (dirty || busy) event.preventDefault(); };
    window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard);
  }, [dirty, busy]);
  function close() { if (!busy && (!dirty || window.confirm("Nicht gespeicherte Änderungen verwerfen?"))) onClose(); }
  function insert(text: string) { const key = side === "question" ? "question" : "answer"; setDraft(d => ({ ...d, [key]: d[key] + text })); }
  return <><Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="editor-dialog flashcard-editor" onInteractOutside={e => e.preventDefault()} onEscapeKeyDown={e => { if (document.querySelector(".lightbox")) e.preventDefault(); }}><DialogHeader><DialogTitle>{exists ? "Lernkarte bearbeiten" : "Ein Gedanke zum Behalten"}</DialogTitle><DialogDescription>Eine klare Frage. Eine Antwort in deinen Worten.</DialogDescription></DialogHeader>
    <form className="editor-form" inert={busy} aria-busy={busy} onSubmit={async event => { event.preventDefault(); const ok = await save(w => {
      const updated = { ...w, cards: exists ? w.cards.map(c => c.id === card.id ? { ...c, question: draft.question, answer: draft.answer, noteId: draft.noteId, priority: draft.priority } : c) : [...w.cards, draft] };
      return !exists && collectionId ? addToLearningCollection(updated, collectionId, "cardIds", draft.id) : updated;
    }, "Lernkarte gespeichert"); if (ok) onClose(); }}>
      {collection && <p className="small-note">Die neue Karte gehört zur Lernsammlung „{collection.title}“.</p>}
      <Tabs value={side} onValueChange={setSide}><TabsList aria-label="Lernkartenseite"><TabsTrigger value="question">Frage</TabsTrigger><TabsTrigger value="answer">Antwort</TabsTrigger><TabsTrigger value="preview">Vorschau</TabsTrigger></TabsList>
        <TabsContent value="question"><label className="field"><span>Frage</span><Textarea autoFocus value={draft.question} maxLength={12000} onChange={e => setDraft({ ...draft, question: e.target.value })} placeholder="Was möchtest du später aus dem Gedächtnis erklären können?" rows={7} /></label></TabsContent>
        <TabsContent value="answer"><label className="field"><span>Antwort</span><Textarea value={draft.answer} maxLength={20000} onChange={e => setDraft({ ...draft, answer: e.target.value })} placeholder="Die Kernaussage, ein Beispiel oder eine erklärende Abbildung …" rows={9} /></label></TabsContent>
        <TabsContent value="preview"><div className="card-preview"><span className="eyebrow">FRAGE</span><Markdown content={draft.question || "Deine Frage"} /><hr /><span className="eyebrow">ANTWORT</span><Markdown content={draft.answer || "Deine Antwort"} /></div></TabsContent>
      </Tabs>
      {side !== "preview" && <MediaToolbar insert={insert} onBusy={setUploading} />}
      <label className="field"><span>Zugehörige Notiz</span><Select value={draft.noteId ?? "none"} onValueChange={value => setDraft({ ...draft, noteId: value === "none" ? null : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Eigenständige Lernkarte</SelectItem>{workspace.notes.map(note => <SelectItem key={note.id} value={note.id}>{note.title}</SelectItem>)}</SelectContent></Select></label>
      <label className="field"><span>Priorität der Lernkarte</span><select className="flashcard-priority-select" aria-label="Priorität der Lernkarte" value={draft.priority === undefined ? "automatic" : draft.priority ?? "null"} onChange={event => setDraft({ ...draft, priority: event.target.value === "automatic" ? undefined : event.target.value === "null" ? null : Number(event.target.value) as 1 | 2 | 3 })}>{draft.priority === undefined && <option value="automatic">{draftPriority === null ? "Priorität selbst wählen" : `Vorschlag: ${draftPriority} ${priorityLabels[draftPriority]}`}</option>}<option value="null">Noch nicht eingestuft</option>{priorityLevels.map(priority => <option key={priority} value={priority}>{priority} {priorityLabels[priority]}</option>)}</select><small>{draft.priority === undefined && draftPriority !== null ? "Dieser Vorschlag ist noch nicht übernommen. Wähle eine Prioritätsstufe, um die Einstufung festzulegen." : draftPriority === null ? "Ordne die Karte nach ihrer Bedeutung für deinen Lernstoff ein. Du kannst die Einstufung jederzeit bearbeiten." : `${priorityDescriptions[draftPriority]} Du kannst die Einstufung jederzeit bearbeiten.`}</small></label>
      <div className="dialog-actions">{exists && <Button type="button" variant="ghost" aria-label="Lernkarte löschen" onClick={() => setDeleting(true)}><Trash2 size={16} /></Button>}<Button type="button" variant="outline" onClick={close}>Abbrechen</Button><Button disabled={!draft.question.trim() || !draft.answer.trim() || busy} type="submit">{saving ? "Speichert …" : "Lernkarte speichern"}</Button></div>
    </form></DialogContent></Dialog>
    <AlertDialog open={deleting} onOpenChange={setDeleting}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Lernkarte löschen?</AlertDialogTitle><AlertDialogDescription>Die Karte und ihr Lernfortschritt werden entfernt. Die zugehörige Notiz bleibt erhalten.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={saving}>Abbrechen</AlertDialogCancel><AlertDialogAction disabled={saving} onClick={async e => { e.preventDefault(); if (await save(w => removeFlashcard(w, card.id), "Lernkarte gelöscht")) { setDeleting(false); onClose(); } }}>Löschen</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}

export function Flashcards({ workspace, save, saving, onEdit, onStudyChange, collectionId, onCollectionChange, onOpenNote }: {
  workspace: Workspace; save: SaveWorkspace; saving: boolean; onEdit: (card: Flashcard) => void; onStudyChange: (studying: boolean) => void;
  collectionId?: string; onCollectionChange?: (id: string) => void; onOpenNote?: (id: string) => void;
}) {
  const [queue, setQueue] = useState<{ id: string; reviews: number; dueAt: string }[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pendingReview, setPendingReview] = useState(false);
  const ratingRef = useRef(false);
  const [clock, setClock] = useState(() => Date.now());
  const [filter, setFilter] = useState("");
  const [localCollectionId, setLocalCollectionId] = useState("");
  const [topicSelection, setTopicSelection] = useState({ collectionId: "", value: "" });
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const revealRef = useRef<HTMLButtonElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<HTMLElement>(null);
  const notesById = useMemo(() => new Map(workspace.notes.map(note => [note.id, note])), [workspace.notes]);
  const topicsById = useMemo(() => new Map(workspace.topics.map(topic => [topic.id, topic])), [workspace.topics]);
  const priorities = useMemo(() => new Map(workspace.cards.map(card => [card.id, flashcardPriority(card)])), [workspace.cards]);
  const collections = useMemo(() => learningCollections(workspace).map(collection => ({ collection, cards: collectionItems(workspace, collection).cards })), [workspace]);
  const memberships = useMemo(() => {
    const result = new Map<string, string[]>();
    for (const { collection, cards } of collections) for (const card of cards) result.set(card.id, [...result.get(card.id) ?? [], collection.title]);
    return result;
  }, [collections]);
  const selectedCollection = collections.find(item => item.collection.id === (collectionId ?? localCollectionId));
  const activeCollectionId = selectedCollection?.collection.id ?? "";
  const collectionCards = selectedCollection?.cards ?? workspace.cards;
  const cardTopicIds = new Set(collectionCards.map(card => card.noteId ? notesById.get(card.noteId)?.topicId ?? null : null));
  const availableTopics = workspace.topics.filter(topic => cardTopicIds.has(topic.id));
  const chosenTopic = topicSelection.collectionId === activeCollectionId ? topicSelection.value : "";
  const topicFilter = chosenTopic === "::unassigned" && cardTopicIds.has(null) || availableTopics.some(topic => topic.id === chosenTopic) ? chosenTopic : "";
  const topicCards = collectionCards.filter(card => {
    const topicId = card.noteId ? notesById.get(card.noteId)?.topicId ?? null : null;
    return !topicFilter || (topicFilter === "::unassigned" ? topicId === null : topicId === topicFilter);
  });
  const layerCounts = priorityLevels.map(priority => ({ priority, count: topicCards.filter(card => priorities.get(card.id) === priority).length }));
  const unclassifiedCount = topicCards.filter(card => priorities.get(card.id) === null).length;
  const searchTerms = filter.trim().toLocaleLowerCase("de").split(/\s+/).filter(Boolean);
  const visibleCards = topicCards.filter(card => {
    const priority = priorities.get(card.id) ?? null;
    if (priorityFilter !== "all" && (priorityFilter === "null" ? priority !== null : priority !== Number(priorityFilter))) return false;
    const linked = card.noteId ? notesById.get(card.noteId) : undefined;
    const text = [card.question, card.answer, linked?.title ?? "", linked?.topicId ? topicsById.get(linked.topicId)?.title ?? "" : "", ...memberships.get(card.id) ?? []].join(" ").toLocaleLowerCase("de");
    return searchTerms.every(term => text.includes(term));
  });
  const due = visibleCards.filter(card => Date.parse(card.dueAt) <= clock).sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id));
  const entry = queue?.[index];
  const card = entry ? workspace.cards.find(c => c.id === entry.id) : null;
  const changed = !!(card && entry && (card.reviews !== entry.reviews || card.dueAt !== entry.dueAt));
  const next = [...visibleCards].sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  const studying = queue !== null && (!!card || pendingReview);
  useEffect(() => { onStudyChange(studying); return () => onStudyChange(false); }, [studying, onStudyChange]);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (queue && !revealed) {
      sessionRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
      revealRef.current?.focus({ preventScroll: true });
    }
  }, [index, revealed, queue]);
  useEffect(() => {
    if (!pendingReview) return;
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [pendingReview]);
  async function rate(known: boolean) {
    if (!card || saving || changed || ratingRef.current) return;
    const ratedIndex = index;
    ratingRef.current = true;
    setPendingReview(true);
    setRevealed(false);
    setIndex(ratedIndex + 1);
    const ok = await save(w => ({ ...w, cards: w.cards.map(c => c.id === card.id ? reviewCard(c, known) : c) }), "");
    if (!ok) { setIndex(ratedIndex); setRevealed(true); }
    setClock(Date.now());
    setPendingReview(false);
    ratingRef.current = false;
  }
  function start(cards: Flashcard[]) { setQueue(cards.map(c => ({ id: c.id, reviews: c.reviews, dueAt: c.dueAt }))); setIndex(0); setRevealed(false); }
  if (queue) {
    if (changed) return <section className="study-finished"><Clock3 size={30} /><h2>Dieser Gedanke wurde schon wiederholt.</h2><p>Der gespeicherte Lernstand ist neuer als diese Lernrunde. Er bleibt erhalten.</p><Button onClick={() => { setIndex(i => i + 1); setRevealed(false); }}>Mit nächster Karte fortfahren</Button></section>;
    if (!card) return <section className="study-finished" aria-busy={pendingReview}><span className="study-complete-icon">{pendingReview ? <LoaderCircle size={32} className="animate-spin" /> : <Check size={32} />}</span><h2>{pendingReview ? "Dein Fortschritt wird gespeichert …" : "Ein Stück Wissen bleibt."}</h2><p>{index} {index === 1 ? "Karte" : "Karten"} wiederholt. {pendingReview ? "Einen Moment, die letzte Bewertung wird noch gespeichert." : "Dein Fortschritt ist gespeichert."}</p><Button disabled={pendingReview} onClick={() => setQueue(null)}>Zur Kartenübersicht</Button></section>;
    const linked = card.noteId ? notesById.get(card.noteId) : undefined;
    const mobileEnd = <Button className="study-mobile-end" variant="ghost" disabled={saving || pendingReview} onClick={() => setQueue(null)}><ArrowLeft size={16} />Beenden</Button>;
    return <section ref={sessionRef} className={"study-session" + (revealed ? " is-revealed" : "")}><div className="study-topline"><Button variant="ghost" size="sm" disabled={saving || pendingReview} onClick={() => setQueue(null)}><ArrowLeft size={16} />Beenden</Button><span>{index + 1} von {queue.length}</span>{pendingReview ? <span className="study-save-status" role="status"><LoaderCircle size={14} className="animate-spin" />Speichert …</span> : <span className="study-note">{linked?.title ?? "Deine Lernkarte"}</span>}</div><Progress value={index / queue.length * 100} aria-label="Fortschritt dieser Lernrunde" />
      <CardContext note={linked} topicTitle={linked?.topicId ? topicsById.get(linked.topicId)?.title ?? "Ohne Thema" : "Ohne Thema"} collectionTitles={memberships.get(card.id) ?? []} priority={priorities.get(card.id) ?? null} suggested={card.priority === undefined && priorities.get(card.id) != null} onOpenNote={onOpenNote} />
      <article className={"study-card " + (revealed ? "revealed" : "")}><div className="study-label"><Layers3 size={17} />ERINNERN STATT NACHLESEN</div><div className="study-question"><Markdown content={card.question} /></div>
        {revealed ? <div ref={answerRef} tabIndex={-1} className="study-answer" aria-label="Antwort"><span className="eyebrow">DIE ANTWORT</span><Markdown content={card.answer} /></div> : <div className="study-pause"><span>Ein kurzer Moment zum Nachdenken.</span><div className="study-session-controls study-reveal-controls" role="group" aria-label="Aktionen für die Lernkarte"><Button ref={revealRef} className="reveal-button" onClick={() => { setRevealed(true); requestAnimationFrame(() => answerRef.current?.focus()); }}>Antwort aufdecken</Button>{mobileEnd}</div></div>}
      </article>
      {revealed && <div className="study-rating study-session-controls" role="group" aria-label="Bewertung der Lernkarte"><div className="study-controls-heading"><p>Wie gut konntest du dich erinnern?</p>{mobileEnd}</div><div className="study-rating-buttons"><Button className="rate-again" variant="outline" disabled={saving || pendingReview} onClick={() => void rate(false)}><RotateCcw size={17} /><span>Noch üben<small>in 10 Minuten</small></span></Button><Button className="rate-known" disabled={saving || pendingReview} onClick={() => void rate(true)}><Check size={17} /><span>Gewusst<small>{reviewCard(card, true).intervalDays === 1 ? "morgen" : "in " + reviewCard(card, true).intervalDays + " Tagen"}</small></span></Button></div></div>}
    </section>;
  }
  return <section className="flashcards-home">
    <section className="flashcard-filter-panel" aria-label="Lernkarten auswählen">
      <div className="flashcard-filter-heading"><div><span className="eyebrow">DEIN KARTENBESTAND</span><h2>Lernkarten nach Lernstoff ordnen</h2><p>Wähle eine Sammlung und beginne mit ihrem Kernwissen. Thema und Suche helfen dir, gezielt nachzuschlagen.</p></div></div>
      <dl className="flashcard-scope-counts" aria-label="Gesamter Bestand und aktuelle Auswahl">
        <div><dt>Gesamter Bestand</dt><dd>{workspace.cards.length}</dd></div>
        <div><dt>Gewählte Sammlung</dt><dd>{collectionCards.length}</dd></div>
        <div><dt>Sichtbare Auswahl</dt><dd>{visibleCards.length}</dd></div>
        <div><dt>Davon fällig</dt><dd>{due.length}</dd></div>
      </dl>
      <div className="flashcard-filters">
        <label className="field"><span>Lernsammlung</span><select aria-label="Lernsammlung für Lernkarten" value={activeCollectionId} onChange={event => { setLocalCollectionId(event.target.value); onCollectionChange?.(event.target.value); setTopicSelection({ collectionId: event.target.value, value: "" }); }}><option value="">Alle Lernkarten ({workspace.cards.length})</option>{collections.map(({ collection, cards }) => <option key={collection.id} value={collection.id}>{collection.title} ({cards.length})</option>)}</select></label>
        <label className="field"><span>Thema</span><select aria-label="Thema der Lernkarten" value={topicFilter} onChange={event => setTopicSelection({ collectionId: activeCollectionId, value: event.target.value })}><option value="">Alle Themen</option>{availableTopics.map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}{cardTopicIds.has(null) && <option value="::unassigned">Ohne Thema</option>}</select></label>
        <label className="field"><span>Prioritätsstufe</span><select aria-label="Prioritätsstufe" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as PriorityFilter)}><option value="all">Alle Prioritäten</option>{priorityLevels.map(priority => <option key={priority} value={priority}>{priority} {priorityLabels[priority]}</option>)}<option value="null">Noch nicht eingestuft</option></select></label>
        <label className="field"><span>Suche</span><Input className="card-search" aria-label="Lernkarten durchsuchen" placeholder="Frage, Antwort oder Notiz …" value={filter} onChange={event => setFilter(event.target.value)} /></label>
      </div>
      {selectedCollection?.collection.description && <p className="flashcard-collection-description">{selectedCollection.collection.description}</p>}
      <section className="flashcard-priority-overview" aria-label="Prioritäten in Sammlung und Thema"><h3>Drei Prioritäten für deinen Lernstoff</h3><p>Die Priorität beschreibt die Bedeutung für deinen Lernstoff. Wiederholungen folgen deinem gespeicherten Lernfortschritt. Die Zahlen zeigen alle {topicCards.length} Karten der gewählten Sammlung und des gewählten Themas. Markierte Vorschläge kannst du im Karteneditor übernehmen oder ändern; jede Einstufung bleibt bearbeitbar.</p><div className="flashcard-priority-layers">{layerCounts.map(({ priority, count }) => <Button type="button" variant="ghost" key={priority} className={`flashcard-priority-layer is-priority-${priority}`} aria-pressed={priorityFilter === String(priority)} onClick={() => setPriorityFilter(current => current === String(priority) ? "all" : String(priority) as PriorityFilter)}><span className="flashcard-priority-layer-title">{priority} {priorityLabels[priority]}</span><span className="flashcard-priority-layer-description">{priorityDescriptions[priority]}</span><strong>{count}<small> Karten</small></strong></Button>)}</div><Button type="button" variant="ghost" className="flashcard-unclassified" aria-pressed={priorityFilter === "null"} onClick={() => setPriorityFilter(current => current === "null" ? "all" : "null")}>Noch nicht eingestuft <strong>{unclassifiedCount}</strong></Button></section>
    </section>
    <div className="flashcards-intro"><div><span className="eyebrow"><Layers3 size={15} />DEIN WISSEN FESTIGEN</span><h2>{due.length ? `${due.length} ${due.length === 1 ? "Karte ist" : "Karten sind"} in deiner Auswahl fällig.` : visibleCards.length ? "In dieser Auswahl ist gerade nichts fällig." : workspace.cards.length ? "Keine Karten in dieser Auswahl." : "Was möchtest du dir merken?"}</h2><p>{due.length ? "Die Lernrunde verwendet nur die fälligen Karten aus deiner Sammlung, deinem Thema, deiner Prioritätsstufe und deiner Suche." : next ? `Die nächste Wiederholung in dieser Auswahl ist am ${reviewDate(next.dueAt)}.` : workspace.cards.length ? "Passe die Filter an, um andere Karten anzuzeigen." : "Halte eine Frage und ihre Antwort fest – mit Worten, Bildern oder Diagrammen."}</p></div>{workspace.cards.length ? <Button className="primary-action" disabled={saving || !due.length} onClick={() => start(due)}>Lernrunde starten</Button> : <Button onClick={() => onEdit(newFlashcard())}><Plus size={17} />Erste Lernkarte</Button>}</div>
    {workspace.cards.length > 0 && <><div className="section-heading"><h2>Lernkarten in deiner Auswahl</h2><span className="flashcard-visible-count">{visibleCards.length} sichtbar · {due.length} fällig</span></div><div className="flashcard-list">{visibleCards.map(card => {
      const linked = card.noteId ? notesById.get(card.noteId) : undefined;
      return <article key={card.id}><span className="flashcard-list-icon"><Layers3 size={20} /></span><div className="flashcard-list-body"><h3>{card.question.replace(/!\[[^\]]*\]\([^)]*\)/g, "Abbildung").replace(/[#*`]/g, "").slice(0, 160)}</h3><p>{Date.parse(card.dueAt) <= clock ? "Bereit zum Lernen" : `Nächste Wiederholung: ${reviewDate(card.dueAt)}`} · {card.reviews} Wiederholungen</p><CardContext note={linked} topicTitle={linked?.topicId ? topicsById.get(linked.topicId)?.title ?? "Ohne Thema" : "Ohne Thema"} collectionTitles={memberships.get(card.id) ?? []} priority={priorities.get(card.id) ?? null} suggested={card.priority === undefined && priorities.get(card.id) != null} onOpenNote={onOpenNote} /></div><Button type="button" variant="ghost" size="icon" aria-label="Lernkarte bearbeiten" onClick={() => onEdit(card)}><Pencil size={16} /></Button></article>;
    })}</div>{!visibleCards.length && <p className="flashcard-empty-selection">Keine Karte passt zu diesen Filtern. Wähle eine andere Sammlung, ein anderes Thema oder eine andere Priorität, oder ändere die Suche.</p>}</>}
  </section>;
}
