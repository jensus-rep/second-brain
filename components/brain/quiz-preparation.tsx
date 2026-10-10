"use client";

import { useId, useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, GraduationCap, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Workspace } from "@/lib/brain/model";
import type { PreparationArea } from "@/lib/brain/quiz-preparation";

export type { PreparationArea } from "@/lib/brain/quiz-preparation";

type Props = {
  subject: string;
  areas: PreparationArea[];
  workspace: Workspace;
  saving: boolean;
  onStart: (concept: string, allQuestions?: boolean) => void;
  onOpenNote?: (id: string) => void;
};

export function QuizPreparation({ subject, areas, workspace, saving, onStart, onOpenNote }: Props) {
  const id = useId();
  const [selection, setSelection] = useState<{ subject: string; concept: string } | null>(null);
  const [expandedNotesFor, setExpandedNotesFor] = useState<{ subject: string; concept: string } | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const selected = selection?.subject === subject ? areas.find(area => area.concept === selection.concept) : undefined;
  const completed = areas.filter(area => area.completed).length;
  const started = areas.some(area => area.total > 0 || area.completed);
  const allComplete = areas.length > 0 && completed === areas.length;
  const nextArea = areas.find(area => !area.completed) ?? areas[0];
  const materialNotes = selected ? selected.noteIds.flatMap(noteId => {
    const note = workspace.notes.find(note => note.id === noteId && !note.archived);
    return note ? [note] : [];
  }) : [];
  const notesExpanded = !!selected && expandedNotesFor?.subject === subject && expandedNotesFor.concept === selected.concept;
  const notes = notesExpanded ? materialNotes : materialNotes.slice(0, 4);

  function selectArea(area: PreparationArea) {
    setSelection({ subject, concept: area.concept });
    setExpandedNotesFor(null);
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    }));
  }

  if (!areas.length) return null;

  return <section className="quiz-panel quiz-preparation" aria-labelledby={`${id}-heading`}>
    <div className="quiz-preparation-header"><div><span className="eyebrow">SCHRITT FÜR SCHRITT</span><h2 id={`${id}-heading`}>Vorbereitung für {subject}</h2><p>Vom Nachlesen zum Anwenden: Arbeite die Lerneinheiten der Reihe nach durch oder wähle gezielt ein Thema.</p></div><div className="quiz-preparation-overview"><strong>{completed}<span> / {areas.length}</span></strong><small>Lerneinheiten bearbeitet</small></div></div>
    <Progress className="quiz-preparation-progress" value={completed / areas.length * 100} aria-label="Bearbeitete Lerneinheiten" aria-valuetext={`${completed} von ${areas.length} Lerneinheiten bearbeitet`} />
    <div className="quiz-preparation-intro"><p>Eine Einheit gilt als bearbeitet, wenn du eine Übungsrunde dazu vollständig beantwortet hast. Die Markierung zeigt deinen Arbeitsfortschritt; Wiederholung und eigene Erklärungen festigen dein Wissen.</p><Button type="button" onClick={() => selectArea(nextArea)} aria-controls={`${id}-detail`}>{allComplete ? "Vorbereitung wiederholen" : started ? "Vorbereitung fortsetzen" : "Vorbereitung starten"}<ArrowRight size={16} aria-hidden="true" /></Button></div>
    <div className="quiz-preparation-layout">
      <nav className="quiz-preparation-navigation" aria-labelledby={`${id}-units`}><h3 id={`${id}-units`}>Deine Lerneinheiten</h3><ol className="quiz-preparation-units">{areas.map((area, index) => <li key={area.concept}><Button type="button" variant="ghost" className={`quiz-preparation-unit${area.completed ? " is-complete" : ""}${selected?.concept === area.concept ? " is-selected" : ""}`} onClick={() => selectArea(area)} aria-current={selected?.concept === area.concept ? "step" : undefined} aria-controls={`${id}-detail`}><span className="quiz-preparation-unit-number" aria-hidden="true">{area.completed ? <Check size={15} /> : index + 1}</span><span className="quiz-preparation-unit-label"><strong>{area.concept}</strong><small>{area.questionCount} Aufgaben{area.completed ? " · Bearbeitet" : area.total > 0 ? " · Begonnen" : ""}</small></span><ArrowRight className="quiz-preparation-unit-arrow" size={15} aria-hidden="true" /></Button></li>)}</ol></nav>
      <article ref={detailRef} id={`${id}-detail`} className={`quiz-preparation-detail${selected ? "" : " is-empty"}${notesExpanded ? " is-expanded" : ""}`} aria-labelledby={`${id}-detail-heading`}>
        {selected ? <>
          <div className="quiz-preparation-detail-top"><span className="eyebrow">LERNEINHEIT {areas.indexOf(selected) + 1}</span>{selected.completed && <span className="quiz-preparation-complete"><Check size={14} aria-hidden="true" />Übungsrunde abgeschlossen</span>}</div>
          <h3 id={`${id}-detail-heading`}>{selected.concept}</h3><p className="quiz-preparation-detail-intro">{selected.questionCount} Aufgaben stehen für diese Einheit bereit. Lies die passenden Notizen und prüfe anschließend dein Verständnis.</p>
          {notes.length > 0 && <div className="quiz-preparation-notes" id={`${id}-materials`}><h4><BookOpen size={16} aria-hidden="true" />Zum Nachlesen</h4>{notes.map(note => <article className="quiz-preparation-note" key={note.id}><h5>{note.title}</h5>{note.summary && <p>{note.summary}</p>}{onOpenNote && <Button type="button" size="sm" variant="outline" onClick={() => onOpenNote(note.id)} aria-label={`Lerninhalt öffnen: ${note.title}`}><BookOpen size={14} aria-hidden="true" />Lerninhalt öffnen</Button>}</article>)}{materialNotes.length > 4 && <Button type="button" className="quiz-preparation-more" size="sm" variant="ghost" aria-expanded={notesExpanded} aria-controls={`${id}-materials`} onClick={() => setExpandedNotesFor(notesExpanded ? null : { subject, concept: selected.concept })}>{notesExpanded ? "Weniger Lerninhalte" : `Weitere Lerninhalte (${materialNotes.length - 4})`}</Button>}</div>}
          <div className="quiz-preparation-practice"><h4>Verständnis prüfen</h4><p>Die Kurzrunde prüft dein Verständnis mit bis zu drei Aufgaben, möglichst aus Grundlagen, Anwendung und Transfer.{selected.questionCount > 3 && selected.questionCount <= 30 && " Mit dem vollständigen Fragenbestand übst du alle Aufgaben dieser Einheit."} Die Erklärungen helfen dir, Unsicherheiten gezielt zu klären.</p>{selected.total > 0 && <p className="quiz-preparation-answers">Letzte Runde: <strong>{selected.correct} von {selected.total} richtig</strong>.</p>}<div className="quiz-preparation-practice-actions"><Button type="button" disabled={saving || !selected.questionCount} onClick={() => onStart(selected.concept)}>{selected.completed ? <RotateCcw size={16} aria-hidden="true" /> : <GraduationCap size={16} aria-hidden="true" />}{selected.completed ? "Erneut üben" : "Lerneinheit üben"}</Button>{selected.questionCount > 3 && selected.questionCount <= 30 && <Button type="button" variant="outline" disabled={saving} onClick={() => onStart(selected.concept, true)}>Alle {selected.questionCount} Aufgaben üben</Button>}</div></div>
        </> : <><span className="quiz-preparation-empty-icon"><GraduationCap size={27} aria-hidden="true" /></span><h3 id={`${id}-detail-heading`}>Wähle eine Lerneinheit</h3><p>Starte mit der nächsten offenen Einheit oder wähle ein Thema aus der Übersicht. Hier findest du die passenden Notizen und kannst die Übung starten.</p></>}
      </article>
    </div>
  </section>;
}
