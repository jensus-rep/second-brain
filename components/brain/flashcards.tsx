"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, Clock3, Layers3, LoaderCircle, Pencil, Play, Plus, RotateCcw, SlidersHorizontal, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { reviewCard, type Flashcard, type FlashcardSession, type Note, type Workspace } from "@/lib/brain/model";
import { recordCardReview } from "@/lib/brain/learning-tutor";
import type { SaveWorkspace } from "@/lib/brain/use-brain";
import { addToLearningCollection, collectionItems, flashcardPriority, learningCollections, priorityDescriptions, priorityLabels, removeFlashcard } from "@/lib/brain/learning-collections";
import { flattenTopics, getTopicDescendantIds, getTopicPathLabel } from "@/lib/brain/topics";
import { Markdown } from "./markdown";
import { MediaToolbar } from "./media-toolbar";
import { TutorCardPrompt } from "./tutor-guidance";
import { recommendLearning, type LearningAction } from "@/lib/brain/learning-resume";
import { tutorSessionInsights } from "@/lib/brain/tutor-session";
import { LearningTransition } from "./learning-transition";
import { AnswerComparisonView, useAnswerComparison } from "./answer-comparison";

export function newFlashcard(note?: Note): Flashcard {
  return { id: crypto.randomUUID(), question: note?.title ?? "", answer: note?.summary ?? "", noteId: note?.id ?? null, priority: null, dueAt: new Date().toISOString(), intervalDays: 0, reviews: 0 };
}
const reviewDate = (date: string) => new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(date));
const priorityLevels = [1, 2, 3] as const;
type Priority = 1 | 2 | 3 | null;
type PriorityFilter = "all" | "null" | "1" | "2" | "3";
const MAX_PENDING_RATINGS = 5;

// A persisted round is a snapshot, so a card reviewed elsewhere is never rated twice.
function sameSession(a: FlashcardSession | null | undefined, b: FlashcardSession | null | undefined) {
  if (!a || !b) return !a && !b;
  return a.id === b.id && a.index === b.index && a.updatedAt === b.updatedAt && a.startedAt === b.startedAt && a.collectionId === b.collectionId && a.mode === b.mode && a.queue.length === b.queue.length && a.queue.every((entry, index) => entry.id === b.queue[index].id && entry.reviews === b.queue[index].reviews && entry.dueAt === b.queue[index].dueAt);
}

function nextSessionIndex(session: FlashcardSession, cards: Flashcard[], from = session.index) {
  const byId = new Map(cards.map(card => [card.id, card]));
  let index = from;
  while (index < session.queue.length) {
    const entry = session.queue[index];
    const card = byId.get(entry.id);
    if (card && card.reviews === entry.reviews && card.dueAt === entry.dueAt) break;
    index++;
  }
  return index;
}

function sessionCards(workspace: Workspace, session: FlashcardSession) {
  const collection = session.collectionId ? learningCollections(workspace).find(collection => collection.id === session.collectionId) : undefined;
  return collection ? collectionItems(workspace, collection).cards : workspace.cards;
}

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

export function Flashcards({ workspace, revision = -1, save, saving, onEdit, onStudyChange, collectionId, onCollectionChange, onOpenNote, onBackToCollection, onBackToTutor, onLearningAction, startRequest, startMode = "due", startCardIds, resumeRequest, onResumeRequestConsumed }: {
  workspace: Workspace; save: SaveWorkspace; saving: boolean; onEdit: (card: Flashcard) => void; onStudyChange: (studying: boolean) => void;
  revision?: number; onLearningAction?: (action: LearningAction) => void;
  collectionId?: string; onCollectionChange?: (id: string) => void; onOpenNote?: (id: string) => void; onBackToCollection?: () => void; onBackToTutor?: () => void; startRequest?: number; startMode?: "due" | "all"; startCardIds?: string[]; resumeRequest?: number; onResumeRequestConsumed?: () => void;
}) {
  const [queue, setQueue] = useState<{ id: string; reviews: number; dueAt: string }[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [response, setResponse] = useState("");
  const [startError, setStartError] = useState("");
  // Ratings advance at once and save in order in the background.
  const [pendingReviews, setPendingReviews] = useState(0);
  const pendingReview = pendingReviews > 0;
  // A slow connection holds the learner at most a few cards ahead of the server.
  const ratingsFull = pendingReviews >= MAX_PENDING_RATINGS;
  const [ratingError, setRatingError] = useState("");
  const ratedKeys = useRef(new Set<string>());
  const failedRating = useRef<{ key: string; index: number; session: FlashcardSession; response: string } | null>(null);
  const [pendingStart, setPendingStart] = useState(false);
  const [externalLaunch, setExternalLaunch] = useState<"start" | "resume" | null>(() => resumeRequest ? "resume" : startRequest ? "start" : null);
  const [settledLaunch, setSettledLaunch] = useState<string | null>(null);
  const [replacement, setReplacement] = useState<{ cards: Flashcard[]; mode: "due" | "all"; collectionId: string | null; previousSession: FlashcardSession } | null>(null);
  const [sessionCollectionId, setSessionCollectionId] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<FlashcardSession | null>(null);
  const [studiedSessionId, setStudiedSessionId] = useState<string | undefined>();
  const ratingRef = useRef(false);
  const startingRef = useRef(false);
  const [clock, setClock] = useState(() => Date.now());
  const [filter, setFilter] = useState("");
  const [localCollectionId, setLocalCollectionId] = useState("");
  const [topicSelection, setTopicSelection] = useState({ collectionId: "", value: "" });
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [studyMode, setStudyMode] = useState<"due" | "all">("due");
  const consumedStartRequest = useRef<number | undefined>(undefined);
  const consumedResumeRequest = useRef<number | undefined>(undefined);
  const advancedTutorSession = useRef<string | null>(null);
  const revealRef = useRef<HTMLButtonElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<HTMLElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const presentedCard = useRef<string | null>(null);
  const notesById = useMemo(() => new Map(workspace.notes.map(note => [note.id, note])), [workspace.notes]);
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
  const availableTopics = flattenTopics(workspace.topics).filter(({ topic }) => [...getTopicDescendantIds(workspace.topics, topic.id)].some(id => cardTopicIds.has(id)));
  const chosenTopic = topicSelection.collectionId === activeCollectionId ? topicSelection.value : "";
  const topicFilter = chosenTopic === "::unassigned" && cardTopicIds.has(null) || availableTopics.some(({ topic }) => topic.id === chosenTopic) ? chosenTopic : "";
  const selectedTopicIds = topicFilter && topicFilter !== "::unassigned" ? getTopicDescendantIds(workspace.topics, topicFilter) : null;
  const topicCards = collectionCards.filter(card => {
    const topicId = card.noteId ? notesById.get(card.noteId)?.topicId ?? null : null;
    return !topicFilter || (topicFilter === "::unassigned" ? topicId === null : !!topicId && selectedTopicIds?.has(topicId));
  });
  const layerCounts = priorityLevels.map(priority => ({ priority, count: topicCards.filter(card => priorities.get(card.id) === priority).length }));
  const unclassifiedCount = topicCards.filter(card => priorities.get(card.id) === null).length;
  const searchTerms = filter.trim().toLocaleLowerCase("de").split(/\s+/).filter(Boolean);
  const visibleCards = topicCards.filter(card => {
    const priority = priorities.get(card.id) ?? null;
    if (priorityFilter !== "all" && (priorityFilter === "null" ? priority !== null : priority !== Number(priorityFilter))) return false;
    const linked = card.noteId ? notesById.get(card.noteId) : undefined;
    const text = [card.question, card.answer, linked?.title ?? "", linked?.topicId ? getTopicPathLabel(workspace.topics, linked.topicId) : "", ...memberships.get(card.id) ?? []].join(" ").toLocaleLowerCase("de");
    return searchTerms.every(term => text.includes(term));
  });
  const due = visibleCards.filter(card => Date.parse(card.dueAt) <= clock).sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id));
  const entry = queue?.[index];
  const card = entry ? (currentSession ? sessionCards(workspace, currentSession) : workspace.cards).find(c => c.id === entry.id) : null;
  const changed = !!(card && entry && (card.reviews !== entry.reviews || card.dueAt !== entry.dueAt));
  const answerComparison = useAnswerComparison({ revision, sessionId: currentSession?.id, cardId: card?.id,
    question: card?.question ?? "", answer: card?.answer ?? "", response,
    active: !!queue && !!card && !changed && !!currentSession && (pendingReview || sameSession(workspace.flashcardSession, currentSession)),
    revealed,
    // The server compares against its saved round, so wait for pending ratings.
    requestEnabled: !saving,
  });
  const next = [...visibleCards].sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  const launchRequestKey = resumeRequest ? `resume:${resumeRequest}` : startRequest ? `start:${startRequest}` : null;
  const launchMode = externalLaunch ?? (launchRequestKey && launchRequestKey !== settledLaunch ? resumeRequest ? "resume" : "start" : null);
  const studying = queue !== null || !!launchMode || pendingStart;
  const guidedSession = studiedSessionId && workspace.tutorSession?.id === studiedSessionId ? workspace.tutorSession : null;
  const guided = guidedSession ? tutorSessionInsights(workspace, recommendLearning(workspace, clock), clock) : null;
  const hasFilters = !!topicFilter || priorityFilter !== "all" || !!filter.trim();
  const activeFilterCount = Number(!!topicFilter) + Number(priorityFilter !== "all") + Number(!!filter.trim());
  const scopeTitle = queue ? (sessionCollectionId ? collections.find(item => item.collection.id === sessionCollectionId)?.collection.title ?? "Gespeicherte Lernrunde" : "Alle Lernkarten") : selectedCollection?.collection.title ?? "Alle Lernkarten";
  const pausedSession = workspace.flashcardSession;
  const pausedCards = pausedSession ? sessionCards(workspace, pausedSession) : [];
  const pausedCardsById = new Map(pausedCards.map(card => [card.id, card]));
  const pausedRemaining = pausedSession ? pausedSession.queue.slice(pausedSession.index).filter(entry => { const card = pausedCardsById.get(entry.id); return card && card.reviews === entry.reviews && card.dueAt === entry.dueAt; }).length : 0;
  const pausedTitle = pausedSession?.collectionId ? collections.find(item => item.collection.id === pausedSession.collectionId)?.collection.title ?? "Gespeicherte Lernrunde" : "Alle Lernkarten";
  const start = useCallback(async (cards: Flashcard[], mode: "due" | "all" = "due", replace = false, requestedCollectionId?: string | null, expectedSession?: FlashcardSession) => {
    if (!cards.length || saving || startingRef.current) return;
    const requestedId = requestedCollectionId === undefined ? collectionId ?? localCollectionId : requestedCollectionId;
    const targetCollectionId = requestedId && learningCollections(workspace).some(collection => collection.id === requestedId) ? requestedId : null;
    const previousSession = expectedSession ?? workspace.flashcardSession;
    if (previousSession && !replace) { setReplacement({ cards, mode, collectionId: targetCollectionId, previousSession }); return; }
    startingRef.current = true;
    setPendingStart(true);
    const now = new Date().toISOString();
    const session: FlashcardSession = { id: crypto.randomUUID(), collectionId: targetCollectionId, mode, queue: cards.map(card => ({ id: card.id, reviews: card.reviews, dueAt: card.dueAt })), index: 0, startedAt: now, updatedAt: now };
    const ok = await save(w => {
      if (!sameSession(w.flashcardSession, previousSession)) throw new Error("Die Lernrunde wurde inzwischen geändert. Bitte lade den aktuellen Lernstand neu.");
      const scopedCards = sessionCards(w, session);
      if (session.queue.some(entry => !scopedCards.some(card => card.id === entry.id && card.reviews === entry.reviews && card.dueAt === entry.dueAt))) throw new Error("Die ausgewählten Karten wurden inzwischen geändert. Bitte wähle die Lernrunde erneut aus.");
      return { ...w, flashcardSession: session, learningFocus: { collectionId: targetCollectionId, subject: w.learningFocus?.collectionId === targetCollectionId ? w.learningFocus.subject : null, updatedAt: now } };
    }, "");
    if (ok) {
      setExternalLaunch(null);
      setSettledLaunch(launchRequestKey);
      setStartError("");
      setCurrentSession(session);
      setStudiedSessionId(session.id);
      setSessionCollectionId(session.collectionId);
      setQueue(session.queue);
      setIndex(0);
      setRevealed(false);
      setResponse("");
      setStudyMode(mode);
      setReplacement(null);
    }
    else setStartError("Die Lernrunde konnte nicht gestartet werden. Prüfe den Speicherhinweis und versuche es erneut.");
    startingRef.current = false;
    setPendingStart(false);
  }, [collectionId, localCollectionId, save, saving, workspace, launchRequestKey]);
  const resume = useCallback(async () => {
    if (saving || startingRef.current) return;
    const stored = workspace.flashcardSession;
    if (!stored) { setStartError("Die gespeicherte Kartenrunde ist nicht mehr verfügbar. Kehre zum Tutor zurück und wähle die nächste Einheit."); onResumeRequestConsumed?.(); return; }
    startingRef.current = true;
    setPendingStart(true);
    const nextIndex = nextSessionIndex(stored, sessionCards(workspace, stored));
    const now = new Date().toISOString();
    const resumed = nextIndex < stored.queue.length ? { ...stored, index: nextIndex, updatedAt: now } : null;
    const targetCollectionId = collections.some(item => item.collection.id === stored.collectionId) ? stored.collectionId : null;
    const ok = await save(w => {
      if (!sameSession(w.flashcardSession, stored)) throw new Error("Die Lernrunde wurde inzwischen geändert. Bitte lade den aktuellen Lernstand neu.");
      return { ...w, flashcardSession: resumed, learningFocus: { collectionId: targetCollectionId, subject: w.learningFocus?.collectionId === targetCollectionId ? w.learningFocus.subject : null, updatedAt: now } };
    }, "");
    if (ok && resumed) {
      setExternalLaunch(null);
      setSettledLaunch(launchRequestKey);
      setStartError("");
      setCurrentSession(resumed);
      setStudiedSessionId(resumed.id);
      setSessionCollectionId(stored.collectionId);
      setLocalCollectionId(targetCollectionId ?? "");
      onCollectionChange?.(targetCollectionId ?? "");
      setQueue(stored.queue);
      setIndex(nextIndex);
      setRevealed(false);
      setResponse("");
      setStudyMode(stored.mode);
    }
    else setStartError(ok ? "Alle Karten dieser gespeicherten Runde wurden inzwischen bearbeitet. Kehre zum Tutor zurück und wähle die nächste Einheit." : "Die Kartenrunde konnte nicht fortgesetzt werden. Prüfe den Speicherhinweis und versuche es erneut.");
    onResumeRequestConsumed?.();
    startingRef.current = false;
    setPendingStart(false);
  }, [saving, workspace, save, collections, onCollectionChange, onResumeRequestConsumed, launchRequestKey]);
  const launchCards = useCallback(async () => {
    const selectedScope = learningCollections(workspace).find(item => item.id === (collectionId ?? localCollectionId));
    const availableCards = selectedScope ? collectionItems(workspace, selectedScope).cards : workspace.cards;
    setTopicSelection({ collectionId: selectedScope?.id ?? "", value: "" });
    setPriorityFilter("all");
    setFilter("");
    setStartError("");
    if (startCardIds) {
      const selected = startCardIds.map(id => availableCards.find(card => card.id === id));
      if (!selected.length || new Set(startCardIds).size !== startCardIds.length || selected.some(card => !card) || collectionId && !selectedScope) {
        setStartError("Die Karten für diese Einheit sind nicht mehr vollständig verfügbar. Wähle die Einheit im Tutor erneut aus.");
        return;
      }
      await start(selected as Flashcard[], "all");
      return;
    }
    const collectionDue = availableCards.filter(card => Date.parse(card.dueAt) <= clock).sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id));
    const selected = startMode === "all" ? availableCards : collectionDue.length ? collectionDue : availableCards;
    if (!selected.length) { setStartError("Für diese Einheit sind keine Lernkarten mehr verfügbar. Wähle den nächsten Schritt im Tutor."); return; }
    await start(selected, startMode === "all" ? "all" : collectionDue.length ? "due" : "all");
  }, [startMode, startCardIds, collectionId, localCollectionId, workspace, clock, start]);
  useEffect(() => {
    if (!startRequest || consumedStartRequest.current === startRequest || saving || startingRef.current) return;
    consumedStartRequest.current = startRequest;
    queueMicrotask(() => { setExternalLaunch("start"); void launchCards(); });
  }, [startRequest, launchCards, saving]);
  useEffect(() => {
    if (!resumeRequest || consumedResumeRequest.current === resumeRequest || saving || startingRef.current) return;
    consumedResumeRequest.current = resumeRequest;
    queueMicrotask(() => { setExternalLaunch("resume"); setStartError(""); void resume(); });
  }, [resumeRequest, resume, saving]);
  useEffect(() => { onStudyChange(studying); }, [studying, onStudyChange]);
  useEffect(() => () => onStudyChange(false), [onStudyChange]);
  useEffect(() => {
    if (!queue || card || pendingReview || saving || !guidedSession || guided?.phase !== "quiz" || guided.action?.kind !== "checkpoint" || !onLearningAction || advancedTutorSession.current === guidedSession.id) return;
    advancedTutorSession.current = guidedSession.id;
    onLearningAction(guided.action);
  }, [queue, card, pendingReview, saving, guidedSession, guided, onLearningAction]);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const currentCardKey = queue && card ? `${studiedSessionId ?? "local"}:${index}:${card.id}` : null;
  useLayoutEffect(() => {
    if (!currentCardKey) { presentedCard.current = null; return; }
    if (presentedCard.current === currentCardKey) return;
    presentedCard.current = currentCardKey;
    if (revealed) return;
    revealRef.current?.focus({ preventScroll: true });
    const bounds = questionRef.current?.getBoundingClientRect();
    if (bounds && (bounds.top < 24 || bounds.top > window.innerHeight - 120)) {
      sessionRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [currentCardKey, revealed]);
  useEffect(() => {
    if (!pendingReview && !pendingStart) return;
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [pendingReview, pendingStart]);
  function pause() {
    setQueue(null);
    setRevealed(false);
    setCurrentSession(null);
  }
  function leaveLaunch() {
    setExternalLaunch(null);
    setSettledLaunch(launchRequestKey);
    setStartError("");
    setReplacement(null);
    onResumeRequestConsumed?.();
    if (onBackToTutor) onBackToTutor();
    else pause();
  }
  async function skipUnavailable() {
    const session = currentSession;
    if (!session || saving || ratingRef.current) return;
    ratingRef.current = true;
    setPendingReviews(count => count + 1);
    const nextIndex = nextSessionIndex(session, sessionCards(workspace, session), index + 1);
    const updatedAt = new Date().toISOString();
    const advanced = nextIndex < session.queue.length ? { ...session, index: nextIndex, updatedAt } : null;
    const ok = await save(w => {
      if (!sameSession(w.flashcardSession, session)) throw new Error("Die Lernrunde wurde inzwischen geändert. Bitte lade den aktuellen Lernstand neu.");
      return { ...w, flashcardSession: advanced };
    }, "");
    if (ok) { setCurrentSession(advanced); setIndex(nextIndex); setRevealed(false); setResponse(""); }
    setPendingReviews(count => count - 1);
    ratingRef.current = false;
  }
  function earliestFailedRating(rating: NonNullable<typeof failedRating.current>) {
    if (!failedRating.current || rating.index < failedRating.current.index) failedRating.current = rating;
    return failedRating.current;
  }
  async function rate(known: boolean) {
    const session = currentSession;
    if (!card || !entry || !session || changed || ratingsFull) return;
    // Two clicks in one event turn still see this card; only the first rates it.
    const key = `${session.id}:${index}`;
    if (ratedKeys.current.has(key)) return;
    ratedKeys.current.add(key);
    const rating = { key, index, session, response };
    const comparison = answerComparison.result;
    const nextIndex = nextSessionIndex(session, sessionCards(workspace, session), index + 1);
    const reviewTime = new Date();
    const updatedAt = reviewTime.toISOString();
    const advanced = nextIndex < session.queue.length ? { ...session, index: nextIndex, updatedAt } : null;
    failedRating.current = null;
    setRatingError("");
    setPendingReviews(count => count + 1);
    // Show the next card at once. The queue saves each rating against the
    // confirmed revision before the next one, so the order stays intact.
    setCurrentSession(advanced); setIndex(nextIndex); setRevealed(false); setResponse("");
    const ok = await save(w => {
      if (!sameSession(w.flashcardSession, session)) throw new Error("Die Lernrunde wurde inzwischen geändert. Bitte lade den aktuellen Lernstand neu.");
      const currentCard = sessionCards(w, session).find(c => c.id === entry.id);
      if (!currentCard || currentCard.reviews !== entry.reviews || currentCard.dueAt !== entry.dueAt) throw new Error("Diese Karte wurde inzwischen geändert. Bitte lade den aktuellen Lernstand neu.");
      const focusCollectionId = collections.some(item => item.collection.id === session.collectionId) ? session.collectionId : null;
      const recorded = recordCardReview(w, { collectionId: session.collectionId, known, cardId: card.id, sessionId: session.id, response: rating.response, ...(comparison ? { comparison } : {}) }, reviewTime);
      return { ...recorded, cards: recorded.cards.map(c => c.id === card.id ? reviewCard(c, known, reviewTime) : c), flashcardSession: advanced, learningFocus: { collectionId: focusCollectionId, subject: w.learningFocus?.collectionId === focusCollectionId ? w.learningFocus.subject : null, updatedAt } };
    }, "", { queue: true });
    if (!ok) {
      // A failed write cancels the ratings queued after it. Return to the
      // earliest unsaved card with its answer, so nothing is silently lost.
      ratedKeys.current.delete(key);
      const restore = earliestFailedRating(rating);
      setCurrentSession(restore.session); setIndex(restore.index); setRevealed(true); setResponse(restore.response);
      setRatingError("Deine Bewertung wurde nicht gespeichert. Bewerte die Karte bitte erneut.");
    }
    setClock(Date.now());
    setPendingReviews(count => count - 1);
  }
  const replacementDialog = <AlertDialog open={replacement !== null} onOpenChange={open => {
    if (!open && !pendingStart) {
      setReplacement(null);
      if (launchMode) setStartError("Deine bisherige Kartenrunde bleibt gespeichert. Du kannst den Start erneut versuchen oder zum Tutor zurückkehren.");
    }
  }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Pausierte Lernrunde ersetzen?</AlertDialogTitle><AlertDialogDescription>Deine bisherige Runde in „{pausedTitle}“ wird durch die neue Auswahl ersetzt. Bereits gespeicherte Bewertungen und Wiederholungstermine bleiben erhalten.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={saving || pendingStart}>Abbrechen</AlertDialogCancel><AlertDialogAction disabled={saving || pendingStart} onClick={event => { event.preventDefault(); if (replacement) void start(replacement.cards, replacement.mode, true, replacement.collectionId, replacement.previousSession); }}>{pendingStart ? "Wird vorbereitet …" : "Neue Runde beginnen"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
  if (!queue && launchMode) return <LearningTransition title={startError ? "Die Kartenrunde wartet auf dich" : launchMode === "resume" ? "Deine Kartenrunde wird fortgesetzt" : "Deine Kartenrunde wird vorbereitet"} description={startError || "Gleich geht es mit deiner nächsten Karte weiter. Dein Lernstand bleibt gespeichert."} error={!!startError}>
    {startError && <><Button disabled={saving || pendingStart} onClick={() => { setStartError(""); if (launchMode === "resume") void resume(); else void launchCards(); }}>Erneut versuchen</Button><Button variant="outline" disabled={saving || pendingStart} onClick={leaveLaunch}>{onBackToTutor ? "Zum Tutor" : "Zur Kartenübersicht"}</Button></>}
    {replacementDialog}
  </LearningTransition>;
  if (queue) {
    const tutorPrompt = !guidedSession && !pendingReview && onLearningAction && studiedSessionId
      ? <TutorCardPrompt workspace={workspace} revision={revision} save={save} saving={saving} sessionId={studiedSessionId} now={clock} onAction={onLearningAction} /> : null;
    if (!pendingReview && currentSession && !sameSession(workspace.flashcardSession, currentSession)) return <section className="study-finished"><Clock3 size={30} /><h2>Deine Lernrunde hat sich geändert.</h2><p>Der aktuelle Lernstand wurde in einem anderen Fenster gespeichert. Öffne die gespeicherte Runde erneut.</p><Button onClick={pause}>Zur Kartenübersicht</Button></section>;
    if (changed || entry && !card) return <section className="study-finished"><Clock3 size={30} /><h2>{changed ? "Dieser Gedanke wurde schon wiederholt." : "Diese Karte ist nicht mehr verfügbar."}</h2><p>Geänderte oder entfernte Karten werden übersprungen. Der gespeicherte Lernstand bleibt erhalten.</p><div className="study-finished-actions"><Button disabled={saving || pendingReview} onClick={() => void skipUnavailable()}>Mit nächster Karte fortfahren</Button><Button variant="outline" disabled={saving || pendingReview} onClick={pause}>Beenden</Button></div></section>;
    if (!card && guidedSession) return <section className="study-finished" aria-busy={pendingReview || guided?.phase === "quiz"}><span className="study-complete-icon">{pendingReview || guided?.phase === "quiz" ? <LoaderCircle size={32} className="animate-spin" /> : <Check size={32} />}</span><h2>{pendingReview ? "Dein Fortschritt wird gespeichert …" : guided?.phase === "quiz" ? "Weiter zum Kurztest …" : "Deine Kartenrunde ist gespeichert."}</h2><p>{pendingReview ? "Deine letzte Bewertung wird gespeichert. Danach geht deine Lernrunde weiter." : guided?.phase === "quiz" ? `Jetzt prüfen wir mit ${guidedSession.questionIds.length} Aufgaben, was hängen geblieben ist.` : guided?.description}</p>{onBackToTutor && guided?.phase !== "quiz" && <Button disabled={saving || pendingReview} onClick={onBackToTutor}>Rückmeldung im Tutor ansehen<ArrowRight size={16} /></Button>}</section>;
    if (!card) return <section className="study-finished" aria-busy={pendingReview}><span className="study-complete-icon">{pendingReview ? <LoaderCircle size={32} className="animate-spin" /> : <Check size={32} />}</span><h2>{pendingReview ? "Dein Fortschritt wird gespeichert …" : "Ein Stück Wissen bleibt."}</h2><p>Lernrunde mit {queue.length} {queue.length === 1 ? "Karte" : "Karten"} in „{scopeTitle}“ abgeschlossen. {pendingReview ? "Einen Moment, die letzte Bewertung wird noch gespeichert." : "Dein Fortschritt ist gespeichert."}</p>{tutorPrompt}<div className="study-finished-actions"><Button disabled={pendingReview} onClick={pause}>Zur Kartenübersicht</Button>{onBackToTutor && <Button variant="outline" disabled={saving || pendingReview} onClick={onBackToTutor}>Zum Tutor<ArrowRight size={16} /></Button>}{selectedCollection && onBackToCollection && <Button variant="outline" disabled={saving || pendingReview} onClick={onBackToCollection}><ArrowLeft size={16} />Zur Lernsammlung</Button>}</div></section>;
    const linked = card.noteId ? notesById.get(card.noteId) : undefined;
    const mobileEnd = <Button className="study-mobile-end" variant="ghost" disabled={saving && !pendingReview} onClick={pause} title="Lernrunde pausieren; dein Stand bleibt gespeichert"><ArrowLeft size={16} />Beenden</Button>;
    return <section ref={sessionRef} className={"study-session" + (revealed ? " is-revealed" : "") + (pendingReview ? " is-saving" : "")}><div className="study-topline"><Button variant="ghost" size="sm" disabled={saving && !pendingReview} onClick={pause} title="Lernrunde pausieren; dein Stand bleibt gespeichert"><ArrowLeft size={16} />Beenden</Button><span key={currentCardKey} className="study-position">{index + 1} von {queue.length}</span>{pendingReview ? <span className="study-save-status" role="status"><LoaderCircle size={14} className="animate-spin" />Speichert …</span> : <span className="study-note">{linked?.title ?? "Deine Lernkarte"}</span>}</div><Progress value={index / queue.length * 100} aria-label="Fortschritt dieser Lernrunde" />
      {ratingError && <p className="study-rating-error" role="status">{ratingError}</p>}
      <p className="study-scope-line"><strong>{scopeTitle}</strong><span>{studyMode === "all" ? "Alle ausgewählten Karten üben" : "Fällige Karten wiederholen"}</span></p>
      <p className="study-resume-hint">Du kannst die Runde jederzeit beenden und später an dieser Stelle fortsetzen.</p>
      {tutorPrompt}
      <CardContext note={linked} topicTitle={linked?.topicId ? getTopicPathLabel(workspace.topics, linked.topicId) : "Ohne Thema"} collectionTitles={memberships.get(card.id) ?? []} priority={priorities.get(card.id) ?? null} suggested={card.priority === undefined && priorities.get(card.id) != null} onOpenNote={onOpenNote} />
      <article key={currentCardKey} className={"study-card " + (revealed ? "revealed" : "")}><div className="study-label"><Layers3 size={17} />ERINNERN STATT NACHLESEN</div><div ref={questionRef} className="study-question"><Markdown content={card.question} linkTerms skipTermNoteId={revealed ? null : card.noteId} /></div>
        <label className="field study-recall"><span>Deine Antwort in eigenen Worten (optional)</span><Textarea aria-label="Deine Antwort in eigenen Worten" value={response} maxLength={1500} rows={3} disabled={revealed} placeholder="Erkläre den Gedanken oder nenne ein Praxisbeispiel, bevor du die Antwort aufdeckst." onChange={event => setResponse(event.target.value)} /><small>{revealed ? response.trim() ? "Dein Text und der verfügbare Kurzvergleich werden mit deiner Einschätzung gespeichert. Du bestimmst die nächste Wiederholung." : "Deine Einschätzung wird gespeichert und bestimmt die nächste Wiederholung." : "Erst selbst formulieren, dann aufdecken. Du erhältst einen kurzen Vergleich zur Musterantwort."}</small></label>
        {revealed ? <div ref={answerRef} tabIndex={-1} className="study-answer" aria-label="Antwort">{answerComparison.result ? <AnswerComparisonView comparison={answerComparison.result} pending={answerComparison.pending} answer={card.answer} onRetry={!saving ? answerComparison.retry : undefined} /> : <><span className="eyebrow">DIE ANTWORT</span><Markdown content={card.answer} linkTerms /></>}</div> : <div className="study-pause"><span>Ein kurzer Moment zum Nachdenken.</span><div className="study-session-controls study-reveal-controls" role="group" aria-label="Aktionen für die Lernkarte"><Button ref={revealRef} className="reveal-button" onClick={() => { setRevealed(true); requestAnimationFrame(() => answerRef.current?.focus({ preventScroll: true })); }}>Antwort aufdecken</Button>{mobileEnd}</div></div>}
      </article>
      {revealed && <div className="study-rating study-session-controls" role="group" aria-label="Bewertung der Lernkarte"><div className="study-controls-heading"><p>Wie gut konntest du dich erinnern?</p>{mobileEnd}</div><div className="study-rating-buttons"><Button className="rate-again" variant="outline" disabled={ratingsFull} onClick={() => void rate(false)}><RotateCcw size={17} /><span>Noch üben<small>in 10 Minuten</small></span></Button><Button className="rate-known" disabled={ratingsFull} onClick={() => void rate(true)}><Check size={17} /><span>Gewusst<small>{reviewCard(card, true).intervalDays === 1 ? "morgen" : "in " + reviewCard(card, true).intervalDays + " Tagen"}</small></span></Button></div></div>}
    </section>;
  }
  return <section className="flashcards-home">
    {startError && <p role="alert" className="error-banner">{startError}</p>}
    {pausedSession && <section className="flashcard-paused-round" aria-label="Gespeicherte Lernrunde"><div className="flashcard-paused-icon"><Clock3 size={22} /></div><div className="flashcard-paused-copy"><span className="eyebrow">HIER GEHT ES WEITER</span><h2>{pausedTitle}</h2><p>{pausedRemaining ? `${pausedRemaining} ${pausedRemaining === 1 ? "Karte wartet" : "Karten warten"} noch auf dich. Dein Stand bleibt auch nach dem Schließen der App gespeichert.` : "Alle verbleibenden Karten wurden inzwischen wiederholt oder entfernt. Du kannst die gespeicherte Runde abschließen."}</p><span className="flashcard-paused-position">Stand: {pausedSession.index} von {pausedSession.queue.length} · Zuletzt am {reviewDate(pausedSession.updatedAt)}</span></div><div className="flashcard-paused-actions"><Button disabled={saving || pendingStart} onClick={() => void resume()}><Play size={16} />{pausedRemaining ? "Lernrunde fortsetzen" : "Gespeicherte Runde abschließen"}</Button><Button variant="outline" disabled={saving || pendingStart || !visibleCards.length} onClick={() => void start(due.length ? due : visibleCards, due.length ? "due" : "all")}><RotateCcw size={16} />Neue Runde beginnen</Button></div></section>}
    <section className="flashcard-filter-panel flashcard-start-panel" aria-label="Lernkarten auswählen">
      {selectedCollection && onBackToCollection && <Button type="button" variant="ghost" size="sm" className="flashcard-collection-back" onClick={onBackToCollection}><ArrowLeft size={16} />Zur Lernsammlung</Button>}
      <div className="flashcard-filter-heading"><div><span className="eyebrow"><Layers3 size={15} />DEIN WISSEN FESTIGEN</span><h2>{scopeTitle}</h2><p>{selectedCollection?.collection.description || "Wähle deine Lernsammlung und starte die Wiederholung. Du kannst deine Auswahl nach Thema, Priorität oder Suchbegriff eingrenzen."}</p></div></div>
      <div className="flashcard-start-grid">
        <label className="field flashcard-collection-picker"><span>Lernsammlung</span><select aria-label="Lernsammlung für Lernkarten" value={activeCollectionId} onChange={event => { setLocalCollectionId(event.target.value); onCollectionChange?.(event.target.value); setTopicSelection({ collectionId: event.target.value, value: "" }); setPriorityFilter("all"); setFilter(""); }}><option value="">Alle Lernkarten ({workspace.cards.length})</option>{collections.map(({ collection, cards }) => <option key={collection.id} value={collection.id}>{collection.title} ({cards.length})</option>)}</select></label>
        <div className="flashcard-start-actions" role="group" aria-label="Lernrunde für die aktuelle Auswahl starten">
          {workspace.cards.length ? <><Button className={due.length ? "primary-action" : "flashcard-due-action"} variant={due.length ? "default" : "outline"} disabled={saving || pendingStart || !due.length} onClick={() => void start(due)}><Play size={16} />Lernrunde starten</Button><Button className={!due.length ? "primary-action" : ""} variant={due.length ? "outline" : "default"} disabled={saving || pendingStart || !visibleCards.length} onClick={() => void start(visibleCards, "all")}><RotateCcw size={16} />Alle Karten üben</Button></> : <Button disabled={saving || pendingStart} onClick={() => onEdit(newFlashcard())}><Plus size={17} />Erste Lernkarte</Button>}
        </div>
      </div>
      {pendingStart && <p className="flashcard-start-status" role="status"><LoaderCircle size={15} className="animate-spin" />Deine Lernrunde wird gespeichert und vorbereitet …</p>}
      <dl className="flashcard-scope-counts" aria-label="Gesamter Bestand und aktuelle Auswahl">
        <div><dt>{selectedCollection ? "In dieser Sammlung" : "Gesamter Bestand"}</dt><dd>{collectionCards.length}<small> Karten</small></dd></div>
        <div><dt>Aktuelle Auswahl</dt><dd>{visibleCards.length}<small> Karten</small></dd></div>
        <div className="flashcard-due-count"><dt>Jetzt fällig</dt><dd>{due.length}<small> Karten</small></dd></div>
      </dl>
      <p className="flashcard-round-hint" role="status">{due.length ? `Die Lernrunde enthält ${due.length} fällige ${due.length === 1 ? "Karte" : "Karten"} aus deiner aktuellen Auswahl.` : next ? `Aktuell keine Karten fällig. Die nächste Karte wird am ${reviewDate(next.dueAt)} fällig. Du kannst vorher alle Karten üben.` : collectionCards.length ? "Keine Karte passt zu deinen Filtern. Passe deine Auswahl an, um zu starten." : "In dieser Auswahl gibt es noch keine Lernkarten."} {visibleCards.length > 0 && "Beim Üben wird dein Lernfortschritt gespeichert."}</p>
      {hasFilters && <div className="flashcard-active-filters" aria-label="Aktive Lernkartenfilter">{topicFilter && <span>{topicFilter === "::unassigned" ? "Ohne Thema" : `${getTopicPathLabel(workspace.topics, topicFilter)} · mit Unterthemen`}</span>}{priorityFilter !== "all" && <span>{priorityFilter === "null" ? "Noch nicht eingestuft" : `${priorityFilter} ${priorityLabels[Number(priorityFilter) as 1 | 2 | 3]}`}</span>}{filter.trim() && <span>Suche: „{filter.trim()}“</span>}<Button type="button" variant="ghost" size="sm" onClick={() => { setTopicSelection({ collectionId: activeCollectionId, value: "" }); setPriorityFilter("all"); setFilter(""); }}><X size={14} />Filter zurücksetzen</Button></div>}
      <details className="flashcard-filters-disclosure">
        <summary><SlidersHorizontal size={16} /><span>Auswahl eingrenzen<small>{activeFilterCount ? `${activeFilterCount} Filter aktiv` : "Thema, Priorität und Suche"}</small></span><ChevronDown size={16} className="flashcard-filter-chevron" /></summary>
        <div className="flashcard-filters">
          <label className="field"><span>Thema mit Unterthemen</span><select aria-label="Thema der Lernkarten" value={topicFilter} onChange={event => setTopicSelection({ collectionId: activeCollectionId, value: event.target.value })}><option value="">Alle Themen</option>{availableTopics.map(({ topic, depth }) => <option key={topic.id} value={topic.id}>{`${"— ".repeat(depth)}${topic.title}`}</option>)}{cardTopicIds.has(null) && <option value="::unassigned">Ohne Thema</option>}</select></label>
          <label className="field"><span>Prioritätsstufe</span><select aria-label="Prioritätsstufe" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as PriorityFilter)}><option value="all">Alle Prioritäten</option>{priorityLevels.map(priority => <option key={priority} value={priority}>{priority} {priorityLabels[priority]}</option>)}<option value="null">Noch nicht eingestuft</option></select></label>
          <label className="field"><span>Suche</span><Input className="card-search" aria-label="Lernkarten durchsuchen" placeholder="Frage, Antwort oder Notiz …" value={filter} onChange={event => setFilter(event.target.value)} /></label>
        </div>
        <section className="flashcard-priority-overview" aria-label="Prioritäten in Sammlung und Thema"><h3>Nach Bedeutung für deinen Lernstoff</h3><p>Die Zahlen zeigen alle {topicCards.length} Karten der gewählten Sammlung und des gewählten Themas. Du kannst die Priorität jeder Karte bearbeiten; Wiederholungen folgen deinem Lernfortschritt.</p><div className="flashcard-priority-layers">{layerCounts.map(({ priority, count }) => <Button type="button" variant="ghost" key={priority} className={`flashcard-priority-layer is-priority-${priority}`} aria-pressed={priorityFilter === String(priority)} onClick={() => setPriorityFilter(current => current === String(priority) ? "all" : String(priority) as PriorityFilter)}><span className="flashcard-priority-layer-title">{priority} {priorityLabels[priority]}</span><span className="flashcard-priority-layer-description">{priorityDescriptions[priority]}</span><strong>{count}<small> Karten</small></strong></Button>)}</div><Button type="button" variant="ghost" className="flashcard-unclassified" aria-pressed={priorityFilter === "null"} onClick={() => setPriorityFilter(current => current === "null" ? "all" : "null")}>Noch nicht eingestuft <strong>{unclassifiedCount}</strong></Button></section>
      </details>
    </section>
    {workspace.cards.length > 0 && <><div className="section-heading"><h2>Lernkarten in deiner Auswahl</h2><span className="flashcard-visible-count">{visibleCards.length} sichtbar · {due.length} fällig</span></div><div className="flashcard-list">{visibleCards.map(card => {
      const linked = card.noteId ? notesById.get(card.noteId) : undefined;
      return <article key={card.id}><span className="flashcard-list-icon"><Layers3 size={20} /></span><div className="flashcard-list-body"><h3>{card.question.replace(/!\[[^\]]*\]\([^)]*\)/g, "Abbildung").replace(/[#*`]/g, "").slice(0, 160)}</h3><p>{Date.parse(card.dueAt) <= clock ? "Bereit zum Lernen" : `Nächste Wiederholung: ${reviewDate(card.dueAt)}`} · {card.reviews} Wiederholungen</p><CardContext note={linked} topicTitle={linked?.topicId ? getTopicPathLabel(workspace.topics, linked.topicId) : "Ohne Thema"} collectionTitles={memberships.get(card.id) ?? []} priority={priorities.get(card.id) ?? null} suggested={card.priority === undefined && priorities.get(card.id) != null} onOpenNote={onOpenNote} /></div><Button type="button" variant="ghost" size="icon" aria-label="Lernkarte bearbeiten" onClick={() => onEdit(card)}><Pencil size={16} /></Button></article>;
    })}</div>{!visibleCards.length && <p className="flashcard-empty-selection">Keine Karte passt zu diesen Filtern. Wähle eine andere Sammlung, ein anderes Thema oder eine andere Priorität, oder ändere die Suche.</p>}</>}
    {replacementDialog}
  </section>;
}
