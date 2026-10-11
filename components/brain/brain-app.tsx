"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Archive, BookOpen, Check, ChevronRight, Compass, Download, FileText, FolderOpen, GitBranch, GraduationCap, KeyRound, LayoutGrid, Link2, List, LockKeyhole, LogOut, Network, Pencil, Plus, Search, Star, X, Layers3, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Toaster } from "@/components/ui/sonner";
import { useBrain } from "@/lib/brain/use-brain";
import { searchNotes, pathProgress, type Note, type Topic, type LearningPath, type Workspace, type Flashcard } from "@/lib/brain/model";
import { NoteEditor, TopicEditor, PathEditor } from "./editors";
import { NoteReader } from "./note-reader";
import { KnowledgeFilters } from "./knowledge-filters";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TransferDialog } from "./transfer-dialog";
import { AccessKeysDialog } from "./access-keys-dialog";
import { Flashcards, FlashcardEditor, newFlashcard } from "./flashcards";
import { Quizzes, LearningReminders, type QuizLaunchRequest } from "./quizzes";
import { LearningOverview } from "./learning-overview";
import { LearningTutor } from "./learning-tutor";
import type { LearningAction } from "@/lib/brain/learning-resume";
import { LearningCollectionsOverview } from "./learning-collections";
import { firstImage, noteExcerpt } from "@/lib/brain/media";
import { MobileNavigation, type BrainView } from "./mobile-navigation";
import { TopicTree } from "./topic-tree";
import { flattenTopics, getTopicAncestors, getTopicDescendantIds, getTopicOptionLabel, getTopicPathLabel } from "@/lib/brain/topics";

type View = BrainView;
const nav = [
  { id: "home" as View, label: "Mein Überblick", icon: Compass },
  { id: "library" as View, label: "Wissensbibliothek", icon: BookOpen },
  { id: "topics" as View, label: "Themen", icon: FolderOpen },
  { id: "tutor" as View, label: "Tutor", icon: GraduationCap },
  { id: "collections" as View, label: "Lernsammlungen", icon: Layers3 },
  { id: "paths" as View, label: "Lernpfade", icon: GraduationCap },
  { id: "flashcards" as View, label: "Lernkarten", icon: Layers3 },
  { id: "quizzes" as View, label: "Tests & Übungen", icon: Check },
  { id: "connections" as View, label: "Verbindungen", icon: Network },
];
const labels: Record<View, string> = { home: "Mein Überblick", tutor: "Tutor", library: "Wissensbibliothek", topics: "Themen", collections: "Lernsammlungen", paths: "Lernpfade", connections: "Verbindungen", favorites: "Favoriten", archive: "Archiv", flashcards: "Lernkarten", quizzes: "Tests & Übungen" };
const UNASSIGNED = "::unassigned";
const getDate = (date: string) => new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", timeZone: "Europe/Berlin" }).format(new Date(date));

async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  window.location.assign("/login");
}

function Navigation({ view, go, workspace, topicId, setTopic, newTopic, openKeys, onSignOut }: {
  view: View; go: (v: View) => void; workspace: Workspace; topicId: string; setTopic: (id: string) => void; newTopic: () => void; openKeys: () => void; onSignOut: () => void;
}) {
  const { setOpenMobile } = useSidebar();
  function navigate(v: View) { go(v); setOpenMobile(false); }
  return <Sidebar className="brain-sidebar">
    <SidebarHeader><button className="brand" onClick={() => navigate("home")} aria-label="Second Brain Startseite"><span className="brand-mark"><img src="/brand/second-brain-mark.png" alt="" width={39} height={39} /></span><span>Second Brain<span className="brand-sub">Wissensatelier</span></span></button></SidebarHeader>
    <SidebarContent><SidebarGroup><SidebarGroupLabel>WISSEN</SidebarGroupLabel><SidebarMenu>{nav.slice(0, 3).map(({ id, label, icon: Icon }) => <SidebarMenuItem key={id}><SidebarMenuButton isActive={view === id && !topicId} onClick={() => navigate(id)}><Icon /><span>{label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroup>
    <SidebarGroup><SidebarGroupLabel>LERNEN & VERBINDEN</SidebarGroupLabel><SidebarMenu>{nav.slice(3).map(({ id, label, icon: Icon }) => <SidebarMenuItem key={id}><SidebarMenuButton isActive={view === id} onClick={() => navigate(id)}><Icon /><span>{label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroup>
    {workspace.topics.length > 0 && <SidebarGroup className="sidebar-topics"><Collapsible defaultOpen><div className="side-section-heading"><CollapsibleTrigger asChild><button className="sidebar-topics-trigger">THEMEN<ChevronDown size={14} /></button></CollapsibleTrigger><button onClick={newTopic} aria-label="Neues Thema"><Plus size={16} /></button></div><CollapsibleContent><TopicTree topics={workspace.topics} notes={workspace.notes} selectedId={topicId} onSelect={id => { setTopic(id); setOpenMobile(false); }} compact /><button className="all-topics-link" onClick={() => navigate("topics")}>Themen strukturieren</button></CollapsibleContent></Collapsible></SidebarGroup>}
    <SidebarGroup><SidebarMenu><SidebarMenuItem><SidebarMenuButton isActive={view === "favorites"} onClick={() => navigate("favorites")}><Star /><span>Favoriten</span></SidebarMenuButton></SidebarMenuItem><SidebarMenuItem><SidebarMenuButton isActive={view === "archive"} onClick={() => navigate("archive")}><Archive /><span>Archiv</span></SidebarMenuButton></SidebarMenuItem><SidebarMenuItem><SidebarMenuButton onClick={() => { openKeys(); setOpenMobile(false); }}><KeyRound /><span>Zugangsschlüssel</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarGroup></SidebarContent>
    <SidebarFooter><div className="private-label"><LockKeyhole size={14} />Privater Wissensraum<button className="sign-out" onClick={onSignOut}><LogOut size={14} />Abmelden</button></div></SidebarFooter>
  </Sidebar>;
}

function NoteCard({ note, topics, open, toggleFavorite, saving }: { note: Note; topics: Topic[]; open: () => void; toggleFavorite: () => void; saving: boolean }) {
  const topic = topics.find(t => t.id === note.topicId);
  const cover = firstImage(note.content);
  return <article className={"note-card " + (topic?.color ?? "blue")}>
    {cover && <button className="note-cover" onClick={open} aria-label={note.title + " öffnen"}><img src={cover.src} alt={cover.alt} loading="lazy" /></button>}
    <div className="note-card-body"><div className="note-card-top"><span className="topic-caption"><span className={"topic-dot " + (topic?.color ?? "gray")} />{topic ? getTopicPathLabel(topics, topic.id) : "Ohne Thema"}</span><button className={"favorite-button " + (note.favorite ? "is-favorite" : "")} aria-label={note.favorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"} disabled={saving} onClick={toggleFavorite}><Star size={16} fill={note.favorite ? "currentColor" : "none"} /></button></div>
    <button className="note-open" onClick={open}><h3>{note.title}</h3><p>{note.summary || noteExcerpt(note.content)}</p></button><footer><span>{getDate(note.updatedAt)}</span>{cover && <span>Mit Abbildung</span>}</footer></div>
  </article>;
}

function KnowledgeMap({ workspace, open }: { workspace: Workspace; open: (id: string) => void }) {
  const all = workspace.notes.filter(n => !n.archived);
  const [selectedTopic, setSelectedTopic] = useState("");
  const scope = getTopicDescendantIds(workspace.topics, selectedTopic);
  const notes = all.filter(n => !selectedTopic || !!n.topicId && scope.has(n.topicId)).slice(0, 40);
  const points = notes.map((note, i) => ({ note, x: 350 + Math.cos(i * 2 * Math.PI / Math.max(notes.length, 1) - Math.PI / 2) * 230, y: 230 + Math.sin(i * 2 * Math.PI / Math.max(notes.length, 1) - Math.PI / 2) * 155 }));
  return <><label className="field knowledge-map-topic-picker"><span>Thema mit Unterthemen</span><select aria-label="Thema der Verbindungen" value={selectedTopic} onChange={event => setSelectedTopic(event.target.value)}><option value="">Alle Themen</option>{flattenTopics(workspace.topics).map(({ topic }) => <option key={topic.id} value={topic.id}>{getTopicOptionLabel(workspace.topics, topic.id)}</option>)}</select></label><div className="knowledge-map"><svg viewBox="0 0 700 460" role="img" aria-label="Verbindungen zwischen deinen Wissensnotizen"><defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#e2e7ef" /></pattern></defs><rect width="700" height="460" fill="url(#grid)" />{points.flatMap(p => p.note.relatedIds.map(id => { const target = points.find(t => t.note.id === id); return target ? <line key={p.note.id + id} x1={p.x} y1={p.y} x2={target.x} y2={target.y} stroke="#bacafa" strokeWidth="2" /> : null; }))}{points.map(p => <g key={p.note.id} className="graph-node" role="button" tabIndex={0} aria-label={p.note.title} onClick={() => open(p.note.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(p.note.id); } }}><circle cx={p.x} cy={p.y} r="23" fill="white" stroke="#285cf4" strokeWidth="2" /><text x={p.x} y={p.y + 5} textAnchor="middle" fontSize="14" fill="#285cf4">{p.note.title.slice(0, 1)}</text><text x={p.x} y={p.y + 44} textAnchor="middle" fontSize="12" fill="#39445b">{p.note.title.length > 25 ? p.note.title.slice(0, 23) + "…" : p.note.title}</text></g>)}</svg><div className="map-caption"><Link2 size={14} />{notes.length} Notizen · Klicke auf einen Gedanken, um weiterzulesen.</div></div>{all.length > 40 && <p className="muted">Die Karte zeigt bis zu 40 Notizen. Grenze die Ansicht über ein Thema ein.</p>}</>;
}

export function BrainApp() {
  const brain = useBrain();
  const { workspace: w, loading, saving, save } = brain;
  const [view, setView] = useState<View>("home");
  const [studying, setStudying] = useState(false);
  const quizPending = useRef(false);
  const [hasQuizPending, setHasQuizPending] = useState(false);
  const onQuizPendingChange = useCallback((pending: boolean) => { quizPending.current = pending; setHasQuizPending(pending); }, []);
  const [learningCollectionId, setLearningCollectionId] = useState("");
  const [cardStartRequest, setCardStartRequest] = useState(0);
  const [cardStartMode, setCardStartMode] = useState<"due" | "all">("due");
  const [cardResumeRequest, setCardResumeRequest] = useState(0);
  const [quizLaunchRequest, setQuizLaunchRequest] = useState<QuizLaunchRequest | undefined>();
  const [quizResultRequest, setQuizResultRequest] = useState<{ id: string; runId: string; collectionId?: string } | undefined>();
  const [learningReturnView, setLearningReturnView] = useState<"home" | "tutor">("home");
  const consumeCardResume = useCallback(() => setCardResumeRequest(0), []);
  const consumeQuizLaunch = useCallback(() => setQuizLaunchRequest(undefined), []);
  const consumeQuizResult = useCallback(() => setQuizResultRequest(undefined), []);
  const onCardStudyChange = useCallback((active: boolean) => { setStudying(active); if (active) setCardStartRequest(0); }, []);
  const [overviewClock, setOverviewClock] = useState(() => Date.now());
  useEffect(() => {
    if (view !== "home" && view !== "tutor") return;
    const timer = setInterval(() => setOverviewClock(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [view]);
  const [topicId, setTopicId] = useState("");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [editingPath, setEditingPath] = useState<LearningPath | null>(null);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const note = w.notes.find(n => n.id === selectedId);
  const selectedPath = w.paths.find(p => p.id === selectedPathId);
  const topic = w.topics.find(t => t.id === topicId);
  const activeNotes = w.notes.filter(n => !n.archived);
  const topicScope = getTopicDescendantIds(w.topics, topicId);
  const matchesTopic = (n: Note) => !topicId || (topicId === UNASSIGNED ? n.topicId === null : !!n.topicId && topicScope.has(n.topicId));
  const topicAncestors = topic ? getTopicAncestors(w.topics, topic.id) : [];
  const childTopics = w.topics.filter(t => t.parentId === topicId);
  const scopeNotes = w.notes.filter(n => n.archived === (view === "archive") && (view !== "favorites" || n.favorite));
  const filtered = searchNotes(scopeNotes.filter(n => matchesTopic(n) && (!tag || n.tags.includes(tag))), query, w.topics);
  const firstPath = w.paths.find(p => pathProgress(p, w.completedStepIds).percent < 100) ?? w.paths[0];
  const firstProgress = firstPath ? pathProgress(firstPath, w.completedStepIds) : null;
  const allTags = [...new Set(scopeNotes.filter(matchesTopic).flatMap(n => n.tags))].sort();
  const freshNote = (): Note => ({ id: crypto.randomUUID(), title: "", summary: "", content: "", topicId: topicId && topicId !== UNASSIGNED ? topicId : null, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  function go(v: View) { if (quizPending.current) { toast.info("Speichere zuerst die offenen Antworten in deiner Lernrunde."); return false; } setOverviewClock(Date.now()); setStudying(false); setCardStartRequest(0); setCardResumeRequest(0); setQuizLaunchRequest(undefined); setQuizResultRequest(undefined); if (v === "collections") setLearningCollectionId(""); setView(v); setTopicId(""); setTag(""); setQuery(""); setSelectedPathId(null); window.scrollTo({ top: 0, behavior: "instant" }); return true; }
  function openNote(id: string) { if (id === selectedId) return; setSelectedId(id); window.history.pushState(null, "", "#note=" + encodeURIComponent(id)); }
  function closeNote() { setSelectedId(null); window.history.replaceState(null, "", window.location.pathname + window.location.search); }
  function setTopic(id: string) { if (go("library")) setTopicId(id); }
  function openCollection(id: string) { go("collections"); setLearningCollectionId(id); }
  function startCollectionCards(id: string | null, mode: "due" | "all" = "due") { go("flashcards"); setLearningCollectionId(id ?? ""); setCardStartMode(mode); setCardStartRequest(value => value + 1); }
  function handleLearningAction(action: LearningAction) {
    setLearningReturnView(view === "tutor" || view === "flashcards" ? "tutor" : "home");
    if (action.kind === "open-collection") { if (action.collectionId) openCollection(action.collectionId); else go("library"); return; }
    if (action.kind === "review-cards") { startCollectionCards(action.collectionId, action.mode); return; }
    if (action.kind === "resume-cards") { go("flashcards"); setLearningCollectionId(action.collectionId ?? ""); setCardResumeRequest(value => value + 1); return; }
    go("quizzes");
    setLearningCollectionId(action.collectionId ?? "");
    if (action.kind === "resume-quiz") return;
    setQuizLaunchRequest({ id: crypto.randomUUID(), subject: action.subject, collectionId: action.collectionId ?? undefined, mode: action.kind === "checkpoint" ? "checkpoint" : "preparation", ...(action.kind === "checkpoint" ? { questionCount: action.questionCount, questionIds: action.questionIds, cardCheckpoint: action.cardCheckpoint } : { concept: action.concept }) });
  }
  function viewLearningResult(runId: string, collectionId: string | null) { setLearningReturnView(view === "tutor" ? "tutor" : "home"); go("quizzes"); setQuizResultRequest({ id: crypto.randomUUID(), runId, collectionId: collectionId ?? undefined }); }
  function createTopic(parentId: string | null = null) { setEditingTopic({ id: crypto.randomUUID(), title: "", description: "", color: "blue", parentId }); }
  function toggleFavorite(n: Note) { void save(state => ({ ...state, notes: state.notes.map(item => item.id === n.id ? { ...item, favorite: !item.favorite } : item) }), n.favorite ? "Favorit entfernt" : "Als Favorit gespeichert"); }
  useEffect(() => {
    const readHash = () => { try { setSelectedId(window.location.hash.startsWith("#note=") ? decodeURIComponent(window.location.hash.slice(6)) : null); } catch { setSelectedId(null); } };
    readHash(); window.addEventListener("hashchange", readHash); window.addEventListener("popstate", readHash);
    const keyboard = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); if (quizPending.current) { toast.info("Speichere zuerst die offenen Antworten in deiner Lernrunde."); return; } setSelectedId(null); window.history.replaceState(null, "", window.location.pathname + window.location.search); setView("library"); requestAnimationFrame(() => searchRef.current?.focus()); } };
    window.addEventListener("keydown", keyboard);
    return () => { window.removeEventListener("hashchange", readHash); window.removeEventListener("popstate", readHash); window.removeEventListener("keydown", keyboard); };
  }, []);
  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options: { signal: AbortSignal }) => unknown } }).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    const tools = [
      { name: "search_knowledge", description: "Search saved notes by title, content or tags and show the results.", inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 500 } }, required: ["query"], additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute(input: unknown) { if (!input || typeof input !== "object" || !("query" in input) || typeof input.query !== "string" || input.query.length > 500) throw new Error("query must be a string of at most 500 characters"); go("library"); setQuery(input.query); return searchNotes(w.notes.filter(n => !n.archived), input.query, w.topics).map(n => ({ id: n.id, title: n.title, summary: n.summary })); } },
      { name: "start_note_creation", description: "Open an unsaved note draft for the user to review and save.", inputSchema: { type: "object", properties: { title: { type: "string", maxLength: 160 }, content: { type: "string", maxLength: 80000 } }, required: ["title", "content"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input: unknown) { if (!input || typeof input !== "object" || !("title" in input) || !("content" in input) || typeof input.title !== "string" || typeof input.content !== "string" || input.title.length > 160 || input.content.length > 80000) throw new Error("Invalid note draft"); if (editingNote || editingPath || editingTopic || editingCard) throw new Error("Please finish the open editor first."); setEditingNote({ ...freshNote(), title: input.title, content: input.content }); return { status: "draft_opened", saved: false }; } },
    ];
    for (const tool of tools) { try { void Promise.resolve(context.registerTool(tool, { signal: controller.signal })).catch(() => {}); } catch {} }
    return () => controller.abort();
  }, [w, topicId, editingNote, editingPath, editingTopic, editingCard]);

  return <SidebarProvider style={{ "--sidebar-width": "250px" } as CSSProperties}><Navigation view={view} go={go} workspace={w} topicId={topicId} setTopic={setTopic} newTopic={() => createTopic()} openKeys={() => setShowKeys(true)} onSignOut={() => { if (quizPending.current) toast.info("Speichere zuerst die offenen Antworten in deiner Lernrunde."); else void signOut(); }} /><SidebarInset className={"brain-main" + (studying ? " is-studying" : "")}>
    <header className="topbar"><div className="breadcrumb"><SidebarTrigger className="mobile-toggle" aria-label="Navigation öffnen" /><span>Wissensatelier</span><ChevronRight size={14} /><strong>{topic?.title ?? labels[view]}</strong></div><div className="topbar-right"><span className="save-state"><Check size={14} className={saving ? "pulse" : ""} />{saving ? "Speichert …" : loading ? "Lädt …" : brain.error ? "Bitte prüfen" : hasQuizPending ? "Antworten offen" : "Gespeichert"}</span><Button variant="ghost" size="icon" aria-label="Import & Datensicherung" disabled={hasQuizPending} onClick={() => setShowTransfer(true)}><Download size={18} /></Button></div></header>
    <div className="workspace-content">
      {!(view === "flashcards" && studying) && <><div className="page-heading"><div><div className="eyebrow">{view === "home" ? "PLATZ FÜR DEINE GEDANKEN" : "DEIN PERSÖNLICHER WISSENSRAUM"}</div><h1>{topic?.title ?? (topicId === UNASSIGNED ? "Ohne Thema" : view === "home" ? "Dein Wissen" : labels[view])}</h1><p>{topic?.description ?? ({ home: "Gedanken festhalten. Zusammenhänge entdecken.", tutor: "Direkt loslernen, deine Vorbereitung planen und deinen Fortschritt verstehen.", library: "Deine Einträge an einem Ort.", topics: "Fachthemen und Unterthemen ordnen dein Wissen. Öffne eine Ebene, um alle zugehörigen Einträge zu sehen.", collections: "Stelle Wissen, Lernkarten und Aufgaben für ein konkretes Lernziel zusammen.", paths: "Aus einzelnen Gedanken wird ein Weg. Lerne in deinem Tempo.", connections: "Entdecke, wie deine Gedanken zusammengehören.", favorites: "Die Gedanken, zu denen du gern zurückkommst.", archive: "Aufbewahrt für später. Hier geht kein Gedanke verloren.", flashcards: "Weniger nachlesen. Mehr im Gedächtnis behalten.", quizzes: "Wissen prüfen, Denkfehler verstehen und gezielt weiterüben." }[view])}</p></div><div className="heading-actions">{topic && <Button variant="outline" onClick={() => setEditingTopic(topic)} aria-label="Thema bearbeiten"><Pencil size={16} /></Button>}{view !== "quizzes" && view !== "collections" && view !== "tutor" && <Button className="primary-action" disabled={loading} onClick={() => view === "flashcards" ? setEditingCard(newFlashcard()) : view === "topics" ? createTopic() : view === "paths" ? setEditingPath({ id: crypto.randomUUID(), title: "", description: "", steps: [] }) : setEditingNote(freshNote())}><Plus size={18} />{view === "flashcards" ? "Neue Lernkarte" : view === "topics" ? "Neues Thema" : view === "paths" ? "Neuer Lernpfad" : "Neue Notiz"}</Button>}</div></div>
      {topic && <div className="topic-context">
        <nav className="topic-breadcrumbs" aria-label="Themenpfad"><button onClick={() => go("topics")}>Alle Themen</button>{[...topicAncestors, topic].map(t => <span key={t.id}><ChevronRight size={14} />{t.id === topic.id ? <strong aria-current="page">{t.title}</strong> : <button onClick={() => setTopic(t.id)}>{t.title}</button>}</span>)}</nav>
        <div className="topic-scope-summary"><span>{topicScope.size > 1 ? `Dieses Thema umfasst ${topicScope.size - 1} Unterthemen. Alle zugehörigen Einträge werden gemeinsam angezeigt.` : "Die Einträge sind diesem Thema direkt zugeordnet."}</span><Button variant="ghost" size="sm" onClick={() => createTopic(topic.id)}><Plus size={15} />Unterthema anlegen</Button></div>
        {childTopics.length > 0 && <div className="topic-child-links" aria-label="Direkte Unterthemen">{childTopics.map(t => <button key={t.id} onClick={() => setTopic(t.id)}><span className={"topic-dot " + t.color} /><span>{t.title}</span><ChevronRight size={14} /></button>)}</div>}
      </div>}
      {["library", "favorites", "archive"].includes(view) && <div className="search-bar"><Search size={20} /><Input ref={searchRef} aria-label="Wissen durchsuchen" placeholder="Suche nach Gedanken, Themen oder Tags …" value={query} onChange={e => { setQuery(e.target.value); }} />{query ? <button aria-label="Suche leeren" onClick={() => setQuery("")}><X size={18} /></button> : <kbd>Strg K</kbd>}</div>}
      </>}
      {brain.error && <div className="error-banner" role="alert"><p>{brain.error}</p><Button variant="outline" size="sm" disabled={saving || loading} onClick={() => void brain.load()}>Aktuellen Stand laden</Button></div>}
      {loading && brain.revision < 0 ? <div className="card-grid loading-grid" aria-label="Wissenssammlung wird geladen">{[1, 2, 3].map(i => <Skeleton key={i} className="h-56 rounded-xl" />)}</div> : <>
      {view === "home" && <div className="tutor-overview-link"><Button variant="outline" onClick={() => go("tutor")}><GraduationCap size={18} />Zum Tutor<ChevronRight size={16} /></Button></div>}
      {view === "tutor" && <LearningTutor revision={brain.revision} onOpenCollections={() => go("collections")} workspace={w} save={save} saving={saving} now={overviewClock} onAction={handleLearningAction} onOpenNote={openNote} onOpenCollection={openCollection} onViewResult={viewLearningResult} />}
      {view === "home" && <LearningOverview workspace={w} save={save} saving={saving} now={overviewClock} onAction={handleLearningAction} onOpenNote={openNote} onOpenCollection={openCollection} onViewResult={viewLearningResult} />}
      {view === "home" && <div className="search-bar"><Search size={20} /><Input ref={searchRef} aria-label="Wissen durchsuchen" placeholder="Suche nach Gedanken, Themen oder Tags …" value={query} onChange={e => { setQuery(e.target.value); setView("library"); }} /><kbd>Strg K</kbd></div>}
      {view === "home" && <div className="workspace-entrypoints"><button onClick={() => go("topics")}><span className="entrypoint-icon"><FolderOpen size={22} /></span><span><strong>Wissen entdecken</strong><small>{w.topics.filter(t => !t.parentId).length} Fachthemen · {activeNotes.length} Einträge</small></span><ChevronRight size={18} /></button><button onClick={() => go("flashcards")}><span className="entrypoint-icon"><Layers3 size={22} /></span><span><strong>Wissen wiederholen</strong><small>{w.cards.length} Lernkarten · {w.cards.filter(c => Date.parse(c.dueAt) <= overviewClock).length} fällig</small></span><ChevronRight size={18} /></button></div>}
      {(view === "home" || view === "collections") && <LearningCollectionsOverview workspace={w} save={save} saving={saving} collectionId={learningCollectionId} onCollectionChange={setLearningCollectionId} onOpenNote={openNote} onOpenCards={id => { setLearningCollectionId(id); go("flashcards"); }} onOpenQuizzes={id => { setLearningCollectionId(id); go("quizzes"); }} onOpenPath={id => { go("paths"); setSelectedPathId(id); }} compact={view === "home"} onOpenCollection={openCollection} onStartCards={startCollectionCards} onOpenAllCollections={() => go("collections")} />}
      {view === "topics" && <section className="topic-browser" aria-label="Themenstruktur"><div className="structure-intro"><FolderOpen size={22} /><div><h2>Vom Fachthema zum Detail</h2><p>Unterthemen gehören zu ihrem übergeordneten Thema. Einträge bleiben ihrer konkreten Ebene zugeordnet und erscheinen auch beim übergeordneten Thema.</p></div></div><TopicTree topics={w.topics} notes={w.notes} onSelect={setTopic} onEdit={setEditingTopic} onCreateChild={parentId => createTopic(parentId)} /><button className="unassigned-topic" onClick={() => setTopic(UNASSIGNED)}><FileText size={18} /><span>Ohne Thema<small>Einträge, die noch einen Platz suchen.</small></span><strong>{activeNotes.filter(n => !n.topicId).length}</strong><ChevronRight size={16} /></button>{!w.topics.length && <p className="topic-empty-hint">Lege ein Fachthema an und ergänze darunter passende Unterthemen.</p>}<div className="structure-collection-link"><div><h3>Für ein Lernziel bündeln</h3><p>Lernsammlungen verbinden Inhalte aus mehreren Themen mit Karten und Übungen.</p></div><Button variant="outline" onClick={() => go("collections")}>Lernsammlungen öffnen<ChevronRight size={16} /></Button></div></section>}
      {view === "home" && w.topics.length > 0 && <section className="topic-shortcuts" aria-label="Themen entdecken">{w.topics.filter(t => !t.parentId).slice(0, 4).map(t => <button key={t.id} onClick={() => setTopic(t.id)}><span className={"topic-dot " + t.color} />{t.title}</button>)}<button className="all-topics-shortcut" onClick={() => go("topics")}>Alle Themen</button></section>}
      {view === "home" && <LearningReminders workspace={w} save={save} saving={saving} onOpen={() => go("quizzes")} />}
      {view === "quizzes" && <Quizzes onLearningAction={handleLearningAction} workspace={w} save={save} saving={saving} onStudyChange={setStudying} onOpenNote={openNote} collectionId={learningCollectionId} onCollectionChange={setLearningCollectionId} launchRequest={quizLaunchRequest} onLaunchConsumed={consumeQuizLaunch} resultRequest={quizResultRequest} onResultRequestConsumed={consumeQuizResult} onBackToOverview={() => go(learningReturnView)} onPendingChange={onQuizPendingChange} />}
      {view === "flashcards" && <Flashcards revision={brain.revision} onLearningAction={handleLearningAction} onBackToTutor={() => go("tutor")} workspace={w} save={save} saving={saving} onEdit={setEditingCard} onStudyChange={onCardStudyChange} onOpenNote={openNote} collectionId={learningCollectionId} onCollectionChange={setLearningCollectionId} startRequest={cardStartRequest} startMode={cardStartMode} resumeRequest={cardResumeRequest} onResumeRequestConsumed={consumeCardResume} onBackToCollection={learningCollectionId ? () => openCollection(learningCollectionId) : undefined} />}
      {["home", "library", "favorites", "archive"].includes(view) && <section className="library-section">
        <div className="section-heading"><h2>{view === "home" ? "Zuletzt in deinem Wissensraum" : query ? "Suchergebnisse" : topic ? "Notizen in diesem Thema" : view === "archive" ? "Archivierte Notizen" : view === "favorites" ? "Deine Favoriten" : "Alle Notizen"} <span>{filtered.length}</span></h2>{view === "home" && <button onClick={() => go("library")}>Alle Notizen ansehen</button>}</div>
        <Tabs defaultValue="cards"><div className="library-toolbar"><div className="library-controls">{view !== "home" && <KnowledgeFilters topics={w.topics} tags={allTags} topicId={topicId} tag={tag} onTopic={id => { setTopicId(id); setTag(""); }} onTag={setTag} reset={() => { setTopicId(""); setTag(""); }} />}<span className="result-order">{query ? `Ergebnisse für „${query}“` : "Zuletzt bearbeitet"}</span></div><TabsList aria-label="Darstellung"><TabsTrigger value="cards" aria-label="Kartenansicht"><LayoutGrid size={16} /></TabsTrigger><TabsTrigger value="list" aria-label="Listenansicht"><List size={16} /></TabsTrigger></TabsList></div>
        {(tag || topicId) && <div className="applied-filters" aria-label="Aktive Filter">{topicId && <button onClick={() => { setTopicId(""); setTag(""); }} aria-label="Themenfilter entfernen"><span className={"topic-dot " + (topic?.color ?? "gray")} />{topic?.title ?? "Ohne Thema"}<X size={14} /></button>}{tag && <button onClick={() => setTag("")} aria-label="Tagfilter entfernen">#{tag}<X size={14} /></button>}<button className="clear-filter" onClick={() => { setTopicId(""); setTag(""); }}>Zurücksetzen</button></div>}
        <TabsContent value="cards"><div className="card-grid">{(view === "home" ? filtered.slice(0, 6) : filtered).map(n => <NoteCard key={n.id} note={n} topics={w.topics} open={() => openNote(n.id)} toggleFavorite={() => toggleFavorite(n)} saving={saving} />)}</div></TabsContent>
        <TabsContent value="list"><div className="notes-list">{filtered.map(n => <div key={n.id}><button onClick={() => openNote(n.id)}><FileText size={20} /><span><strong>{n.title}</strong><small>{n.topicId ? getTopicPathLabel(w.topics, n.topicId) : "Ohne Thema"} · {getDate(n.updatedAt)}</small></span></button><Button variant="ghost" size="icon" disabled={saving} aria-label={n.favorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"} onClick={() => toggleFavorite(n)}><Star size={17} fill={n.favorite ? "currentColor" : "none"} /></Button></div>)}</div></TabsContent></Tabs>
        {!filtered.length && <Empty><Search size={30} /><EmptyTitle>{query || tag || topicId ? "Keine passenden Einträge" : view === "favorites" ? "Deine wichtigsten Gedanken an einem Ort" : view === "archive" ? "Dein Archiv ist leer" : "Platz für deinen ersten Gedanken"}</EmptyTitle><EmptyDescription>{query || tag || topicId ? "Versuche einen anderen Suchbegriff oder setze die Filter zurück." : view === "favorites" ? "Markiere eine Notiz mit dem Stern, um sie hier wiederzufinden." : view === "archive" ? "Archivierte Notizen lassen sich hier jederzeit wiederherstellen." : "Beginne mit einer Frage, einer Idee oder einer interessanten Fundstelle."}</EmptyDescription>{(query || tag || topicId) ? <Button variant="outline" onClick={() => { setQuery(""); setTag(""); setTopicId(""); }}>Filter zurücksetzen</Button> : view === "library" ? <Button onClick={() => setEditingNote(freshNote())}>Erste Notiz anlegen</Button> : null}</Empty>}
      </section>}
      {view === "connections" && <KnowledgeMap workspace={w} open={openNote} />}
      {view === "paths" && <div className="learning-layout"><div className="path-cards">{w.paths.map(p => { const progress = pathProgress(p, w.completedStepIds); return <button key={p.id} className={"path-card " + (selectedPathId === p.id ? "selected" : "")} onClick={() => setSelectedPathId(p.id)}><span className="path-icon"><GitBranch size={22} /></span><h2>{p.title}</h2><p>{p.description}</p><Progress value={progress.percent} aria-label={`${progress.done} von ${progress.total} Schritten abgeschlossen`} /><footer><span>{progress.done} von {progress.total} Schritten</span><strong>{progress.percent} %</strong></footer></button>; })}{!w.paths.length && <Empty><GraduationCap size={28} /><EmptyTitle>Dein nächstes Lernziel wartet</EmptyTitle><EmptyDescription>Erstelle einen Lernpfad aus deinen Notizen.</EmptyDescription></Empty>}</div>{selectedPath && <section className="path-detail"><div className="section-heading"><h2>{selectedPath.title}</h2><Button variant="outline" size="sm" onClick={() => setEditingPath(selectedPath)}><Pencil size={14} />Bearbeiten</Button></div><p>{selectedPath.description}</p><div className="learning-steps">{selectedPath.steps.map((step, i) => { const target = w.notes.find(n => n.id === step.noteId); const done = w.completedStepIds.includes(step.id); return <div className={"learning-step " + (done ? "completed" : "")} key={step.id}><span className="step-number">{done ? <Check size={17} /> : i + 1}</span><div><button onClick={() => openNote(step.noteId)}><h3>{target?.title ?? "Notiz nicht verfügbar"}{target?.archived && <span className="badge">Archiviert</span>}</h3></button><p>{step.objective || "Lies die Notiz und formuliere deinen wichtigsten Gedanken."}</p><label><Checkbox disabled={saving} checked={done} onCheckedChange={checked => void save(state => ({ ...state, completedStepIds: checked ? [...state.completedStepIds, step.id] : state.completedStepIds.filter(id => id !== step.id) }), checked ? "Lernschritt abgeschlossen" : "Lernschritt wieder geöffnet")} />Abgeschlossen</label></div></div>; })}</div></section>}</div>}
      {view === "home" && firstPath && <section className="continue-strip"><span className="continue-icon"><GraduationCap size={22} /></span><div><span className="eyebrow">WEITERDENKEN</span><h2>{firstPath.title}</h2></div><span className="continue-progress">{firstProgress?.done} / {firstProgress?.total} Schritte</span><Button variant="outline" onClick={() => { go("paths"); setSelectedPathId(firstPath.id); }}>Weiterlernen</Button></section>}
      <footer className="page-footer"><span>{activeNotes.length} Notizen · {w.topics.length} Themen</span></footer>
      </>}
    </div>
  </SidebarInset>{!studying && !note && !editingNote && !editingTopic && !editingPath && !editingCard && !showTransfer && !showKeys && <MobileNavigation view={view} go={go} loading={loading} newNote={() => setEditingNote(freshNote())} openTransfer={() => setShowTransfer(true)} openKeys={() => setShowKeys(true)} signOut={() => void signOut()} />}<Toaster position="bottom-right" richColors />
  {note && !editingNote && !editingCard && <NoteReader key={note.id} note={note} workspace={w} saving={saving} onClose={closeNote} onOpen={openNote} onEdit={() => setEditingNote(note)} onFlashcard={() => setEditingCard(newFlashcard(note))} onFavorite={() => toggleFavorite(note)} onArchive={() => void save(state => ({ ...state, notes: state.notes.map(n => n.id === note.id ? { ...n, archived: !n.archived } : n) }), note.archived ? "Notiz wiederhergestellt" : "Notiz archiviert")} onTopic={id => { closeNote(); go(note.archived ? "archive" : "library"); setTopicId(id); }} onTag={value => { closeNote(); go(note.archived ? "archive" : "library"); setTag(value); }} />}
  {editingCard && <FlashcardEditor card={editingCard} workspace={w} save={save} saving={saving} collectionId={view === "flashcards" ? learningCollectionId : undefined} onClose={() => setEditingCard(null)} />}
  {editingNote && <NoteEditor note={editingNote} workspace={w} save={save} saving={saving} onClose={() => setEditingNote(null)} />}
  {editingTopic && <TopicEditor topic={editingTopic} workspace={w} save={save} saving={saving} onClose={() => setEditingTopic(null)} />}
  {editingPath && <PathEditor path={editingPath} workspace={w} save={save} saving={saving} onClose={() => setEditingPath(null)} />}
  <TransferDialog open={showTransfer} setOpen={setShowTransfer} workspace={w} save={save} saving={saving} onImported={() => go("home")} />
  <AccessKeysDialog open={showKeys} setOpen={setShowKeys} />
  </SidebarProvider>;
}

