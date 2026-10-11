"use client";

import type { ReactNode, RefObject } from "react";
import { ArrowRight, BookOpen, GraduationCap, Layers3, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Workspace } from "@/lib/brain/model";
import { KnowledgeOrientation } from "./knowledge-orientation";

export function HomeWorkspace({ workspace, focus, notes, collections, path, reminders, searchRef, onSearch, onTopic, onNavigate }: {
  workspace: Workspace; focus: ReactNode; notes: ReactNode; collections: ReactNode;
  path: ReactNode; reminders: ReactNode;
  searchRef: RefObject<HTMLInputElement | null>;
  onSearch: (query: string) => void; onTopic: (id: string) => void;
  onNavigate: (view: "library" | "topics" | "flashcards" | "tutor") => void;
}) {
  return <div className="home-workspace">
    <div className="home-main-column">
      {focus}
      <section className="home-recent" aria-label="Zuletzt in deinem Wissensraum">
        <div className="section-heading"><div><span className="eyebrow">ANKNÜPFEN & WEITERDENKEN</span><h2>Zuletzt in deinem Wissensraum</h2></div><button onClick={() => onNavigate("library")} aria-label="Alle Notizen ansehen"><ArrowRight size={18} /></button></div>
        <div className="search-bar"><Search size={18} aria-hidden="true" /><Input ref={searchRef} aria-label="Wissen durchsuchen" placeholder="Wissen durchsuchen …" onChange={event => onSearch(event.target.value)} /><kbd>Strg K</kbd></div>
        {notes}
        <button className="workspace-text-link" onClick={() => onNavigate("library")}><BookOpen size={15} aria-hidden="true" />Zur Wissensbibliothek<ArrowRight size={15} aria-hidden="true" /></button>
      </section>
    </div>
    <aside className="home-side-column" aria-label="Orientierung und Lernzugänge">
      <KnowledgeOrientation workspace={workspace} onTopic={onTopic} onTopics={() => onNavigate("topics")} />
      <section className="home-learning-tools" aria-label="Deine Lernwerkzeuge">
        <span className="eyebrow">AUS WISSEN WIRD KÖNNEN</span><h2>Dein nächster Lernmoment</h2>
        <p>Wiederhole einen Gedanken oder lass dich durch deine Vorbereitung führen.</p>
        <Button variant="outline" onClick={() => onNavigate("tutor")}><GraduationCap size={18} />Zum Tutor<ArrowRight size={15} /></Button>
        <button className="home-card-access" onClick={() => onNavigate("flashcards")}><Layers3 size={18} /><span><strong>Wissen wiederholen</strong><small>{workspace.cards.length} Lernkarten</small></span><ArrowRight size={15} /></button>
      </section>
      {path}
    </aside>
    <div className="home-collections">{collections}</div>
    {reminders}
  </div>;
}
