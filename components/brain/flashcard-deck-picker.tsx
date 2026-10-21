"use client";

import { useState } from "react";
import { ArrowRightLeft, Check, Clock3, Layers3, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type FlashcardDeckOption = {
  id: string; title: string; description: string; count: number; due: number; remaining: number;
};

export function FlashcardDeckPicker({ decks, selectedId, disabled, studying, onSelect }: {
  decks: FlashcardDeckOption[]; selectedId: string; disabled: boolean; studying: boolean; onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const terms = query.toLocaleLowerCase("de").trim().split(/\s+/).filter(Boolean);
  const matches = decks.filter(deck => terms.every(term => `${deck.title} ${deck.description}`.toLocaleLowerCase("de").includes(term)));
  return <>
    <Button type="button" variant="outline" className="flashcard-deck-trigger" disabled={disabled} onClick={() => { setQuery(""); setOpen(true); }}>
      <ArrowRightLeft size={16} aria-hidden="true" />Deck wechseln
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flashcard-deck-dialog">
        <DialogHeader>
          <DialogTitle>Lernkarten-Deck wechseln</DialogTitle>
          <DialogDescription>{studying ? "Wähle dein nächstes Deck. Deine bisherigen Runden bleiben an ihrer Stelle gespeichert." : "Finde deine Lernsammlung und wähle sie direkt aus."}</DialogDescription>
        </DialogHeader>
        <div className="flashcard-deck-search"><Search size={17} aria-hidden="true" /><Input aria-label="Deck suchen" placeholder="Sprache, Stufe oder Thema …" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <div className="flashcard-deck-options" role="list" aria-label="Verfügbare Lernkarten-Decks">
          {matches.map(deck => <div role="listitem" key={deck.id}>
            <button type="button" className={"flashcard-deck-option" + (deck.id === selectedId ? " is-selected" : "")} disabled={disabled || studying && !deck.count} aria-label={`${deck.title} auswählen`} aria-current={deck.id === selectedId ? "true" : undefined} onClick={() => { setOpen(false); onSelect(deck.id); }}>
              <span className="flashcard-deck-icon"><Layers3 size={19} aria-hidden="true" /></span>
              <span className="flashcard-deck-copy"><strong>{deck.title}</strong><span>{deck.count} Karten · {deck.due} fällig{!deck.count && " · noch leer"}</span>{deck.remaining > 0 && <small><Clock3 size={12} aria-hidden="true" />{deck.remaining} in deiner gespeicherten Runde</small>}</span>
              {deck.id === selectedId && <Check size={18} className="flashcard-deck-selected" aria-hidden="true" />}
            </button>
          </div>)}
          {!matches.length && <p className="flashcard-deck-empty" role="status">Kein Deck passt zu „{query}“. Versuche einen anderen Suchbegriff.</p>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
