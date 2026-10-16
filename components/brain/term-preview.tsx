"use client";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { buildGlossary, noteSection, noteTerms, noteVisuals, preferredVisual, sameTerm, splitNoteTitle } from "@/lib/brain/glossary";
import { noteExcerpt } from "@/lib/brain/media";
import type { Note, Topic } from "@/lib/brain/model";
import { getTopicPathLabel } from "@/lib/brain/topics";
import { GlossaryContext, type GlossaryApi } from "./glossary-context";
import { Markdown } from "./markdown";
import { Diagram, Figure } from "./visual";

type Visit = { noteId: string; term: string };
const MAX_RELATED = 8;

/** Lets linked concepts in learning material open a short preview of their note. */
export function GlossaryProvider({ notes, topics, onOpenNote, children }: { notes: Note[]; topics: Topic[]; onOpenNote?: (id: string) => void; children: ReactNode }) {
  // Saving a card review replaces the notes array; links only depend on titles and terms.
  const sources = JSON.stringify(notes.filter(note => !note.archived).map(note => [note.id, note.title, note.terms ?? []]));
  const glossary = useMemo(() => buildGlossary((JSON.parse(sources) as [string, string, string[]][])
    .map(([id, title, terms]) => ({ id, title, terms, archived: false }))), [sources]);
  const notesById = useMemo(() => new Map(notes.filter(note => !note.archived).map(note => [note.id, note])), [notes]);
  const [trail, setTrail] = useState<Visit[]>([]);
  // Without a dialog trigger, focus has to return to the term that opened the preview.
  const origin = useRef<HTMLElement | null>(null);
  const open = useCallback((noteId: string, term: string, from?: HTMLElement) => { origin.current = from ?? null; setTrail([{ noteId, term }]); }, []);
  // Concepts inside the preview continue the trail, so "Zurück" leads to the previous one.
  const follow = useCallback((noteId: string, term: string) => setTrail(current => current.at(-1)?.noteId === noteId && sameTerm(current.at(-1)!.term, term) ? current : [...current, { noteId, term }]), []);
  const learning = useMemo<GlossaryApi>(() => ({ glossary, open }), [glossary, open]);
  const preview = useMemo<GlossaryApi>(() => ({ glossary, open: follow }), [glossary, follow]);
  const visit = trail.at(-1);
  const note = visit ? notesById.get(visit.noteId) : undefined;
  const previous = trail.length > 1 ? trail[trail.length - 2] : undefined;
  return <GlossaryContext.Provider value={learning}>
    {children}
    <Dialog open={!!note} onOpenChange={isOpen => { if (!isOpen) setTrail([]); }}>
      {note && visit && <DialogContent className="term-preview" onEscapeKeyDown={event => { if (document.querySelector(".lightbox")) event.preventDefault(); }}
        onCloseAutoFocus={event => { event.preventDefault(); origin.current?.focus({ preventScroll: true }); origin.current = null; }}>
        <GlossaryContext.Provider value={preview}>
          <TermPreview key={trail.length + ":" + note.id + ":" + visit.term} note={note} term={visit.term} topics={topics} notesById={notesById}
            previousTitle={previous?.term} onBack={() => setTrail(current => current.slice(0, -1))}
            onFollow={follow} onOpenNote={onOpenNote ? id => { origin.current = null; setTrail([]); onOpenNote(id); } : undefined} />
        </GlossaryContext.Provider>
      </DialogContent>}
    </Dialog>
  </GlossaryContext.Provider>;
}

function TermPreview({ note, term, topics, notesById, previousTitle, onBack, onFollow, onOpenNote }: {
  note: Note; term: string; topics: Topic[]; notesById: Map<string, Note>; previousTitle?: string;
  onBack: () => void; onFollow: (noteId: string, term: string) => void; onOpenNote?: (id: string) => void;
}) {
  const { head, subtitle } = splitNoteTitle(note.title);
  // A term explained in its own section ("Swarming", "OKR") gets that section
  // instead of the summary of the whole note.
  const section = useMemo(() => term && !sameTerm(term, head) ? noteSection(note.content, term) : null, [note.content, term, head]);
  // Short forms of the title ("Vision Board") keep the note's own heading;
  // further terms ("SAFe") are named and placed in their note.
  const alias = !!term && !sameTerm(term, head) && (!!section || !noteTerms(note.title).some(derived => sameTerm(derived, term)));
  const visuals = useMemo(() => noteVisuals(note.content), [note.content]);
  const [index, setIndex] = useState(() => preferredVisual(visuals, term, section?.heading));
  const visual = visuals[index];
  const related = note.relatedIds.map(id => notesById.get(id)).filter((item): item is Note => !!item).slice(0, MAX_RELATED);
  const step = (delta: number) => setIndex(current => (current + delta + visuals.length) % visuals.length);
  return <div className="term-preview-body">
    <header className="term-preview-header">
      {previousTitle && <Button type="button" variant="ghost" size="sm" className="term-preview-back" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" />Zurück zu {previousTitle}</Button>}
      <span className="eyebrow">{note.topicId ? getTopicPathLabel(topics, note.topicId) : "Begriff"}</span>
      <DialogTitle className="term-preview-title">{alias ? term : head}</DialogTitle>
      {alias ? <p className="term-preview-subtitle">aus „{head}“</p> : subtitle && <p className="term-preview-subtitle">{subtitle}</p>}
    </header>
    <DialogDescription asChild><div className="term-preview-summary">
      {section?.text && !sameTerm(section.heading, term) && <h3 className="term-preview-section">{section.heading}</h3>}
      <Markdown content={section?.text || note.summary.trim() || noteExcerpt(note.content)} linkTerms skipTermNoteId={note.id} />
    </div></DialogDescription>
    {visual ? <div className="term-preview-visual">
      {visuals.length > 1 && <div className="term-preview-pager" role="group" aria-label="Abbildungen dieses Lerninhalts">
        <Button type="button" variant="ghost" size="icon" aria-label="Vorherige Abbildung" onClick={() => step(-1)}><ChevronLeft size={18} /></Button>
        <span aria-live="polite">Abbildung {index + 1} von {visuals.length}{visual.heading && <small>{visual.heading}</small>}</span>
        <Button type="button" variant="ghost" size="icon" aria-label="Nächste Abbildung" onClick={() => step(1)}><ChevronRight size={18} /></Button>
      </div>}
      {visual.kind === "image" ? <Figure key={visual.src} src={visual.src} alt={visual.alt || head} caption={visual.caption} />
        : visual.kind === "diagram" ? <Diagram key={visual.source} source={visual.source} /> : <Markdown key={visual.markdown} content={visual.markdown} />}
    </div> : <p className="term-preview-empty"><ImageOff size={16} aria-hidden="true" />Zu diesem Begriff gibt es noch keine Abbildung.</p>}
    {related.length > 0 && <section className="term-preview-related" aria-label="Verwandte Lerninhalte">
      <h3>Hängt zusammen mit</h3>
      <div>{related.map(item => { const label = splitNoteTitle(item.title).head; return <button key={item.id} type="button" className="term-chip" onClick={() => onFollow(item.id, label)}>{label}</button>; })}</div>
    </section>}
    {onOpenNote && <div className="term-preview-actions"><Button type="button" onClick={() => onOpenNote(note.id)}><BookOpen size={16} aria-hidden="true" />Ganzen Lerninhalt öffnen</Button></div>}
  </div>;
}
