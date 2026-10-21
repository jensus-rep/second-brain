"use client";

import { Check, Minus, RotateCcw, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import type { FlashcardChoices as Choices } from "@/lib/brain/flashcard-choices";

export function FlashcardChoices({ choices, selectedIds, revealed, onToggle }: {
  choices: Choices; selectedIds: string[]; revealed: boolean; onToggle: (id: string) => void;
}) {
  const checked = revealed && selectedIds.length > 0;
  const correct = checked && choices.correctIds !== null
    ? selectedIds.length === choices.correctIds.length && selectedIds.every(id => choices.correctIds!.includes(id)) : null;

  return <fieldset className="study-choices">
    <legend>Antworten auswählen</legend>
    <p className="study-choices-hint">{revealed ? "Deine Auswahl bleibt zum Vergleichen markiert." : "Wähle eine oder mehrere Antworten. Danach kannst du deine Auswahl prüfen."}</p>
    <ul>
      {choices.choices.map(choice => {
        const selected = selectedIds.includes(choice.id);
        const expected = choices.correctIds?.includes(choice.id);
        const state = checked && choices.correctIds
          ? selected ? expected ? "correct" : "incorrect" : expected ? "missed" : "idle"
          : selected ? "selected" : "idle";
        return <li key={choice.id}>
          <Button type="button" variant="outline" className="study-choice" aria-pressed={selected} disabled={revealed}
            data-state={state} onClick={() => onToggle(choice.id)}>
            <span className="study-choice-marker" aria-hidden="true">{state === "incorrect" ? <X size={15} /> : selected ? <Check size={15} /> : state === "missed" ? <Minus size={15} /> : null}</span>
            <span className="study-choice-copy"><strong>{choice.id}:</strong>{" "}<span className="prose-brain"><ReactMarkdown
              remarkPlugins={[remarkGfm]} skipHtml unwrapDisallowed allowedElements={["p", "strong", "em", "del", "code", "br"]}
              components={{ p: ({ children }) => <span>{children}</span> }}>{choice.content}</ReactMarkdown></span></span>
            {checked && choices.correctIds && state !== "idle" && <span className="study-choice-result">{state === "correct" ? "Richtig gewählt" : state === "incorrect" ? "Falsch gewählt" : "Auch richtig"}</span>}
          </Button>
        </li>;
      })}
    </ul>
    {checked && <div className="study-choice-feedback" role="status" data-correct={correct ?? "unknown"}>
      {correct === null ? <><strong>Vergleiche deine Auswahl mit der Musterantwort.</strong><span>Für diese Karte ist keine eindeutige Lösung hinterlegt.</span></>
        : correct ? <><Check size={18} aria-hidden="true" /><div><strong>Richtig gewählt.</strong><span>Deine Auswahl stimmt mit der Musterantwort überein.</span></div></>
        : <><RotateCcw size={18} aria-hidden="true" /><div><strong>Noch nicht ganz.</strong><span>Richtig: {choices.correctIds!.join(", ")}. Vergleiche die markierten Antworten.</span></div></>}
    </div>}
  </fieldset>;
}
