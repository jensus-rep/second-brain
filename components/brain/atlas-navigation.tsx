"use client";

import { Check, ChevronDown, Download, KeyRound, LockKeyhole, LogOut, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { BrainView } from "./mobile-navigation";

export type AreaId = "start" | "wissen" | "lernen";

type AreaView = { id: BrainView; label: string };
type Area = { id: AreaId; label: string; home: BrainView; views: AreaView[] };

/** Three main areas replace the long sidebar; every former view stays one click away inside its area. */
export const AREAS: Area[] = [
  { id: "start", label: "Start", home: "home", views: [] },
  { id: "wissen", label: "Wissen", home: "library", views: [
    { id: "library", label: "Wissensbibliothek" },
    { id: "topics", label: "Themen" },
    { id: "scripts", label: "Skripte" },
    { id: "connections", label: "Verbindungen" },
    { id: "favorites", label: "Favoriten" },
    { id: "archive", label: "Archiv" },
  ] },
  { id: "lernen", label: "Lernen", home: "today", views: [
    { id: "today", label: "Heute" },
    { id: "tutor", label: "Tutor" },
    { id: "collections", label: "Lernsammlungen" },
    { id: "paths", label: "Lernpfade" },
    { id: "flashcards", label: "Lernkarten" },
    { id: "quizzes", label: "Tests & Übungen" },
  ] },
];

export function areaOf(view: BrainView): Area {
  return AREAS.find(area => area.views.some(item => item.id === view)) ?? AREAS[0];
}

type HeaderProps = {
  view: BrainView;
  go: (view: BrainView) => void;
  saveLabel: string;
  saving: boolean;
  transferDisabled: boolean;
  onSearch: () => void;
  openTransfer: () => void;
  openKeys: () => void;
  signOut: () => void;
};

export function AtlasHeader({ view, go, saveLabel, saving, transferDisabled, onSearch, openTransfer, openKeys, signOut }: HeaderProps) {
  const current = areaOf(view);
  return <header className="atlas-header">
    <div className="atlas-header-inner">
      <button className="atlas-brand" onClick={() => go("home")} aria-label="Second Brain Startseite">
        <img src="/brand/second-brain-mark.svg" alt="" width={34} height={34} />
        <span>Second Brain</span>
      </button>
      <nav className="atlas-areas" aria-label="Hauptbereiche">
        {AREAS.map(area => <button key={area.id} aria-current={current.id === area.id ? "page" : undefined} onClick={() => go(area.home)}>{area.label}</button>)}
      </nav>
      <div className="atlas-tools">
        <span className="save-state" role="status"><Check size={14} className={saving ? "pulse" : ""} aria-hidden="true" />{saveLabel}</span>
        <Button variant="outline" className="atlas-search" onClick={onSearch} aria-label="Suche öffnen"><Search size={17} aria-hidden="true" /><span>Suchen</span><kbd>Strg K</kbd></Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="atlas-account" aria-label="Konto und Einstellungen"><UserRound size={18} aria-hidden="true" /><ChevronDown size={14} aria-hidden="true" className="atlas-account-chevron" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="atlas-account-menu">
            <DropdownMenuLabel className="atlas-account-label"><LockKeyhole size={14} aria-hidden="true" />Privater Wissensraum</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={transferDisabled} onSelect={openTransfer}><Download aria-hidden="true" />Import &amp; Datensicherung</DropdownMenuItem>
            <DropdownMenuItem onSelect={openKeys}><KeyRound aria-hidden="true" />Zugangsschlüssel</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut}><LogOut aria-hidden="true" />Abmelden</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </header>;
}

export function AtlasSubnav({ view, go }: { view: BrainView; go: (view: BrainView) => void }) {
  const area = areaOf(view);
  if (!area.views.length) return null;
  return <nav className="atlas-subnav" aria-label={"Bereich " + area.label}>
    <div className="atlas-subnav-inner">
      {area.views.map(item => <button key={item.id} aria-current={view === item.id ? "page" : undefined} onClick={() => go(item.id)}>{item.label}</button>)}
    </div>
  </nav>;
}
