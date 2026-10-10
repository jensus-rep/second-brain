"use client";

import { useEffect, useState } from "react";
import { Archive, BookOpen, Check, Compass, Download, FolderOpen, GraduationCap, KeyRound, Layers3, LockKeyhole, LogOut, Menu, Network, Plus, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export type BrainView = "home" | "tutor" | "library" | "topics" | "collections" | "paths" | "connections" | "favorites" | "archive" | "flashcards" | "quizzes";

const shortcuts = [
  { id: "home", label: "Start", name: "Mein Überblick", icon: Compass },
  { id: "tutor", label: "Tutor", name: "Tutor", icon: GraduationCap },
  { id: "library", label: "Wissen", name: "Wissensbibliothek", icon: BookOpen },
  { id: "flashcards", label: "Karten", name: "Lernkarten", icon: Layers3 },
  { id: "quizzes", label: "Tests", name: "Tests & Übungen", icon: Check },
] as const;

const moreViews = [
  { id: "topics", label: "Themen", icon: FolderOpen },
  { id: "collections", label: "Lernsammlungen", icon: Layers3 },
  { id: "paths", label: "Lernpfade", icon: GraduationCap },
  { id: "connections", label: "Verbindungen", icon: Network },
  { id: "favorites", label: "Favoriten", icon: Star },
  { id: "archive", label: "Archiv", icon: Archive },
] as const;

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

  return <Sheet open={open} onOpenChange={setOpen}>
    <nav className="mobile-navigation" aria-label="Hauptnavigation">
      {shortcuts.map(({ id, label, name, icon: Icon }) => <Button key={id} variant="ghost" className="mobile-navigation-item" aria-label={name} aria-current={view === id ? "page" : undefined} onClick={() => go(id)}><Icon aria-hidden="true" /><span>{label}</span></Button>)}
      <SheetTrigger asChild><Button variant="ghost" className="mobile-navigation-item" aria-label="Weitere Bereiche öffnen" aria-current={moreViews.some(item => item.id === view) ? "page" : undefined}><Menu aria-hidden="true" /><span>Menü</span></Button></SheetTrigger>
    </nav>
    <SheetContent side="bottom" className="mobile-menu" showCloseButton={false} onCloseAutoFocus={event => { if (window.matchMedia("(min-width: 768px)").matches) { event.preventDefault(); document.querySelector<HTMLElement>('.brain-sidebar [data-active="true"]')?.focus({ preventScroll: true }); } }}>
      <SheetHeader className="mobile-menu-heading"><SheetTitle>Alle Bereiche</SheetTitle><SheetDescription>Wissen entdecken und deinen Wissensraum verwalten.</SheetDescription></SheetHeader>
      <div className="mobile-menu-scroll">
        <nav className="mobile-menu-grid" aria-label="Weitere Bereiche">{moreViews.map(({ id, label, icon: Icon }) => <Button key={id} variant="ghost" aria-current={view === id ? "page" : undefined} onClick={() => choose(() => go(id))}><Icon aria-hidden="true" /><span>{label}</span></Button>)}</nav>
        <div className="mobile-menu-tools"><Button variant="outline" disabled={loading} onClick={() => choose(newNote)}><Plus aria-hidden="true" />Neue Notiz</Button><Button variant="ghost" onClick={() => choose(openTransfer)}><Download aria-hidden="true" />Import & Datensicherung</Button><Button variant="ghost" onClick={() => choose(openKeys)}><KeyRound aria-hidden="true" />Zugangsschlüssel</Button></div>
      </div>
      <div className="mobile-menu-footer"><span><LockKeyhole size={14} aria-hidden="true" />Privater Wissensraum</span><Button variant="ghost" onClick={signOut}><LogOut aria-hidden="true" />Abmelden</Button></div>
      <SheetClose asChild><Button variant="outline" className="mobile-menu-close" aria-label="Menü schließen"><X aria-hidden="true" />Schließen</Button></SheetClose>
    </SheetContent>
  </Sheet>;
}
