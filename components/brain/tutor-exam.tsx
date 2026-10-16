"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import type { Workspace } from "@/lib/brain/model";
import type { LearningAction, LearningRecommendation } from "@/lib/brain/learning-resume";
import { EXAM_MAX_QUESTIONS, EXAM_SIZES, EXAM_TIME_LIMITS, examSimulationInsights, planExamSimulation } from "@/lib/brain/exam-simulation";
import { ExamHistoryBars } from "./exam-simulation-report";

type Props = {
  workspace: Workspace;
  recommendation: LearningRecommendation;
  saving: boolean;
  now: number;
  onAction: (action: LearningAction) => void;
  onViewResult: (id: string, collectionId: string | null) => void;
};

const tasks = (count: number) => `${count} ${count === 1 ? "Aufgabe" : "Aufgaben"}`;

export function TutorExamSimulation({ workspace, recommendation, saving, now, onAction, onViewResult }: Props) {
  const insights = examSimulationInsights(workspace, recommendation, now);
  const sizes = [...new Set([...EXAM_SIZES.filter(size => size < insights.bankSize), Math.min(EXAM_MAX_QUESTIONS, insights.bankSize)])].filter(size => size > 0);
  const [sizeChoice, setSizeChoice] = useState<number>(EXAM_MAX_QUESTIONS);
  const [minutesChoice, setMinutesChoice] = useState<number | null>(null);
  const size = Math.min(sizeChoice, insights.bankSize);
  // About two minutes per task, as in many written multiple-choice exams.
  const suggestedMinutes = EXAM_TIME_LIMITS.find(minutes => minutes >= size * 2) ?? EXAM_TIME_LIMITS.at(-1)!;
  const minutes = minutesChoice ?? suggestedMinutes;
  const active = insights.active;
  const plan = insights.subject && !active ? planExamSimulation(workspace, insights.collectionId, insights.subject, size, now) : null;
  const number = insights.history.length + 1;
  const minutesLeft = active?.deadlineAt ? Math.ceil((Date.parse(active.deadlineAt) - now) / 60000) : null;
  const chronological = [...insights.history].reverse();

  if (!insights.subject || !insights.bankSize) return <div className="tutor-exam">
    <article className="tutor-guided-step tutor-exam-step">
      <div className="tutor-guided-intro"><span className="eyebrow">PRÜFUNGSSIMULATION</span><h3>Noch keine Testaufgaben im Lernfokus</h3><p>Eine Simulation stellt Aufgaben aus allen Lernbereichen eines Fachthemas zusammen. Wähle unter „Lernplan und Fokus“ eine Lernsammlung mit Testaufgaben.</p></div>
    </article>
  </div>;

  return <div className="tutor-exam">
    <article className="tutor-guided-step tutor-exam-step">
      <div className="tutor-guided-intro">
        <span className="eyebrow">{active ? "SIMULATION LÄUFT" : `PRÜFUNGSSIMULATION ${number}`}</span>
        <h3>{active ? "Deine Prüfungssimulation fortsetzen" : `${tasks(plan?.size ?? size)} unter Prüfungsbedingungen`}</h3>
        <p>{active
          ? `${active.answered} von ${active.total} Aufgaben sind beantwortet und gespeichert.${minutesLeft === null ? "" : minutesLeft > 0 ? ` Das Zeitlimit läuft weiter: noch etwa ${minutesLeft} Min.` : " Das Zeitlimit ist abgelaufen; beim Öffnen wird die Simulation ausgewertet."}`
          : insights.history.length
            ? `Diese Simulation baut auf deinen bisherigen ${insights.history.length === 1 ? "Ergebnissen" : `${insights.history.length} Simulationen`} auf: Falsch beantwortete Aufgaben kommen wieder, Aufgaben, die du noch nicht hattest, kommen dazu, und Bereiche mit Fehlern bekommen mehr Aufgaben. Lösungen siehst du erst nach der Abgabe.`
            : `Gemischte Aufgaben aus allen ${insights.areaCount} Lernbereichen von „${insights.subject}“. Lösungen und Erklärungen siehst du erst nach der Abgabe. Jede weitere Simulation passt sich an deine Ergebnisse an.`}</p>
      </div>
      {plan && <>
        <div className="tutor-exam-settings">
          <label className="field"><span>Aufgaben</span><select aria-label="Aufgaben in der Simulation" value={plan.size} disabled={saving} onChange={event => setSizeChoice(Number(event.target.value))}>{sizes.map(option => <option key={option} value={option}>{tasks(option)}</option>)}</select></label>
          <label className="field"><span>Zeitlimit</span><select aria-label="Zeitlimit der Simulation" value={minutes} disabled={saving} onChange={event => setMinutesChoice(Number(event.target.value))}>{EXAM_TIME_LIMITS.map(option => <option key={option} value={option}>{option ? `${option} Minuten` : "Ohne Zeitlimit"}</option>)}</select></label>
        </div>
        <ul className="tutor-exam-mix" aria-label="Zusammensetzung der Simulation">
          <li className="is-repeat"><strong>{plan.composition.repeat}</strong><span>frühere Fehler</span></li>
          <li className="is-new"><strong>{plan.composition.new}</strong><span>noch nicht bearbeitet</span></li>
          <li className="is-refresh"><strong>{plan.composition.refresh}</strong><span>zuletzt richtig</span></li>
        </ul>
      </>}
      {active
        ? <Button className="tutor-primary-action" disabled={saving} onClick={() => onAction({ kind: "resume-quiz", collectionId: active.collectionId, runId: active.runId })}><Play size={17} aria-hidden="true" />Simulation fortsetzen<ArrowRight size={16} aria-hidden="true" /></Button>
        : <Button className="tutor-primary-action" disabled={saving || insights.blocked || !plan || workspace.quizRuns.length >= 200} onClick={() => plan && onAction({ kind: "exam-simulation", collectionId: insights.collectionId, subject: insights.subject!, questionCount: plan.size, minutes })}><Play size={17} aria-hidden="true" />Simulation starten<ArrowRight size={16} aria-hidden="true" /></Button>}
      {insights.blocked && <p className="tutor-evidence-note">Du hast noch eine laufende Einheit. Schließe sie unter „Kurze Einheiten“ ab, bevor du eine Simulation startest.</p>}
      {workspace.quizRuns.length >= 200 && <p className="tutor-evidence-note">Die Grenze von 200 gespeicherten Runden ist erreicht.</p>}
    </article>

    <div className="tutor-guided-progress">
      <div><strong>{insights.coverage.answered} von {insights.coverage.total} Aufgaben in „{insights.subject}“ bearbeitet</strong><span>{insights.coverage.areasCovered} von {insights.coverage.areasTotal} Lernbereichen aufgegriffen · {insights.history.length ? `${insights.history.length} ${insights.history.length === 1 ? "Simulation" : "Simulationen"} abgeschlossen` : "noch keine Simulation abgeschlossen"}</span></div>
      <Progress value={insights.coverage.total ? insights.coverage.answered / insights.coverage.total * 100 : 0} aria-label={`${insights.coverage.answered} von ${insights.coverage.total} Aufgaben bearbeitet`} />
    </div>

    {plan && <Collapsible className="tutor-details">
      <CollapsibleTrigger asChild><button type="button" className="tutor-details-trigger"><span><strong>Schwerpunkte dieser Simulation</strong><span>{plan.areas.length} Lernbereiche · mehr Aufgaben, wo noch Fehler oder offene Aufgaben sind</span></span><ChevronDown size={19} aria-hidden="true" /></button></CollapsibleTrigger>
      <CollapsibleContent forceMount className="tutor-details-content">
        <ul className="tutor-exam-areas">{plan.areas.map(area => <li key={area.concept}>
          <div><strong>{area.concept}</strong><span>{[area.repeat && `${area.repeat} frühere ${area.repeat === 1 ? "Fehleraufgabe" : "Fehleraufgaben"}`, area.new && `${area.new} neu`, area.refresh && `${area.refresh} zur Wiederholung`].filter(Boolean).join(" · ")}</span></div>
          <span className="tutor-exam-area-count">{tasks(area.count)}</span>
        </li>)}</ul>
        <p className="tutor-evidence-note">Jeder Lernbereich kommt mindestens einmal vor. Größere Bereiche und Bereiche mit falschen Antworten bekommen mehr Aufgaben; Bereiche, in denen zuletzt alles richtig war, treten zurück.</p>
      </CollapsibleContent>
    </Collapsible>}

    {chronological.length > 0 && <section className="tutor-exam-history" aria-label="Bisherige Simulationen">
      <h3>Bisherige Simulationen</h3>
      <ExamHistoryBars history={chronological} onOpen={runId => onViewResult(runId, insights.collectionId)} disabled={saving || !!active} />
    </section>}
  </div>;
}
