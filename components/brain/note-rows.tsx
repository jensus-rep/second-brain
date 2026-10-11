"use client";

import { ArrowUpRight, FileText, Link2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Note, Topic } from "@/lib/brain/model";
import { firstImage, noteExcerpt } from "@/lib/brain/media";
import { getTopicPathLabel } from "@/lib/brain/topics";

const dateLabel = (date: string) => new Intl.DateTimeFormat("de-DE", {
  day: "numeric", month: "short", timeZone: "Europe/Berlin",
}).format(new Date(date));

export function NoteRows({ notes, topics, saving, onOpen, onFavorite }: {
  notes: Note[]; topics: Topic[]; saving: boolean;
  onOpen: (id: string) => void; onFavorite: (note: Note) => void;
}) {
  return <div className="note-rows">{notes.map(note => {
    const topic = topics.find(item => item.id === note.topicId);
    const cover = firstImage(note.content);
    return <article className="note-row" key={note.id}>
      <button className="note-row-open" onClick={() => onOpen(note.id)}>
        <span className={"note-row-symbol " + (topic?.color ?? "gray")} aria-hidden="true">
          {cover ? <img src={cover.src} alt="" loading="lazy" /> : <FileText size={20} />}
        </span>
        <span className="note-row-copy">
          <span className="note-row-topic">{note.topicId ? getTopicPathLabel(topics, note.topicId) : "Ohne Thema"}</span>
          <span className="note-row-title" role="heading" aria-level={3}>{note.title}</span>
          <span className="note-row-summary">{note.summary || noteExcerpt(note.content)}</span>
          <span className="note-row-meta"><time dateTime={note.updatedAt}>{dateLabel(note.updatedAt)}</time>{note.relatedIds.length > 0 && <span><Link2 size={12} aria-hidden="true" />{note.relatedIds.length} Verknüpfungen</span>}</span>
        </span>
        <ArrowUpRight className="note-row-arrow" size={17} aria-hidden="true" />
      </button>
      <Button className={"note-row-favorite" + (note.favorite ? " is-favorite" : "")} variant="ghost" size="icon" disabled={saving} aria-label={note.favorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"} onClick={() => onFavorite(note)}><Star size={16} fill={note.favorite ? "currentColor" : "none"} /></Button>
    </article>;
  })}</div>;
}
