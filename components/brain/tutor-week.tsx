"use client";

import { useState } from "react";
import { ArrowRight, BookOpen, ClipboardCheck, Layers3, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QuizRun, Workspace } from "@/lib/brain/model";
import type { SaveWorkspace } from "@/lib/brain/use-brain";
import { recommendLearning, type LearningAction, type LearningRecommendation } from "@/lib/brain/learning-resume";
import { createTutorWeek, tutorWeekInsights, weekDate } from "@/lib/brain/tutor-week";
import { isCorrect } from "@/lib/brain/quiz";

const dateLabel = (date: string) => new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", timeZone: "Europe/Berlin" }).format(new Date(date + "T12:00:00Z"));
const percent = (run: QuizRun) => Math.round(100 * run.questions.filter(question => isCorrect(question, run.answers.find(answer => answer.questionId === question.id)?.selectedOptionIds ?? [])).length / run.questions.length);

export function TutorWeek({ workspace, recommendation, save, saving, now, onAction, onOpenNote, onViewResult }: {
  workspace: Workspace; recommendation: LearningRecommendation; save: SaveWorkspace; saving: boolean; now: number;
  onAction: (action: LearningAction) => void; onOpenNote: (id: string) => void; onViewResult: (id: string, collectionId: string | null) => void;
}) {
  const week = tutorWeekInsights(workspace, recommendation, now);
  const [selection, setSelection] = useState<{ startedOn: string; day: number } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const resumable = recommendation.primaryAction?.kind === "resume-cards" || recommendation.primaryAction?.kind === "resume-quiz";
  const busy = saving || pending || resumable;
  const canStart = !!createTutorWeek(workspace, recommendation, now);
  async function start() {
    if (busy) return;
    setPending(true); setError("");
    try {
      const saved = await save(current => {
        const currentRecommendation = recommendLearning(current, now);
        if (currentRecommendation.collectionId !== recommendation.collectionId || currentRecommendation.subject !== recommendation.subject || current.quizRuns.some(run => !run.finishedAt) || current.flashcardSession) throw new Error("Setze zuerst deine offene Einheit fort und prüfe den aktuellen Lernfokus.");
        const plan = createTutorWeek(current, currentRecommendation, now);
        if (!plan) throw new Error("Für diesen Lernfokus fehlen passende Testaufgaben.");
        return { ...current, tutorWeek: plan, tutorPlan: current.tutorPlan ?? {
          goal: `${plan.subject} sicher erklären und anwenden`, targetDate: weekDate(plan.startedOn, 6), weeklyDays: 7, updatedAt: new Date(now).toISOString(),
        } };
      }, "Lernwoche gespeichert");
      if (!saved) setError("Die Lernwoche konnte nicht gespeichert werden. Bitte versuche es erneut.");
      else setSelection(null);
    } finally { setPending(false); }
  }
  if (!week) return <article className="tutor-panel tutor-week-invite" aria-label="Lernwoche planen">
    <div className="tutor-panel-heading"><Target size={22} /><div><span className="eyebrow">IN EINER WOCHE SICHERER WERDEN</span><h3>Drei Themen am Tag. Kleine Einheiten.</h3><p>Dein Plan für {recommendation.subject ?? "deinen Lernfokus"}: jeweils 20–30 Minuten, über den Tag verteilt.</p></div></div>
    <ol className="tutor-session-route" aria-label="Ablauf einer Lerneinheit"><li><BookOpen size={18} /><strong>Verstehen</strong><span>Erklärung & Grafik · 5–8 Min.</span></li><li><Layers3 size={18} /><strong>Selbst erklären</strong><span>Bis zu 5 Karten · 5–8 Min.</span></li><li><ClipboardCheck size={18} /><strong>Anwenden</strong><span>Aufgaben & Fehler klären · 10–14 Min.</span></li></ol>
    <p>Ein Einstiegstest zeigt deinen Ausgangspunkt. An Tag 4 folgt ein Zwischencheck, an Tag 7 der Abschlusstest. Kartenbewertungen und geprüfte Antworten bleiben getrennt.</p>
    <Button disabled={busy || !canStart} onClick={() => void start()}>{pending ? "Wird gespeichert …" : "7-Tage-Plan starten"}<ArrowRight size={16} /></Button>
    {!canStart && <p>Wähle eine Lernsammlung mit Testaufgaben, um deine Lernwoche zu planen.</p>}
    {error && <p role="alert" className="tutor-form-status is-error">{error}</p>}
  </article>;

  const dayNumber = selection?.startedOn === week.week.startedOn ? selection.day : week.currentDay;
  const day = week.days[dayNumber - 1];
  const secure = week.areas.filter(area => area.secure).length;
  return <section className="tutor-intensive-week" aria-label="Dein 7-Tage-Plan">
    <div className="tutor-week-heading"><div><span className="eyebrow">DEINE VORBEREITUNG IN 7 TAGEN</span><h3>{week.week.subject} sicher erklären und anwenden</h3><p>{dateLabel(week.week.startedOn)} – {dateLabel(weekDate(week.week.startedOn, 6))} · 3 Themen täglich · je 20–30 Minuten</p></div><span className="tutor-week-evidence">{secure}/{week.areas.length} Bereiche zuletzt vollständig richtig</span></div>
    <ol className="tutor-session-route" aria-label="Ablauf einer Lerneinheit"><li><BookOpen size={18} /><strong>Verstehen</strong><span>5–8 Minuten</span></li><li><Layers3 size={18} /><strong>Selbst erklären</strong><span>5–8 Minuten</span></li><li><ClipboardCheck size={18} /><strong>Anwenden</strong><span>10–14 Minuten</span></li></ol>
    <div className="tutor-week-days" role="group" aria-label="Tag im Lernplan auswählen">{week.days.map(item => <Button key={item.number} variant="ghost" aria-pressed={day.number === item.number} onClick={() => setSelection({ startedOn: week.week.startedOn, day: item.number })}><strong>Tag {item.number}</strong><span>{dateLabel(item.date)}</span></Button>)}</div>
    <div className="tutor-week-day-heading"><h4>Tag {day.number}: {day.title}</h4><p>Verteile die Einheiten über den Tag. Zwischen den Themen machst du eine Pause.</p></div>
    <div className="tutor-week-topics">{day.areas.map((area, index) => <article key={area.concept} className="tutor-week-topic">
      <span className="eyebrow">EINHEIT {index + 1} · 20–30 MINUTEN{day.reviewConcepts.includes(area.concept) ? " · WIEDERHOLUNG" : ""}</span><h4>{area.concept}</h4>
      <p>{area.answered}/{area.total} Aufgaben beantwortet · {area.correct} zuletzt richtig</p>
      <div className="tutor-week-topic-actions">{area.noteIds[0] && <Button variant="ghost" onClick={() => onOpenNote(area.noteIds[0])}><BookOpen size={16} />Erklärung ansehen</Button>}{area.cardsAction && <Button variant="outline" disabled={busy} onClick={() => onAction(area.cardsAction!)}><Layers3 size={16} />{area.cardsAction.kind === "review-cards" ? area.cardsAction.cardIds?.length : 0} Karten einzeln üben</Button>}<Button disabled={busy} onClick={() => onAction(area.practiceAction)}><ClipboardCheck size={16} />Wissen anwenden<ArrowRight size={15} /></Button></div>
    </article>)}</div>
    {!day.areas.length && <p>Für diesen Tag sind keine weiteren Themen vorhanden. Wiederhole einen Bereich in „Vorbereitung“ oder prüfe deinen Lernstand.</p>}
    {week.extraAreas > 0 && <p>{week.extraAreas} weitere Bereiche passen nicht in die 18 Themenplätze dieser Woche. Plane dafür zusätzliche Zeit ein; du findest sie unter „Vorbereitung“.</p>}
    <div className="tutor-week-tests" aria-label="Tests deiner Lernwoche">{week.checkpoints.map(checkpoint => <article key={checkpoint.stage} className={checkpoint.day === day.number ? "is-current" : ""}><span className="eyebrow">TAG {checkpoint.day}</span><h4>{checkpoint.title}</h4><p>{checkpoint.result ? `${percent(checkpoint.result)} % richtig · ${checkpoint.result.questions.length} Aufgaben` : checkpoint.stage === "final" ? "Dieselben Aufgaben wie im Einstiegstest, für einen direkten Vergleich." : checkpoint.stage === "midpoint" ? "Gemischte Aufgaben zeigen, wo du weiterüben solltest." : "Sechs Aufgaben oder weniger zeigen deinen Ausgangspunkt."}</p>{checkpoint.result ? <Button variant="outline" disabled={busy} onClick={() => onViewResult(checkpoint.result!.id, week.week.collectionId)}>Ergebnis ansehen</Button> : <Button variant={checkpoint.day === day.number ? "default" : "outline"} disabled={busy || !checkpoint.action} onClick={() => checkpoint.action && onAction(checkpoint.action)}>{checkpoint.title} starten<ArrowRight size={15} /></Button>}{!checkpoint.action && !checkpoint.result && <p>Die ursprünglichen Aufgaben sind nicht mehr vollständig verfügbar. Starte bei Bedarf eine neue Lernwoche.</p>}</article>)}</div>
    {week.baseline && week.final && <p className="tutor-week-comparison" role="status">{week.comparable ? `Einstieg ${percent(week.baseline)} % → Abschluss ${percent(week.final)} % (${percent(week.final) - percent(week.baseline) > 0 ? "+" : ""}${percent(week.final) - percent(week.baseline)} Prozentpunkte).` : "Die Aufgaben wurden zwischenzeitlich verändert. Diese Ergebnisse lassen sich nicht direkt vergleichen."} Die Tests prüfen eine Stichprobe; den Stand aller Bereiche siehst du bei deinen Themen.</p>}
    <p className="tutor-evidence-note">Die Zeitangaben sind Orientierung. Ein Thema gilt hier erst als zuletzt richtig, wenn du alle aktuellen Aufgaben richtig beantwortet hast. Kartenbewertungen sind deine Selbsteinschätzung; weitere Anwendung und spätere Wiederholung festigen das Wissen.</p>
    {week.ended && <Button variant="outline" disabled={busy} onClick={() => void start()}>Neue Lernwoche beginnen<ArrowRight size={16} /></Button>}
    {error && <p role="alert" className="tutor-form-status is-error">{error}</p>}
  </section>;
}
