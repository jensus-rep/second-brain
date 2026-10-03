"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Clock3, Layers3, Pencil, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
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
import { Markdown } from "./markdown";
import { MediaToolbar } from "./media-toolbar";

export function newFlashcard(note?: Note): Flashcard {
  return { id: crypto.randomUUID(), question: note?.title ?? "", answer: note?.summary ?? "", noteId: note?.id ?? null, dueAt: new Date().toISOString(), intervalDays: 0, reviews: 0 };
}
const reviewDate = (date: string) => new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(date));

export function FlashcardEditor({ card, workspace, save, saving, onClose }: { card: Flashcard; workspace: Workspace; save: SaveWorkspace; saving: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState(card);
  const [side, setSide] = useState("question");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const busy = saving || uploading;
  const dirty = JSON.stringify(card) !== JSON.stringify(draft);
  const exists = workspace.cards.some(c => c.id === card.id);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (dirty || busy) event.preventDefault(); };
    window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard);
  }, [dirty, busy]);
  function close() { if (!busy && (!dirty || window.confirm("Nicht gespeicherte Änderungen verwerfen?"))) onClose(); }
  function insert(text: string) { const key = side === "question" ? "question" : "answer"; setDraft(d => ({ ...d, [key]: d[key] + text })); }
  return <><Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="editor-dialog flashcard-editor" onInteractOutside={e => e.preventDefault()} onEscapeKeyDown={e => { if (document.querySelector(".lightbox")) e.preventDefault(); }}><DialogHeader><DialogTitle>{exists ? "Lernkarte bearbeiten" : "Ein Gedanke zum Behalten"}</DialogTitle><DialogDescription>Eine klare Frage. Eine Antwort in deinen Worten.</DialogDescription></DialogHeader>
    <form className="editor-form" inert={busy} aria-busy={busy} onSubmit={async event => { event.preventDefault(); const ok = await save(w => ({ ...w, cards: exists ? w.cards.map(c => c.id === card.id ? { ...c, question: draft.question, answer: draft.answer, noteId: draft.noteId } : c) : [...w.cards, draft] }), "Lernkarte gespeichert"); if (ok) onClose(); }}>
      <Tabs value={side} onValueChange={setSide}><TabsList aria-label="Lernkartenseite"><TabsTrigger value="question">Frage</TabsTrigger><TabsTrigger value="answer">Antwort</TabsTrigger><TabsTrigger value="preview">Vorschau</TabsTrigger></TabsList>
        <TabsContent value="question"><label className="field"><span>Frage</span><Textarea autoFocus value={draft.question} maxLength={12000} onChange={e => setDraft({ ...draft, question: e.target.value })} placeholder="Was möchtest du später aus dem Gedächtnis erklären können?" rows={7} /></label></TabsContent>
        <TabsContent value="answer"><label className="field"><span>Antwort</span><Textarea value={draft.answer} maxLength={20000} onChange={e => setDraft({ ...draft, answer: e.target.value })} placeholder="Die Kernaussage, ein Beispiel oder eine erklärende Abbildung …" rows={9} /></label></TabsContent>
        <TabsContent value="preview"><div className="card-preview"><span className="eyebrow">FRAGE</span><Markdown content={draft.question || "Deine Frage"} /><hr /><span className="eyebrow">ANTWORT</span><Markdown content={draft.answer || "Deine Antwort"} /></div></TabsContent>
      </Tabs>
      {side !== "preview" && <MediaToolbar insert={insert} onBusy={setUploading} />}
      <label className="field"><span>Zugehörige Notiz</span><Select value={draft.noteId ?? "none"} onValueChange={value => setDraft({ ...draft, noteId: value === "none" ? null : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Eigenständige Lernkarte</SelectItem>{workspace.notes.map(note => <SelectItem key={note.id} value={note.id}>{note.title}</SelectItem>)}</SelectContent></Select></label>
      <div className="dialog-actions">{exists && <Button type="button" variant="ghost" aria-label="Lernkarte löschen" onClick={() => setDeleting(true)}><Trash2 size={16} /></Button>}<Button type="button" variant="outline" onClick={close}>Abbrechen</Button><Button disabled={!draft.question.trim() || !draft.answer.trim() || busy} type="submit">{saving ? "Speichert …" : "Lernkarte speichern"}</Button></div>
    </form></DialogContent></Dialog>
    <AlertDialog open={deleting} onOpenChange={setDeleting}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Lernkarte löschen?</AlertDialogTitle><AlertDialogDescription>Die Karte und ihr Lernfortschritt werden entfernt. Die zugehörige Notiz bleibt erhalten.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={saving}>Abbrechen</AlertDialogCancel><AlertDialogAction disabled={saving} onClick={async e => { e.preventDefault(); if (await save(w => ({ ...w, cards: w.cards.filter(c => c.id !== card.id) }), "Lernkarte gelöscht")) { setDeleting(false); onClose(); } }}>Löschen</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}

export function Flashcards({ workspace, save, saving, onEdit, onStudyChange }: { workspace: Workspace; save: SaveWorkspace; saving: boolean; onEdit: (card: Flashcard) => void; onStudyChange: (studying: boolean) => void }) {
  const [queue, setQueue] = useState<{ id: string; reviews: number; dueAt: string }[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [filter, setFilter] = useState("");
  const revealRef = useRef<HTMLButtonElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const due = workspace.cards.filter(c => Date.parse(c.dueAt) <= clock).sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id));
  const entry = queue?.[index];
  const card = entry ? workspace.cards.find(c => c.id === entry.id) : null;
  const changed = !!(card && entry && (card.reviews !== entry.reviews || card.dueAt !== entry.dueAt));
  const next = [...workspace.cards].sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  const studying = queue !== null;
  useEffect(() => { onStudyChange(studying); return () => onStudyChange(false); }, [studying, onStudyChange]);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (queue && !revealed) revealRef.current?.focus(); }, [index, revealed, queue]);
  async function rate(known: boolean) {
    if (!card || saving || changed) return;
    const ok = await save(w => ({ ...w, cards: w.cards.map(c => c.id === card.id ? reviewCard(c, known) : c) }), known ? "Gespeichert. Nächste Wiederholung geplant." : "Gespeichert. In zehn Minuten noch einmal.");
    if (ok) { setRevealed(false); setIndex(i => i + 1); setClock(Date.now()); }
  }
  function start(cards: Flashcard[]) { setQueue(cards.map(c => ({ id: c.id, reviews: c.reviews, dueAt: c.dueAt }))); setIndex(0); setRevealed(false); }
  if (queue) {
    if (changed) return <section className="study-finished"><Clock3 size={30} /><h2>Dieser Gedanke wurde schon wiederholt.</h2><p>Der gespeicherte Lernstand ist neuer als diese Lernrunde. Er bleibt erhalten.</p><Button onClick={() => { setIndex(i => i + 1); setRevealed(false); }}>Mit nächster Karte fortfahren</Button></section>;
    if (!card) return <section className="study-finished"><span className="study-complete-icon"><Check size={32} /></span><h2>Ein Stück Wissen bleibt.</h2><p>{index} {index === 1 ? "Karte" : "Karten"} wiederholt. Dein Fortschritt ist gespeichert.</p><Button onClick={() => setQueue(null)}>Zur Kartenübersicht</Button></section>;
    const linked = workspace.notes.find(n => n.id === card.noteId);
    return <section className="study-session"><div className="study-topline"><Button variant="ghost" size="sm" disabled={saving} onClick={() => setQueue(null)}><ArrowLeft size={16} />Beenden</Button><span>{index + 1} von {queue.length}</span><span className="study-note">{linked?.title ?? "Deine Lernkarte"}</span></div><Progress value={index / queue.length * 100} aria-label="Fortschritt dieser Lernrunde" />
      <article className={"study-card " + (revealed ? "revealed" : "")}><div className="study-label"><Layers3 size={17} />ERINNERN STATT NACHLESEN</div><div className="study-question"><Markdown content={card.question} /></div>
        {revealed ? <div ref={answerRef} tabIndex={-1} className="study-answer" aria-label="Antwort"><span className="eyebrow">DIE ANTWORT</span><Markdown content={card.answer} /></div> : <div className="study-pause"><span>Ein kurzer Moment zum Nachdenken.</span><Button ref={revealRef} className="reveal-button" onClick={() => { setRevealed(true); requestAnimationFrame(() => answerRef.current?.focus()); }}>Antwort aufdecken</Button></div>}
      </article>
      {revealed && <div className="study-rating"><p>Wie gut konntest du dich erinnern?</p><div><Button className="rate-again" variant="outline" disabled={saving} onClick={() => void rate(false)}><RotateCcw size={17} /><span>Noch üben<small>in 10 Minuten</small></span></Button><Button className="rate-known" disabled={saving} onClick={() => void rate(true)}><Check size={17} /><span>Gewusst<small>{reviewCard(card, true).intervalDays === 1 ? "morgen" : "in " + reviewCard(card, true).intervalDays + " Tagen"}</small></span></Button></div></div>}
    </section>;
  }
  return <section className="flashcards-home"><div className="flashcards-intro"><div><span className="eyebrow"><Layers3 size={15} />DEIN WISSEN FESTIGEN</span><h2>{due.length ? due.length + (due.length === 1 ? " Gedanke wartet auf dich." : " Gedanken warten auf dich.") : workspace.cards.length ? "Für den Moment ist alles da." : "Was möchtest du dir merken?"}</h2><p>{due.length ? "Eine Frage nach der anderen. In deinem Tempo." : workspace.cards.length ? "Die nächste Wiederholung ist am " + reviewDate(next.dueAt) + "." : "Halte eine Frage und ihre Antwort fest – mit Worten, Bildern oder Diagrammen."}</p></div>{due.length ? <Button className="primary-action" onClick={() => start(due)}>Lernrunde starten</Button> : !workspace.cards.length ? <Button onClick={() => onEdit(newFlashcard())}><Plus size={17} />Erste Lernkarte</Button> : <Clock3 size={30} />}</div>
    {workspace.cards.length > 0 && <><div className="section-heading"><h2>Deine Lernkarten <span>{workspace.cards.length}</span></h2><Input className="card-search" aria-label="Lernkarten durchsuchen" placeholder="Karte finden …" value={filter} onChange={e => setFilter(e.target.value)} /></div><div className="flashcard-list">{workspace.cards.filter(c => (c.question + " " + c.answer).toLowerCase().includes(filter.toLowerCase())).map(c => <article key={c.id}><span className="flashcard-list-icon"><Layers3 size={20} /></span><div><h3>{c.question.replace(/!\[[^\]]*\]\([^)]*\)/g, "Abbildung").replace(/[#*`]/g, "").slice(0, 160)}</h3><p>{Date.parse(c.dueAt) <= clock ? "Bereit zum Lernen" : "Nächste Wiederholung: " + reviewDate(c.dueAt)} · {c.reviews} Wiederholungen</p></div><Button variant="ghost" size="icon" aria-label="Lernkarte bearbeiten" onClick={() => onEdit(c)}><Pencil size={16} /></Button></article>)}</div></>}
  </section>;
}
