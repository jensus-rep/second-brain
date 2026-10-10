"use client";

import { useId, useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, CalendarDays, Check, ClipboardCheck, Layers3, Play, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { tutorPlanSchema, type TutorPlan, type Workspace } from "@/lib/brain/model";
import type { SaveWorkspace } from "@/lib/brain/use-brain";
import { collectionItems, learningCollections } from "@/lib/brain/learning-collections";
import { recommendLearning, type LearningAction } from "@/lib/brain/learning-resume";
import { tutorDate, tutorInsights, type TutorQuizResult } from "@/lib/brain/learning-tutor";
import { ARCHIVED_TEXT } from "@/lib/brain/quiz";

type Props = {
  workspace: Workspace;
  save: SaveWorkspace;
  saving: boolean;
  now: number;
  onAction: (action: LearningAction) => void;
  onOpenNote: (id: string) => void;
  onOpenCollection: (id: string) => void;
  onOpenCollections?: () => void;
  onViewResult: (id: string, collectionId: string | null) => void;
};

const actionLabels: Record<LearningAction["kind"], string> = {
  "resume-quiz": "Einheit fortsetzen",
  "resume-cards": "Lernkarten fortsetzen",
  "review-concept": "Schwachstelle üben",
  "review-cards": "Fällige Karten wiederholen",
  preparation: "Nächste Einheit starten",
  checkpoint: "Kurztest starten",
  "open-collection": "Lernsammlung öffnen",
};
const dateLabel = (date: string) => new Intl.DateTimeFormat("de-DE", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin",
}).format(new Date(date));
const shortDate = (date: string) => new Intl.DateTimeFormat("de-DE", {
  day: "numeric", month: "numeric", timeZone: "Europe/Berlin",
}).format(new Date(date));
const calendarDate = (date: string) => new Date(`${date}T12:00:00Z`);

function resultChange(result: TutorQuizResult) {
  return result.change === null ? "Noch keine frühere Runde mit identischen Aufgaben."
    : result.change > 0 ? `+${result.change} Prozentpunkte zur vorigen vergleichbaren Runde.`
    : result.change < 0 ? `${result.change} Prozentpunkte zur vorigen vergleichbaren Runde.`
    : "Ergebnis der vorigen vergleichbaren Runde gehalten.";
}

function LearningCurve({ results }: { results: TutorQuizResult[] }) {
  const chartId = useId();
  const points = results.slice(0, 12).reverse();
  const indexById = new Map(points.map((point, index) => [point.runId, index]));
  const chart = (compact: boolean) => {
    const width = compact ? 320 : 640, height = compact ? 250 : 228, left = 46, right = 24, top = 30, bottom = 42;
    const x = (index: number) => points.length === 1 ? (left + width - right) / 2 : left + index * (width - left - right) / (points.length - 1);
    const y = (percent: number) => top + (100 - percent) / 100 * (height - top - bottom);
    const id = `${chartId}-${compact ? "mobile" : "desktop"}`;
    return <svg className={compact ? "tutor-chart-mobile" : "tutor-chart-desktop"} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>Lernkurve der letzten {points.length} abgeschlossenen Einheiten</title>
      <desc id={`${id}-description`}>Jeder Punkt zeigt den Anteil richtiger Antworten einer Einheit. Linien verbinden nur Runden mit identischen Aufgaben und Bewertungsregeln. Die einzelnen Ergebnisse stehen auch in der Liste darunter.</desc>
      {[0, 50, 100].map(percent => <g key={percent}><line x1={left} x2={width - right} y1={y(percent)} y2={y(percent)} className="tutor-chart-grid" /><text x={left - 8} y={y(percent) + 4} textAnchor="end">{percent} %</text></g>)}
      {points.map((point, index) => {
        const previousIndex = point.previousRunId ? indexById.get(point.previousRunId) : undefined;
        return previousIndex !== undefined ? <line key={`${point.runId}-line`} x1={x(previousIndex)} y1={y(points[previousIndex].percent)} x2={x(index)} y2={y(point.percent)} className="tutor-chart-line" /> : null;
      })}
      {points.map((point, index) => <g key={point.runId}><circle cx={x(index)} cy={y(point.percent)} r={5} className="tutor-chart-point"><title>{dateLabel(point.finishedAt)}: {point.correct} von {point.total} richtig, {point.percent} Prozent. {resultChange(point)}</title></circle>{(points.length <= 4 || index === 0 || index === points.length - 1 || !compact && index % 2 === 0) && <text x={x(index)} y={y(point.percent) - (compact ? 14 : 12)} textAnchor="middle" className="tutor-chart-value">{point.percent}</text>}</g>)}
      <text x={left} y={height - 12} textAnchor="start">{points[0] && shortDate(points[0].finishedAt)}</text>
      {points.length > 1 && <text x={width - right} y={height - 12} textAnchor="end">{shortDate(points[points.length - 1].finishedAt)}</text>}
    </svg>;
  };
  return <figure className="tutor-learning-curve">
    {chart(false)}{chart(true)}
    <figcaption>Punkte zeigen einzelne Ergebnisse. Linien verbinden vergleichbare Runden mit identischen Aufgaben. Unterschiedliche Aufgaben können unterschiedlich schwer sein.</figcaption>
  </figure>;
}

function TutorPlanForm({ plan, save, saving }: { plan: TutorPlan | null | undefined; save: SaveWorkspace; saving: boolean }) {
  const [goal, setGoal] = useState(plan?.goal ?? "");
  const [targetDate, setTargetDate] = useState(plan?.targetDate ?? "");
  const [weeklyDays, setWeeklyDays] = useState(String(plan?.weeklyDays ?? 3));
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const planKey = JSON.stringify(plan ?? null);
  const [observedPlanKey, setObservedPlanKey] = useState(planKey);
  const [dirty, setDirty] = useState(false);
  const [remoteChanged, setRemoteChanged] = useState(false);
  const [submittedPlanKey, setSubmittedPlanKey] = useState<string | null>(null);
  if (planKey !== observedPlanKey) {
    setObservedPlanKey(planKey);
    const ownSave = planKey === submittedPlanKey;
    if (!dirty || ownSave) {
      setGoal(plan?.goal ?? "");
      setTargetDate(plan?.targetDate ?? "");
      setWeeklyDays(String(plan?.weeklyDays ?? 3));
      setDirty(false);
      setRemoteChanged(false);
      if (!ownSave) setStatus(null);
    } else if (goal === (plan?.goal ?? "") && targetDate === (plan?.targetDate ?? "") && weeklyDays === String(plan?.weeklyDays ?? 3)) {
      setDirty(false);
      setRemoteChanged(false);
    } else setRemoteChanged(true);
    if (ownSave) setSubmittedPlanKey(null);
  }
  const busy = saving || submitting;
  function edited() { setStatus(null); setDirty(true); }
  function adoptSavedPlan() {
    setGoal(plan?.goal ?? "");
    setTargetDate(plan?.targetDate ?? "");
    setWeeklyDays(String(plan?.weeklyDays ?? 3));
    setDirty(false);
    setRemoteChanged(false);
    setStatus(null);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = tutorPlanSchema.safeParse({ goal, targetDate: targetDate || null, weeklyDays: Number(weeklyDays), updatedAt: new Date().toISOString() });
    if (!parsed.success) {
      setStatus({ kind: "error", message: parsed.error.issues[0]?.message ?? "Bitte prüfe deinen Lernplan." });
      return;
    }
    setSubmitting(true);
    setSubmittedPlanKey(JSON.stringify(parsed.data));
    setStatus(null);
    try {
      const saved = await save(current => ({ ...current, tutorPlan: parsed.data }), "Lernplan gespeichert");
      if (saved) { setDirty(false); setRemoteChanged(false); }
      else setSubmittedPlanKey(null);
      setStatus(saved ? { kind: "success", message: "Lernplan gespeichert." } : { kind: "error", message: "Der Lernplan konnte nicht gespeichert werden. Deine Eingaben bleiben erhalten. Prüfe die Meldung und versuche es erneut." });
    } catch {
      setSubmittedPlanKey(null);
      setStatus({ kind: "error", message: "Der Lernplan konnte nicht gespeichert werden. Deine Eingaben bleiben erhalten." });
    } finally { setSubmitting(false); }
  }
  return <form className="tutor-plan-form" onSubmit={event => void submit(event)}>
    {remoteChanged && <div className="tutor-plan-remote-change" role="status"><p>Der gespeicherte Lernplan wurde zwischenzeitlich geändert. Deine eigenen Eingaben bleiben erhalten. Übernimm den aktuellen Plan oder speichere deine Eingaben bewusst als neuen Stand.</p><Button type="button" variant="outline" disabled={busy} onClick={adoptSavedPlan}>Aktuellen Lernplan übernehmen</Button></div>}
    <label className="field"><span>Dein Lernziel</span><Textarea aria-label="Dein Lernziel" maxLength={300} value={goal} disabled={busy} onChange={event => { setGoal(event.target.value); edited(); }} placeholder="Zum Beispiel: Zusammenhänge sicher erklären und in Aufgaben anwenden." rows={3} /><small>{goal.length}/300 Zeichen</small></label>
    <div className="tutor-plan-fields">
      <label className="field"><span>Zieldatum (optional)</span><Input type="date" value={targetDate} disabled={busy} onChange={event => { setTargetDate(event.target.value); edited(); }} /></label>
      <label className="field"><span>Lerntage pro Woche</span><select aria-label="Lerntage pro Woche" value={weeklyDays} disabled={busy} onChange={event => { setWeeklyDays(event.target.value); edited(); }}>{[1, 2, 3, 4, 5, 6, 7].map(days => <option key={days} value={days}>{days} {days === 1 ? "Tag" : "Tage"}</option>)}</select></label>
    </div>
    <div className="tutor-plan-save"><Button type="submit" variant="outline" disabled={busy}>{submitting ? "Wird gespeichert …" : "Lernplan speichern"}</Button>{status && <p className={`tutor-form-status is-${status.kind}`} role={status.kind === "error" ? "alert" : "status"}>{status.message}</p>}</div>
  </form>;
}

export function LearningTutor({ workspace, save, saving, now, onAction, onOpenNote, onOpenCollection, onOpenCollections, onViewResult }: Props) {
  const recommendation = recommendLearning(workspace, now);
  const insights = tutorInsights(workspace, recommendation, now);
  const { primaryAction, cards, areas, weaknesses } = recommendation;
  const primaryLabel = primaryAction?.kind === "review-cards" && primaryAction.mode === "all" ? "Alle Karten üben" : primaryAction ? actionLabels[primaryAction.kind] : "Dein erster Lernschritt";
  const collections = learningCollections(workspace);
  const selectedCollection = collections.find(collection => collection.id === recommendation.collectionId);
  const resumable = primaryAction?.kind === "resume-quiz" || primaryAction?.kind === "resume-cards";
  const collectionValue = recommendation.collectionId && selectedCollection ? recommendation.collectionId : resumable && !selectedCollection ? "::saved" : "::all";
  const scopedQuestions = selectedCollection ? collectionItems(workspace, selectedCollection).questions : workspace.quizQuestions;
  const checkpointCount = scopedQuestions.filter(question => question.subject === recommendation.subject).length;
  const checkpointAction: LearningAction | null = recommendation.subject && checkpointCount ? { kind: "checkpoint", collectionId: recommendation.collectionId, subject: recommendation.subject, questionCount: Math.min(6, checkpointCount) } : null;
  const [focusError, setFocusError] = useState("");
  const [activeTab, setActiveTab] = useState("today");
  async function changeFocus(collectionId: string | null, subject: string | null) {
    setFocusError("");
    const saved = await save(current => ({ ...current, learningFocus: { collectionId, subject, updatedAt: new Date().toISOString() } }), "Lernfokus gespeichert");
    if (!saved) setFocusError("Der Lernfokus konnte nicht gespeichert werden. Der bisherige Fokus bleibt aktiv.");
  }
  const actionDescription = !primaryAction ? "Wähle eine Lernsammlung mit Testaufgaben oder Lernkarten. Sobald Inhalte vorhanden sind, findest du hier deinen ersten Schritt."
    : primaryAction.kind === "resume-quiz" ? "Deine Antworten sind gespeichert. Setze die offene Einheit an der letzten Stelle fort."
    : primaryAction.kind === "resume-cards" ? `Deine Kartenrunde wartet auf dich. Noch ${primaryAction.remaining} ${primaryAction.remaining === 1 ? "Karte" : "Karten"}, dann ist diese Einheit abgeschlossen.`
    : primaryAction.kind === "review-concept" ? `Bei „${primaryAction.concept}“ sind noch Antworten falsch. Greife die Erklärung auf und übe die offenen Aufgaben erneut.`
    : primaryAction.kind === "review-cards" ? primaryAction.mode === "all" ? "Aktuell sind keine Karten fällig. Übe deine Karten und schätze ein, was du schon abrufen kannst." : `${cards.due} ${cards.due === 1 ? "Karte ist" : "Karten sind"} fällig. Eine kurze Wiederholung hält das Gelernte präsent.`
    : primaryAction.kind === "preparation" ? areas.some(area => area.subject === primaryAction.subject && area.concept === primaryAction.concept && area.completed)
      ? `Festige „${primaryAction.concept}“ mit weiteren Aufgaben. Eine bearbeitete Einheit bedeutet noch nicht, dass alle Aufgaben richtig beantwortet sind.`
      : `Beginne mit „${primaryAction.concept}“. Eine kurze Einheit bringt dich gezielt in deine Vorbereitung.`
    : primaryAction.kind === "checkpoint" ? `Prüfe deinen Lernstand mit bis zu ${primaryAction.questionCount} gemischten Aufgaben. Die Auswertung erscheint nach der Abgabe.`
    : "Öffne deine Sammlung und orientiere dich an den verknüpften Notizen und Lernpfaden.";
  const latestResult = insights.history[0];
  const scopedResultIds = new Set(insights.history.map(result => result.runId));
  const hasArchivedWording = workspace.quizRuns.some(run => scopedResultIds.has(run.id) && run.questions.some(question => question.prompt === ARCHIVED_TEXT));
  const today = tutorDate(now);

  return <section className="learning-tutor" aria-label="Dein Tutor">
    <div className="tutor-focus-header">
      <div className="tutor-focus-title"><span className="tutor-icon"><Target size={22} aria-hidden="true" /></span><div><span className="eyebrow">DEIN LERNFOKUS</span><h2>{recommendation.title}</h2><p>Einsteigen, gezielt üben und aus deinen Ergebnissen lernen.</p></div></div>
      {selectedCollection && <Button variant="ghost" onClick={() => onOpenCollection(selectedCollection.id)}>Sammlung ansehen<ArrowRight size={15} /></Button>}
    </div>
    <div className="tutor-focus-controls">
      <label className="field"><span>Lernsammlung</span><select aria-label="Lernfokus auswählen" disabled={saving || resumable} value={collectionValue} onChange={event => {
        const chosen = collections.find(collection => collection.id === event.target.value);
        const questions = chosen ? collectionItems(workspace, chosen).questions : workspace.quizQuestions;
        void changeFocus(chosen?.id ?? null, questions[0]?.subject ?? null);
      }}><option value="::all">Gesamter Lernbestand</option>{collectionValue === "::saved" && <option value="::saved">Gespeicherte Lerneinheit</option>}{collections.map(collection => <option key={collection.id} value={collection.id}>{collection.title}</option>)}</select></label>
      {recommendation.subjects.length > 1 && <label className="field"><span>Fachthema</span><select aria-label="Fachthema im Lernfokus" disabled={saving || resumable} value={recommendation.subject ?? recommendation.subjects[0]} onChange={event => void changeFocus(recommendation.collectionId, event.target.value)}>{recommendation.subjects.map(subject => <option key={subject}>{subject}</option>)}</select></label>}
    </div>
    {resumable && <p className="tutor-context-hint">Setze deine offene Einheit fort, bevor du den Lernfokus wechselst oder eine neue Runde startest.</p>}
    {focusError && <p className="tutor-form-status is-error" role="alert">{focusError}</p>}
    <Tabs value={activeTab} onValueChange={setActiveTab} className="tutor-tabs">
      <TabsList aria-label="Tutor-Bereiche"><TabsTrigger value="today">Heute</TabsTrigger><TabsTrigger value="preparation">Vorbereitung</TabsTrigger><TabsTrigger value="results">Auswertung</TabsTrigger></TabsList>
      <TabsContent value="today" forceMount hidden={activeTab !== "today"} className="tutor-tab-content">
        <div className="tutor-next-step"><div><span className="eyebrow">{resumable ? "HIER GEHT ES WEITER" : "DEIN NÄCHSTER SCHRITT"}</span><h3>{primaryLabel}</h3><p>{actionDescription}</p>{primaryAction ? <Button className="tutor-primary-action" disabled={saving} onClick={() => onAction(primaryAction)}><Play size={17} />{primaryLabel}<ArrowRight size={16} /></Button> : onOpenCollections && <Button className="tutor-primary-action" onClick={onOpenCollections}><BookOpen size={17} />Lernsammlung anlegen<ArrowRight size={16} /></Button>}</div><div className="tutor-next-visual" aria-hidden="true"><span className="tutor-visual-orbit"><Target size={42} /></span><span>Ein Schritt nach dem anderen.</span></div></div>
        {selectedCollection && <Button className="tutor-mobile-collection" variant="ghost" onClick={() => onOpenCollection(selectedCollection.id)}>Sammlung ansehen<ArrowRight size={15} /></Button>}
        {(checkpointAction || cards.total > 0) && <div className="tutor-entry-grid" aria-label="Weitere Einstiege">
          {checkpointAction && <article className="tutor-entry-card"><ClipboardCheck size={22} aria-hidden="true" /><div><h3>Ein kurzer Lernstandcheck</h3><p>Bis zu {Math.min(6, checkpointCount)} Aufgaben aus deinem Fachthema, mit Auswertung nach der Abgabe.</p></div><Button variant="outline" disabled={saving || resumable} onClick={() => onAction(checkpointAction)}>Kurztest starten<ArrowRight size={15} /></Button></article>}
          {cards.total > 0 && <article className="tutor-entry-card"><Layers3 size={22} aria-hidden="true" /><div><h3>Wissen wieder abrufen</h3><p>{cards.due > 0 ? `${cards.due} fällige ${cards.due === 1 ? "Karte wartet" : "Karten warten"} in deinem Lernfokus.` : "Aktuell ist keine Karte fällig. Bei Bedarf kannst du alle Karten gezielt üben."}</p></div><Button variant="outline" disabled={saving || resumable} onClick={() => onAction({ kind: "review-cards", collectionId: recommendation.collectionId, mode: cards.due ? "due" : "all" })}>{cards.due ? "Fällige Karten wiederholen" : "Alle Karten üben"}<ArrowRight size={15} /></Button></article>}
        </div>}
        <div className="tutor-today-grid">
          <article className="tutor-panel tutor-continuity"><div className="tutor-panel-heading"><CalendarDays size={20} aria-hidden="true" /><div><h3>Deine Lernwoche</h3><p>Gesamter Lernbestand · Montag bis Sonntag</p></div></div><div className="tutor-week-summary"><strong>{insights.continuity.weeklyActiveDays}<span> {insights.continuity.weeklyActiveDays === 1 ? "aktiver Tag" : "aktive Tage"}</span></strong>{insights.plan && <span>Ziel: {insights.plan.weeklyDays} {insights.plan.weeklyDays === 1 ? "Tag" : "Tage"}</span>}</div>
            <ol className="tutor-week-strip" aria-label="Gespeicherte Lernaktivität dieser Woche">{insights.continuity.days.map(day => {
              const date = calendarDate(day.date);
              const label = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" }).format(date);
              const activity = day.active ? `${day.quizAnswers} beantwortete ${day.quizAnswers === 1 ? "Aufgabe" : "Aufgaben"}, ${day.cardReviews} ${day.cardReviews === 1 ? "Kartenbewertung" : "Kartenbewertungen"}` : day.isFuture ? "Liegt noch vor dir" : "Keine gespeicherte Lernaktivität";
              return <li key={day.date} className={`${day.active ? "is-active" : ""} ${day.date === today ? "is-today" : ""} ${day.isFuture ? "is-future" : ""}`} aria-label={`${label}: ${activity}`} title={`${label}: ${activity}`}><span>{new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: "Europe/Berlin" }).format(date).replace(".", "")}</span><span className="tutor-day-mark">{day.active ? <Check size={16} aria-hidden="true" /> : <span aria-hidden="true">{date.getUTCDate()}</span>}</span></li>;
            })}</ol>
            <p className="tutor-evidence-note">Ein aktiver Tag enthält gespeicherte Übungsantworten, abgegebene Tests oder Kartenbewertungen. Das Öffnen der App zählt nicht.</p><div className="tutor-streaks"><span>Aktuelle Folge<strong>{insights.continuity.currentStreak} {insights.continuity.currentStreak === 1 ? "Tag" : "Tage"}</strong></span><span>Längste gespeicherte Folge<strong>{insights.continuity.bestStreak} {insights.continuity.bestStreak === 1 ? "Tag" : "Tage"}</strong></span></div>
          </article>
          <article className="tutor-panel"><div className="tutor-panel-heading"><Target size={20} aria-hidden="true" /><div><h3>Dein Lernplan</h3><p>Ein Ziel und ein erreichbarer Rhythmus geben Orientierung.</p></div></div>
            {insights.plan && <div className="tutor-plan-progress"><div><span>Diese Woche</span><strong>{insights.plan.weeklyRemaining ? `Noch ${insights.plan.weeklyRemaining} ${insights.plan.weeklyRemaining === 1 ? "Lerntag" : "Lerntage"} bis zu deinem Ziel` : "Dein Wochenziel ist erreicht"}</strong></div><Progress value={insights.plan.weeklyPercent} aria-label={`${insights.continuity.weeklyActiveDays} von ${insights.plan.weeklyDays} geplanten Lerntagen`} />{insights.plan.daysRemaining !== null && <p>{insights.plan.daysRemaining > 0 ? `Noch ${insights.plan.daysRemaining} ${insights.plan.daysRemaining === 1 ? "Tag" : "Tage"} bis zu deinem Zieldatum.` : insights.plan.daysRemaining === 0 ? "Dein Zieldatum ist heute." : "Dein Zieldatum liegt in der Vergangenheit. Passe deinen Plan bei Bedarf an."}</p>}</div>}
            <TutorPlanForm plan={workspace.tutorPlan} save={save} saving={saving} />
          </article>
        </div>
        <article className="tutor-panel tutor-snapshot"><div><span className="eyebrow">DEIN GESPEICHERTER LERNSTAND</span><h3>{insights.coverage.covered} von {insights.coverage.total} Lernbereichen aufgegriffen</h3><p>{insights.coverage.secure} Bereiche haben für alle aktuellen Aufgaben eine zuletzt richtige Antwort. Bearbeitet und richtig beantwortet werden getrennt ausgewertet.</p><Button variant="ghost" onClick={() => setActiveTab("preparation")}>Vorbereitung ansehen<ArrowRight size={14} /></Button></div>{latestResult && <div className="tutor-latest-score"><span>Letzte Einheit</span><strong>{latestResult.percent} %</strong><span>{latestResult.correct} von {latestResult.total} richtig</span><Button variant="ghost" disabled={saving || resumable} onClick={() => onViewResult(latestResult.runId, recommendation.collectionId)}>Auswertung ansehen<ArrowRight size={14} /></Button></div>}</article>
      </TabsContent>
      <TabsContent value="preparation" className="tutor-tab-content">
        <div className="tutor-section-intro"><h3>Deine Vorbereitung, Schritt für Schritt</h3><p>Eine bearbeitete Einheit dokumentiert deinen Einsatz. Der Antwortstand zeigt separat, welche aktuellen Aufgaben du zuletzt richtig gelöst hast.</p></div>
        <dl className="tutor-coverage-stats"><div><dt>Bereiche aufgegriffen</dt><dd>{insights.coverage.covered}<small> / {insights.coverage.total}</small></dd></div><div><dt>Vorbereitungseinheiten bearbeitet</dt><dd>{recommendation.preparation.completed}<small> / {recommendation.preparation.total}</small></dd></div><div><dt>Alle aktuellen Aufgaben zuletzt richtig</dt><dd>{insights.coverage.secure}<small> / {insights.coverage.total}</small></dd></div></dl>
        {areas.length ? <div className="tutor-area-list" aria-label="Vorbereitung nach Lernbereichen">{areas.map(area => {
          const weakness = weaknesses.find(item => item.subject === area.subject && item.concept === area.concept);
          const evidence = insights.coverage.areas.find(item => item.subject === area.subject && item.concept === area.concept);
          const state = evidence?.secure ? "Zuletzt richtig" : weakness ? "Weiter üben" : evidence?.covered ? "Aufgegriffen" : "Noch offen";
          const noteIds = weakness?.noteIds.length ? weakness.noteIds : area.noteIds;
          const action: LearningAction = weakness ? { kind: "review-concept", collectionId: recommendation.collectionId, subject: area.subject, concept: area.concept, noteIds: weakness.noteIds } : { kind: "preparation", collectionId: recommendation.collectionId, subject: area.subject, concept: area.concept };
          return <article key={`${area.subject}::${area.concept}`} className={`tutor-area ${evidence?.secure ? "is-secure" : weakness ? "is-weak" : ""}`}><div className="tutor-area-main"><div className="tutor-area-heading"><h4>{area.concept}</h4><span className="tutor-area-state">{state}</span></div>{recommendation.subjects.length > 1 && <p>{area.subject}</p>}<p>{evidence?.answered ?? 0} von {area.questionCount} Aufgaben beantwortet · {evidence?.correct ?? 0} zuletzt richtig</p><p className="tutor-area-completed">{area.completed ? "Vorbereitungseinheit bearbeitet" : "Vorbereitungseinheit noch offen"}</p><Progress value={area.questionCount ? (evidence?.correct ?? 0) / area.questionCount * 100 : 0} aria-label={`${area.concept}: ${evidence?.correct ?? 0} von ${area.questionCount} Aufgaben zuletzt richtig`} /></div><div className="tutor-area-actions"><Button variant="outline" disabled={saving || resumable} onClick={() => onAction(action)} aria-label={`${area.concept}: ${weakness ? "erneut üben" : area.completed ? "weiter üben" : "Einheit starten"}`}>{weakness ? "Erneut üben" : area.completed ? "Weiter üben" : "Einheit starten"}<ArrowRight size={15} /></Button>{noteIds.map(id => <Button key={id} variant="ghost" onClick={() => onOpenNote(id)} aria-label={`${area.concept}: ${workspace.notes.find(note => note.id === id)?.title ?? "Wissen"} nachschlagen`}><BookOpen size={15} />{noteIds.length === 1 ? "Wissen nachschlagen" : workspace.notes.find(note => note.id === id)?.title ?? "Wissen nachschlagen"}</Button>)}</div></article>;
        })}</div> : <div className="tutor-empty"><BookOpen size={28} aria-hidden="true" /><h3>{cards.total ? "Deine Vorbereitung besteht aus Lernkarten" : "Hier wächst deine Vorbereitung"}</h3><p>{cards.total ? "Diese Auswahl enthält keine Testaufgaben. Starte eine Kartenrunde; deine Bewertungen werden separat ausgewertet." : "Wähle eine Sammlung mit Testaufgaben. Ihre Lernbereiche und dein Antwortstand erscheinen dann hier."}</p>{cards.total ? <Button disabled={saving || resumable} onClick={() => onAction({ kind: "review-cards", collectionId: recommendation.collectionId, mode: cards.due ? "due" : "all" })}><Layers3 size={17} />{cards.due ? "Fällige Karten wiederholen" : "Alle Karten üben"}</Button> : onOpenCollections && <Button variant="outline" onClick={onOpenCollections}>Lernsammlung anlegen<ArrowRight size={15} /></Button>}</div>}
      </TabsContent>
      <TabsContent value="results" className="tutor-tab-content">
        <div className="tutor-section-intro"><h3>Ergebnisse verstehen und weiterlernen</h3><p>Abgeschlossene Einheiten aus deinem aktuellen Lernfokus. Veränderungen werden nur für identische Aufgaben und Bewertungsregeln angegeben.</p>{hasArchivedWording && <p className="tutor-evidence-note">Ergebnisse älterer gekürzter Runden bleiben erhalten. Ohne ursprünglichen Aufgabenwortlaut zählen sie nicht als Nachweis für aktuelle Aufgaben oder einen Ergebnisvergleich.</p>}</div>
        {latestResult ? <><article className="tutor-panel"><div className="tutor-panel-heading"><TrendingUp size={20} aria-hidden="true" /><div><h3>Deine Lernkurve</h3><p>Richtige Antworten in den letzten {Math.min(12, insights.history.length)} Einheiten</p></div></div><LearningCurve results={insights.history} /><p className="tutor-comparison-note">{resultChange(latestResult)}</p></article><div className="tutor-result-list" aria-label="Gespeicherte Testergebnisse">{insights.history.map(result => <article key={result.runId} className="tutor-result"><div className="tutor-result-score"><strong>{result.percent}<span> %</span></strong><span>{result.correct} von {result.total} richtig</span></div><div className="tutor-result-detail"><h4>{result.concept ?? (result.mode === "exam" ? "Test" : "Übungsrunde")}</h4><p>{result.subject} · {dateLabel(result.finishedAt)}</p><p>{resultChange(result)}</p></div><Button variant="outline" disabled={saving || resumable} onClick={() => onViewResult(result.runId, recommendation.collectionId)} aria-label={`${result.concept ?? "Einheit"} vom ${dateLabel(result.finishedAt)}: Auswertung ansehen`}>Auswertung ansehen<ArrowRight size={15} /></Button></article>)}</div></> : <div className="tutor-empty"><TrendingUp size={28} aria-hidden="true" /><h3>Dein erstes Ergebnis ist der Ausgangspunkt</h3><p>Nach einer abgeschlossenen Test- oder Übungseinheit erscheinen hier dein Ergebnis, die Antworten und später vergleichbare Wiederholungen.</p>{checkpointAction && <Button disabled={saving || resumable} onClick={() => onAction(checkpointAction)}><ClipboardCheck size={17} />Kurztest starten</Button>}</div>}
        <article className="tutor-panel tutor-card-evidence"><div className="tutor-panel-heading"><Layers3 size={20} aria-hidden="true" /><div><h3>Karten: deine Selbsteinschätzung</h3><p>Kartenbewertungen im Lernfokus werden getrennt von Testergebnissen geführt.</p></div></div><dl><div><dt>Gespeicherte Bewertungen</dt><dd>{insights.cards.reviewed}</dd></div><div><dt>Als gewusst bewertet</dt><dd>{insights.cards.known}</dd></div><div><dt>Tage mit Kartenbewertungen</dt><dd>{insights.cards.days}</dd></div></dl><p className="tutor-evidence-note">Eine Kartenbewertung ist deine eigene Einschätzung und keine geprüfte Testantwort. Zeitpunkte werden ab der Erfassung dieser Lernaktivitäten ausgewertet; ältere Wiederholungszähler enthalten keinen Tagesverlauf.</p></article>
      </TabsContent>
    </Tabs>
  </section>;
}
