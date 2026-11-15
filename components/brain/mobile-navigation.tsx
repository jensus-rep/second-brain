"use client";

import { useEffect, useState } from "react";
import { Archive, BookOpen, CalendarCheck, Check, Compass, Download, FileText, FolderOpen, GitBranch, GraduationCap, KeyRound, Layers3, LockKeyhole, LogOut, Map as MapIcon, Menu, Network, Plus, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AREAS, areaOf } from "./atlas-navigation";

export type BrainView = "home" | "today" | "tutor" | "library" | "scripts" | "topics" | "collections" | "paths" | "connections" | "favorites" | "archive" | "flashcards" | "quizzes";

const areaIcons = { start: MapIcon, wissen: BookOpen, lernen: Layers3 } as const;

const viewIcons: Record<BrainView, typeof BookOpen> = {
  home: Compass, library: BookOpen, topics: FolderOpen, scripts: FileText, connections: Network, favorites: Star, archive: Archive,
  today: CalendarCheck, tutor: GraduationCap, collections: Layers3, paths: GitBranch, flashcards: Layers3, quizzes: Check,
};

type Props = {
  view: BrainView;
  go: (view: BrainView) => void;
  loading: boolean;
  newNote: () => void;
  openTransfer: () => void;
  openKeys: () => void;
  signOut: () => void;
};

export function MobileNavigation({ view, go, loading, newNote, openTransfer, openKeys, signOut }: Props) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  function choose(action: () => void) { setOpen(false); action(); }
  const current = areaOf(view);

  return <Sheet open={open} onOpenChange={setOpen}>
    <nav className="mobile-navigation" aria-label="Hauptnavigation">
      {AREAS.map(area => { const Icon = areaIcons[area.id]; return <Button key={area.id} variant="ghost" className="mobile-navigation-item" aria-current={current.id === area.id ? "page" : undefined} onClick={() => go(area.home)}><Icon aria-hidden="true" /><span>{area.label}</span></Button>; })}
      <SheetTrigger asChild><Button variant="ghost" className="mobile-navigation-item" aria-label="Weitere Bereiche öffnen"><Menu aria-hidden="true" /><span>Menü</span></Button></SheetTrigger>
    </nav>
    <SheetContent side="bottom" className="mobile-menu" showCloseButton={false} onCloseAutoFocus={event => { if (window.matchMedia("(min-width: 768px)").matches) { event.preventDefault(); document.querySelector<HTMLElement>('.atlas-areas [aria-current="page"]')?.focus({ preventScroll: true }); } }}>
      <SheetHeader className="mobile-menu-heading"><SheetTitle>Alle Bereiche</SheetTitle><SheetDescription>Wissen entdecken und deinen Wissensraum verwalten.</SheetDescription></SheetHeader>
      <div className="mobile-menu-scroll">
        {AREAS.filter(area => area.views.length).map(area => <section key={area.id} className="mobile-menu-section" aria-label={area.label}><h3>{area.label}</h3><nav className="mobile-menu-grid" aria-label={"Menü " + area.label}>{area.views.map(({ id, label }) => { const Icon = viewIcons[id]; return <Button key={id} variant="ghost" aria-current={view === id ? "page" : undefined} onClick={() => choose(() => go(id))}><Icon aria-hidden="true" /><span>{label}</span></Button>; })}</nav></section>)}
        <div className="mobile-menu-tools"><Button variant="outline" disabled={loading} onClick={() => choose(newNote)}><Plus aria-hidden="true" />Neue Notiz</Button><Button variant="ghost" onClick={() => choose(openTransfer)}><Download aria-hidden="true" />Import & Datensicherung</Button><Button variant="ghost" onClick={() => choose(openKeys)}><KeyRound aria-hidden="true" />Zugangsschlüssel</Button></div>
      </div>
      <div className="mobile-menu-footer"><span><LockKeyhole size={14} aria-hidden="true" />Privater Wissensraum</span><Button variant="ghost" onClick={signOut}><LogOut aria-hidden="true" />Abmelden</Button></div>
      <SheetClose asChild><Button variant="outline" className="mobile-menu-close" aria-label="Menü schließen"><X aria-hidden="true" />Schließen</Button></SheetClose>
    </SheetContent>
  </Sheet>;
}
