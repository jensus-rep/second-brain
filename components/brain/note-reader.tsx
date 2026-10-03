"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, ChevronDown, Clock3, FileText, Layers3, Link2, List, MoreHorizontal, Pencil, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Note, Workspace } from "@/lib/brain/model";
import { Markdown } from "./markdown";

type Heading = { id: string; title: string; level: number };
const date = (value: string) => new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" }).format(new Date(value));

export function NoteReader({ note, workspace, saving, onClose, onOpen, onEdit, onFlashcard, onFavorite, onArchive, onTopic, onTag }: {
  note: Note; workspace: Workspace; saving: boolean; onClose: () => void; onOpen: (id: string) => void;
  onEdit: () => void; onFlashcard: () => void; onFavorite: () => void; onArchive: () => void;
  onTopic: (id: string) => void; onTag: (tag: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [activeHeading, setActiveHeading] = useState("");
  const topic = workspace.topics.find(t => t.id === note.topicId);
  const related = workspace.notes.filter(n => note.relatedIds.includes(n.id) || n.relatedIds.includes(note.id));
  const minutes = Math.max(1, Math.ceil(note.content.split(/\s+/).filter(Boolean).length / 220));

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0 });
      const items = Array.from(articleRef.current?.querySelectorAll<HTMLElement>('[id^="entry-section-"]') ?? []);
      setHeadings(items.map(element => ({ id: element.id, title: element.textContent ?? "", level: Number(element.tagName.slice(1)) })));
      setActiveHeading(items[0]?.id ?? "");
    });
    return () => cancelAnimationFrame(frame);
  }, [note.id, note.content]);

  useEffect(() => {
    if (!scrollRef.current || !headings.length) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveHeading(visible[0].target.id);
    }, { root: scrollRef.current, rootMargin: "-5% 0px -65% 0px" });
    for (const heading of headings) {
      const element = articleRef.current?.querySelector(`[id="${heading.id}"]`);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [headings]);

  function jump(id: string) {
    const element = articleRef.current?.querySelector<HTMLElement>(`[id="${id}"]`);
    element?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    element?.setAttribute("tabindex", "-1");
    element?.focus({ preventScroll: true });
    setActiveHeading(id);
    setOutlineOpen(false);
  }

  const outline = <nav aria-label="In diesem Eintrag">{headings.map(heading => <button key={heading.id} className={heading.level > 2 ? "outline-subheading" : ""} aria-current={activeHeading === heading.id ? "location" : undefined} onClick={() => jump(heading.id)}>{heading.title}</button>)}</nav>;

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="entry-reader" showCloseButton={false} onOpenAutoFocus={event => { event.preventDefault(); articleRef.current?.focus(); }} onEscapeKeyDown={event => { if (document.querySelector(".lightbox")) event.preventDefault(); }} onInteractOutside={event => { if (document.querySelector(".lightbox")) event.preventDefault(); }}>
      <header className="entry-toolbar">
        <DialogClose asChild><Button variant="ghost" className="reader-back"><X size={17} /><span>Schließen</span></Button></DialogClose>
        <span className="entry-toolbar-label">Wissenseintrag</span>
        <div className="entry-toolbar-actions">
          <Button variant="outline" size="sm" onClick={onEdit}><Pencil size={15} />Bearbeiten</Button>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Weitere Notizaktionen"><MoreHorizontal size={20} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
            <DropdownMenuItem disabled={saving} onSelect={onFavorite}><Star size={16} />{note.favorite ? "Favorit entfernen" : "Als Favorit merken"}</DropdownMenuItem>
            <DropdownMenuItem onSelect={onFlashcard}><Layers3 size={16} />Lernkarte erstellen</DropdownMenuItem>
            <DropdownMenuItem disabled={saving} onSelect={onArchive}><Archive size={16} />{note.archived ? "Wiederherstellen" : "Archivieren"}</DropdownMenuItem>
          </DropdownMenuContent></DropdownMenu>
        </div>
      </header>
      <div className="entry-scroll" ref={scrollRef}>
        <div className={"entry-layout " + (headings.length > 2 ? "with-outline" : "")}>
          <article className="entry-article" ref={articleRef} tabIndex={-1}>
            <header className="entry-heading">
              <div className="entry-kicker"><button className="entry-topic" onClick={() => onTopic(note.topicId ?? "::unassigned")}><span className={"topic-dot " + (topic?.color ?? "gray")} />{topic?.title ?? "Ohne Thema"}</button>{note.archived && <span className="badge">Archiviert</span>}{note.favorite && <Star size={14} className="entry-favorite" fill="currentColor" />}<span className="entry-reading-time"><Clock3 size={14} />{minutes} Min. Lesezeit</span></div>
              <DialogTitle className="entry-title">{note.title}</DialogTitle>
              <DialogDescription className={note.summary ? "entry-summary" : "sr-only"}>{note.summary || "Wissenseintrag lesen"}</DialogDescription>
            </header>
            {headings.length > 2 && <Collapsible className="mobile-outline" open={outlineOpen} onOpenChange={setOutlineOpen}><CollapsibleTrigger asChild><button className="details-trigger"><List size={16} />In diesem Eintrag<ChevronDown size={16} /></button></CollapsibleTrigger><CollapsibleContent>{outline}</CollapsibleContent></Collapsible>}
            <Markdown content={note.content || "Diese Notiz wartet noch auf deinen ersten Gedanken."} headingPrefix="entry-section" />
            <footer className="entry-context">
              {related.length > 0 && <section className="entry-related"><h3><Link2 size={16} />Weiterlesen <span>{related.length}</span></h3><div>{related.map(n => <button key={n.id} onClick={() => onOpen(n.id)}><FileText size={17} /><span>{n.title}{n.archived && <small>Archiviert</small>}</span></button>)}</div></section>}
              <Collapsible className="entry-details"><CollapsibleTrigger asChild><button className="details-trigger">Details zum Eintrag<ChevronDown size={16} /></button></CollapsibleTrigger><CollapsibleContent>
                <dl className="entry-dates"><div><dt>Erstellt</dt><dd>{date(note.createdAt)}</dd></div><div><dt>Bearbeitet</dt><dd>{date(note.updatedAt)}</dd></div></dl>
                {note.tags.length > 0 && <div className="reader-tags" aria-label="Tags">{note.tags.map(tag => <button key={tag} onClick={() => onTag(tag)}>#{tag}</button>)}</div>}
                <Button variant="ghost" size="sm" onClick={onFlashcard}><Layers3 size={16} />Lernkarte erstellen</Button>
              </CollapsibleContent></Collapsible>
            </footer>
          </article>
          {headings.length > 2 && <aside className="entry-outline"><span className="outline-label">IN DIESEM EINTRAG</span>{outline}</aside>}
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
