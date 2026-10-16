"use client";

import { useId } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { examStatusLabels, type ExamHistoryEntry, type ExamReport } from "@/lib/brain/exam-simulation";

const shortDate = (date: string) => new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", timeZone: "Europe/Berlin" }).format(new Date(date));
const share = (correct: number, total: number) => total ? Math.round(correct / total * 100) : 0;
const areaState = (correct: number, total: number) => correct === total ? "is-secure" : correct / total >= 0.5 ? "is-partial" : "is-weak";
const statusResult = { repeat: "jetzt richtig", new: "richtig", refresh: "weiterhin richtig" } as const;

export function ExamHistoryBars({ history, currentRunId, onOpen, disabled }: { history: ExamHistoryEntry[]; currentRunId?: string; onOpen?: (runId: string) => void; disabled?: boolean }) {
  return <ol className={`exam-history-bars${onOpen ? " has-actions" : ""}`} aria-label="Ergebnisse deiner Prüfungssimulationen">
    {history.map(entry => <li key={entry.runId} className={entry.runId === currentRunId ? "is-current" : undefined}>
      <span className="exam-history-label">Simulation {entry.number}<small>{shortDate(entry.finishedAt)}</small></span>
      <span className="exam-bar" aria-hidden="true"><span style={{ width: `${entry.percent}%` }} /></span>
      <span className="exam-history-value"><strong>{entry.percent} %</strong><small>{entry.correct} von {entry.total}</small></span>
      {onOpen && <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onOpen(entry.runId)} aria-label={`Simulation ${entry.number} vom ${shortDate(entry.finishedAt)}: Auswertung ansehen`}>Auswertung</Button>}
    </li>)}
  </ol>;
}

export function ExamSimulationReport({ report, onOpenNote }: { report: ExamReport; onOpenNote?: (id: string) => void }) {
  const headingId = useId();
  const change = report.previous ? report.percent - report.previous.percent : null;
  return <section className="quiz-panel exam-report" aria-labelledby={headingId}>
    <div className="exam-report-heading">
      <span className="eyebrow">PRÜFUNGSSIMULATION {report.number}</span>
      <h2 id={headingId}>Auswertung nach Lernbereichen</h2>
      <p>{report.previous ? <>Vorige Simulation: {report.previous.percent} %, jetzt {report.percent} % ({change! > 0 ? `+${change}` : change} Prozentpunkte). </> : "Deine erste Simulation in diesem Fachthema ist der Ausgangspunkt. "}Die schwächsten Bereiche stehen oben und bekommen in der nächsten Simulation mehr Aufgaben.</p>
    </div>
    <ul className="exam-area-list">
      {report.areas.map(area => <li key={area.concept} className={areaState(area.correct, area.total)}>
        <div className="exam-area-label"><strong>{area.concept}</strong><span>{area.correct} von {area.total} richtig</span></div>
        <span className="exam-bar" aria-hidden="true"><span style={{ width: `${share(area.correct, area.total)}%` }} /></span>
        {onOpenNote && area.noteIds[0] && area.correct < area.total ? <Button variant="ghost" size="sm" onClick={() => onOpenNote(area.noteIds[0])} aria-label={`${area.concept}: Grundlagen nachlesen`}><BookOpen size={15} aria-hidden="true" />Nachlesen</Button> : <span />}
      </li>)}
    </ul>
    <div className="exam-report-grid">
      <section aria-label="Ergebnis nach Schwierigkeit">
        <h3>Nach Schwierigkeit</h3>
        <dl className="exam-report-stats">{report.difficulty.map(level => <div key={level.level}><dt>{level.label}</dt><dd>{level.correct} von {level.total} richtig</dd></div>)}</dl>
      </section>
      <section aria-label="Ergebnis nach bisherigem Lernstand">
        <h3>Gegenüber deinem bisherigen Stand</h3>
        <dl className="exam-report-stats">{report.composition.map(item => <div key={item.status}><dt>{examStatusLabels[item.status]}</dt><dd>{item.correct} von {item.total} {statusResult[item.status]}</dd></div>)}</dl>
      </section>
    </div>
    {report.history.length > 1 && <section className="exam-report-history" aria-label="Verlauf deiner Simulationen">
      <h3>Deine Simulationen</h3>
      <ExamHistoryBars history={report.history} currentRunId={report.history.at(-1)?.runId} />
      <p className="exam-report-note">Jede Simulation enthält andere Aufgaben. Der Verlauf zeigt eine Richtung, keinen exakten Vergleich.</p>
    </section>}
    <p className="exam-report-note">Bearbeitet in diesem Fachthema: {report.coverage.answered} von {report.coverage.total} Aufgaben · {report.coverage.areasCovered} von {report.coverage.areasTotal} Lernbereichen.{report.unanswered > 0 ? ` ${report.unanswered === 1 ? "Eine Aufgabe blieb" : `${report.unanswered} Aufgaben blieben`} offen und ${report.unanswered === 1 ? "zählt" : "zählen"} als nicht bearbeitet.` : ""}</p>
  </section>;
}
