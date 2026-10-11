"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, BookOpen, Check, ChevronDown, ClipboardCheck, Copy, Layers3, MessageSquareText, Play, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { tutorPlanSchema, type TutorPlan, type Workspace } from "@/lib/brain/model";
import type { SaveWorkspace } from "@/lib/brain/use-brain";
import { collectionItems, learningCollections } from "@/lib/brain/learning-collections";
import { recommendLearning, type LearningAction } from "@/lib/brain/learning-resume";
import { tutorInsights, type TutorQuizResult } from "@/lib/brain/learning-tutor";
import { tutorSessionInsights } from "@/lib/brain/tutor-session";
import { ARCHIVED_TEXT } from "@/lib/brain/quiz";

type Props = {
  workspace: Workspace;
  revision?: number;
  save: SaveWorkspace;
  saving: boolean;
  now: number;
  onAction: (action: LearningAction) => void;
  onOpenNote: (id: string) => void;
  onOpenCollection: (id: string) => void;
  onOpenCollections?: () => void;
  onViewResult: (id: string, collectionId: string | null) => void;
};

const dateLabel = (date: string) => new Intl.DateTimeFormat("de-DE", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin",
}).format(new Date(date));
const shortDate = (date: string) => new Intl.DateTimeFormat("de-DE", {
  day: "numeric", month: "numeric", timeZone: "Europe/Berlin",
}).format(new Date(date));

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

function TutorDetails({ title, summary, children }: { title: string; summary?: string; children: ReactNode }) {
  return <Collapsible className="tutor-details">
    <CollapsibleTrigger asChild><button type="button" className="tutor-details-trigger"><span><strong>{title}</strong>{summary && <span>{summary}</span>}</span><ChevronDown size={19} aria-hidden="true" /></button></CollapsibleTrigger>
    <CollapsibleContent forceMount className="tutor-details-content">{children}</CollapsibleContent>
  </Collapsible>;
}

function TutorPlanForm({ plan, concepts, save, saving }: { plan: TutorPlan | null | undefined; concepts: string[]; save: SaveWorkspace; saving: boolean }) {
  const [goal, setGoal] = useState(plan?.goal ?? "");
  const [instructions, setInstructions] = useState(plan?.instructions ?? "");
  const [conceptOrder, setConceptOrder] = useState((plan?.conceptOrder ?? []).join("\n"));
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
      setInstructions(plan?.instructions ?? "");
      setConceptOrder((plan?.conceptOrder ?? []).join("\n"));
      setTargetDate(plan?.targetDate ?? "");
      setWeeklyDays(String(plan?.weeklyDays ?? 3));
      setDirty(false);
      setRemoteChanged(false);
      if (!ownSave) setStatus(null);
    } else if (goal === (plan?.goal ?? "") && instructions === (plan?.instructions ?? "") && conceptOrder === (plan?.conceptOrder ?? []).join("\n") && targetDate === (plan?.targetDate ?? "") && weeklyDays === String(plan?.weeklyDays ?? 3)) {
      setDirty(false);
      setRemoteChanged(false);
    } else setRemoteChanged(true);
    if (ownSave) setSubmittedPlanKey(null);
  }
  const busy = saving || submitting;
  function edited() { setStatus(null); setDirty(true); }
  function adoptSavedPlan() {
    setGoal(plan?.goal ?? "");
    setInstructions(plan?.instructions ?? "");
    setConceptOrder((plan?.conceptOrder ?? []).join("\n"));
    setTargetDate(plan?.targetDate ?? "");
    setWeeklyDays(String(plan?.weeklyDays ?? 3));
    setDirty(false);
    setRemoteChanged(false);
    setStatus(null);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = tutorPlanSchema.safeParse({ goal, instructions, conceptOrder: conceptOrder.split(/\r?\n/).map(concept => concept.trim()).filter(Boolean), targetDate: targetDate || null, weeklyDays: Number(weeklyDays), updatedAt: new Date().toISOString() });
    if (!parsed.success) {
      setStatus({ kind: "error", message: parsed.error.issues[0]?.message ?? "Bitte prüfe deinen Lernplan." });
      return;
    }
    const unknownConcepts = (parsed.data.conceptOrder ?? []).filter(concept => !concepts.includes(concept));
    if (unknownConcepts.length) {
      setStatus({ kind: "error", message: `Diese Lernbereiche fehlen im aktuellen Lernfokus: ${unknownConcepts.slice(0, 5).join(", ")}${unknownConcepts.length > 5 ? ` und ${unknownConcepts.length - 5} weitere` : ""}. Verwende die Namen aus „Lernbereiche und Grundlagen“.` });
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
    <label className="field"><span>Dein Lernziel</span><Textarea aria-label="Dein Lernziel" maxLength={300} value={goal} disabled={busy} onChange={event => { setGoal(event.target.value); edited(); }} placeholder="Zum Beispiel: Projektmanagement sicher erklären und in Aufgaben anwenden." rows={2} /><small>{goal.length}/300 Zeichen</small></label>
    <label className="field"><span>Vereinbarter Lernablauf (optional)</span><Textarea aria-label="Vereinbarter Lernablauf" maxLength={2000} value={instructions} disabled={busy} onChange={event => { setInstructions(event.target.value); edited(); }} placeholder="Zum Beispiel: Erst Grundlagen festigen, dann kurze Anwendungsaufgaben. Offene Themen bei der nächsten gemeinsamen Planung aufgreifen." rows={4} /><small>{instructions.length}/2000 Zeichen</small></label>
    <p className="tutor-evidence-note">Hier hältst du die gemeinsame Absprache fest. Der Tutor führt kurze Einheiten aus den passenden Karten und Fragen deiner Sammlung durch.</p>
    <label className="field"><span>Themenreihenfolge (optional)</span><Textarea aria-label="Themenreihenfolge" maxLength={16000} value={conceptOrder} disabled={busy} onChange={event => { setConceptOrder(event.target.value); edited(); }} placeholder="Ein vorhandener Lernbereich pro Zeile" rows={3} /><small>Verwende die Namen aus „Lernbereiche und Grundlagen“. Der Tutor folgt dieser Reihenfolge und greift falsche Antworten gezielt wieder auf.</small></label>
    <div className="tutor-plan-fields">
      <label className="field"><span>Zieldatum (optional)</span><Input type="date" value={targetDate} disabled={busy} onChange={event => { setTargetDate(event.target.value); edited(); }} /></label>
      <label className="field"><span>Lerntage pro Woche</span><select aria-label="Lerntage pro Woche" value={weeklyDays} disabled={busy} onChange={event => { setWeeklyDays(event.target.value); edited(); }}>{[1, 2, 3, 4, 5, 6, 7].map(days => <option key={days} value={days}>{days} {days === 1 ? "Tag" : "Tage"}</option>)}</select></label>
    </div>
    <div className="tutor-plan-save"><Button type="submit" variant="outline" disabled={busy}>{submitting ? "Wird gespeichert …" : "Lernplan speichern"}</Button>{status && <p className={`tutor-form-status is-${status.kind}`} role={status.kind === "error" ? "alert" : "status"}>{status.message}</p>}</div>
  </form>;
}

function actionLabel(action: LearningAction | null, cardCount: number, questionCount: number, result: boolean) {
  if (!action) return "Lernsammlung anlegen";
  if (action.kind === "tutor-session") return result ? "Nächste kurze Einheit starten" : cardCount ? `Mit ${cardCount} ${cardCount === 1 ? "Karte" : "Karten"} starten` : `Mit ${questionCount} ${questionCount === 1 ? "Frage" : "Fragen"} starten`;
  if (action.kind === "resume-cards") return "Kartenrunde fortsetzen";
  if (action.kind === "resume-quiz") return "Einheit fortsetzen";
  if (action.kind === "checkpoint") return "Kurztest starten";
  if (action.kind === "open-collection") return "Sammlung ansehen";
  if (action.kind === "review-concept") return "Grundlage festigen";
  if (action.kind === "review-cards") return "Kartenrunde starten";
  return "Einheit starten";
}

export function LearningTutor({ workspace, save, saving, now, onAction, onOpenNote, onOpenCollection, onOpenCollections, onViewResult }: Props) {
  const recommendation = recommendLearning(workspace, now);
  const insights = tutorInsights(workspace, recommendation, now);
  const guided = tutorSessionInsights(workspace, recommendation, now);
  const collections = learningCollections(workspace);
  const selectedCollection = collections.find(collection => collection.id === recommendation.collectionId);
  const resumable = guided.action?.kind === "resume-quiz" || guided.action?.kind === "resume-cards" || guided.phase === "quiz";
  const collectionValue = selectedCollection ? selectedCollection.id : resumable && recommendation.collectionId ? "::saved" : "::all";
  const legacyCards = !guided.session && guided.action?.kind === "resume-cards" ? workspace.flashcardSession : null;
  const resumedRunId = guided.action?.kind === "resume-quiz" ? guided.action.runId : null;
  const legacyQuiz = !guided.session && resumedRunId ? workspace.quizRuns.find(run => run.id === resumedRunId) : null;
  const cardCount = legacyQuiz ? 0 : legacyCards?.queue.length ?? guided.session?.cardIds.length ?? guided.proposal?.cardIds.length ?? 0;
  const questionCount = legacyCards ? 0 : legacyQuiz?.questions.length ?? guided.session?.questionIds.length ?? guided.proposal?.questionIds.length ?? 0;
  const reviewedCards = legacyCards && guided.action?.kind === "resume-cards" ? Math.max(0, legacyCards.queue.length - guided.action.remaining) : guided.cardProgress.done;
  const isResult = guided.phase === "result";
  const isQuiz = guided.phase === "quiz" || guided.action?.kind === "resume-quiz";
  const cardDone = isResult || isQuiz;
  const cardActive = !isResult && !isQuiz && cardCount > 0;
  const label = guided.phase === "unavailable" && guided.action?.kind === "tutor-session" ? "Einheit neu zusammenstellen" : actionLabel(guided.action, cardCount, questionCount, isResult);
  const latestResult = insights.history[0];
  const resultForReport = guided.result ?? latestResult;
  const scopedResultIds = new Set(insights.history.map(result => result.runId));
  const hasArchivedWording = workspace.quizRuns.some(run => scopedResultIds.has(run.id) && run.questions.some(question => question.prompt === ARCHIVED_TEXT));
  const [focusError, setFocusError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const reportRef = useRef<HTMLTextAreaElement>(null);
  const feedbackReport = [
    `Tutor-Rückmeldung: ${recommendation.title}`,
    `Stand: ${dateLabel(new Date(now).toISOString())}`,
    `Lernziel: ${workspace.tutorPlan?.goal || "Noch nicht festgehalten"}`,
    `Vereinbarter Lernablauf: ${workspace.tutorPlan?.instructions || "Kurze Kartenrunde, passender Kurztest, Rückmeldung und nächste Einheit"}`,
    `Vereinbarte Themenreihenfolge: ${workspace.tutorPlan?.conceptOrder?.length ? workspace.tutorPlan.conceptOrder.join(" → ") : "Grundlagen und offene Themen anhand des Lernstands"}`,
    "",
    `Aktuelle Einheit: ${guided.description}`,
    legacyCards ? `Karten der offenen Runde: ${reviewedCards} von ${cardCount} bewertet.` : legacyQuiz ? "Die offene Einheit ist eine Fragerunde." : guided.cardProgress.total ? `Karten der Einheit: ${guided.cardProgress.done} von ${guided.cardProgress.total} bewertet, ${guided.cardProgress.known} als gewusst eingeschätzt.` : "Aktuelle Einheit ohne Kartenrunde.",
    resultForReport ? `Letzter abgeschlossener Test: ${resultForReport.correct} von ${resultForReport.total} richtig (${resultForReport.percent} %), ${dateLabel(resultForReport.finishedAt)}.` : "Noch kein abgeschlossener Test im Lernfokus.",
    `Gespeicherte Kartenbewertungen im Lernfokus: ${insights.cards.reviewed}, davon ${insights.cards.known} als gewusst eingeschätzt. Selbsteinschätzung und Testergebnis werden getrennt betrachtet.`,
    `Abdeckung: ${guided.progress.covered} von ${guided.progress.total} Lernbereichen aufgegriffen; in ${guided.progress.secure} Bereichen alle aktuellen Aufgaben zuletzt richtig.`,
    `Noch nicht geprüft: ${guided.untouched.length ? guided.untouched.join("; ") : guided.progress.total ? "Alle vorhandenen Lernbereiche wurden aufgegriffen." : "Keine Testaufgaben vorhanden; Grundlagen sind noch nicht durch Tests geprüft."}`,
    `Weiter zu festigen: ${guided.weakConcepts.length ? guided.weakConcepts.join("; ") : "Aktuell keine falschen Testantworten als offene Schwachstelle gespeichert."}`,
    "",
    `Nächster Schritt: ${guided.next?.description ?? guided.proposal?.description ?? guided.description}`,
    "Für die gemeinsame Planung: Passen Reihenfolge und Umfang? Welche Grundlagen oder Anwendungsaufgaben sollen wir ergänzen?",
  ].join("\n");

  async function changeFocus(collectionId: string | null, subject: string | null) {
    setFocusError("");
    const saved = await save(current => ({ ...current, learningFocus: { collectionId, subject, updatedAt: new Date().toISOString() } }), "Lernfokus gespeichert");
    if (!saved) setFocusError("Der Lernfokus konnte nicht gespeichert werden. Der bisherige Fokus bleibt aktiv.");
  }
  async function copyReport() {
    try {
      await navigator.clipboard.writeText(feedbackReport);
      setCopyStatus("Rückmeldung kopiert. Du kannst sie im Chat einfügen und den Plan gemeinsam verfeinern.");
    } catch {
      reportRef.current?.focus();
      reportRef.current?.select();
      setCopyStatus("Der Text ist markiert. Kopiere ihn und füge ihn im Chat ein.");
    }
  }

  return <section className="learning-tutor tutor-guided" aria-label="Dein Tutor">
    <div className="tutor-focus-header"><div className="tutor-focus-title"><span className="tutor-icon"><Target size={22} aria-hidden="true" /></span><div><span className="eyebrow">DEIN TUTOR</span><h2>{recommendation.title}</h2><p>Kurze Einheiten. Ein klarer nächster Schritt.</p></div></div></div>

    <article className={`tutor-guided-step ${isResult ? "is-result" : ""}`}>
      <div className="tutor-guided-intro"><span className="eyebrow">{isResult ? "DEINE RÜCKMELDUNG" : guided.phase === "cards" || guided.phase === "resume" || isQuiz ? "HIER GEHT ES WEITER" : "DEINE NÄCHSTE EINHEIT"}</span><h3>{guided.title}</h3><p>{guided.description}</p></div>
      {guided.phase !== "unavailable" && <ol className="tutor-guided-route" aria-label="Ablauf deiner kurzen Lerneinheit">
        <li className={cardCount === 0 ? "is-skipped" : cardDone ? "is-done" : cardActive ? "is-current" : ""} aria-current={cardActive ? "step" : undefined}><span className="tutor-route-mark">{cardDone && cardCount > 0 ? <Check size={17} aria-hidden="true" /> : <Layers3 size={17} aria-hidden="true" />}</span><div><strong>{cardCount ? `${cardCount} ${cardCount === 1 ? "Karte" : "Karten"}` : "Karten"}</strong><span>{cardCount ? `${reviewedCards} von ${cardCount} bewertet` : "Keine Karten in dieser Einheit"}</span></div></li>
        <li className={questionCount === 0 ? "is-skipped" : isResult ? "is-done" : isQuiz || !cardCount ? "is-current" : ""} aria-current={!isResult && questionCount > 0 && (isQuiz || !cardCount) ? "step" : undefined}><span className="tutor-route-mark">{isResult && questionCount > 0 ? <Check size={17} aria-hidden="true" /> : <ClipboardCheck size={17} aria-hidden="true" />}</span><div><strong>Kurztest</strong><span>{questionCount ? `${questionCount} passende ${questionCount === 1 ? "Frage" : "Fragen"}` : "Noch keine passenden Fragen vorhanden"}</span></div></li>
        <li className={isResult ? "is-current" : ""} aria-current={isResult ? "step" : undefined}><span className="tutor-route-mark"><MessageSquareText size={17} aria-hidden="true" /></span><div><strong>Rückmeldung</strong><span>{isResult ? "Stand und nächste Einheit" : "Was sitzt, was als Nächstes hilft"}</span></div></li>
      </ol>}
      {isResult && guided.result && <p className="tutor-guided-result"><strong>{guided.result.correct} von {guided.result.total} richtig</strong><span>{guided.result.percent} % im Kurztest</span></p>}
      {isResult && guided.next && <p className="tutor-guided-next"><strong>Danach:</strong> {guided.next.title}</p>}
      {guided.action ? <Button className="tutor-primary-action" disabled={saving} onClick={() => onAction(guided.action!)}><Play size={17} aria-hidden="true" />{label}<ArrowRight size={16} aria-hidden="true" /></Button> : selectedCollection ? <Button className="tutor-primary-action" onClick={() => onOpenCollection(selectedCollection.id)}><BookOpen size={17} aria-hidden="true" />Sammlung ansehen<ArrowRight size={16} aria-hidden="true" /></Button> : onOpenCollections && <Button className="tutor-primary-action" onClick={onOpenCollections}><BookOpen size={17} aria-hidden="true" />Lernsammlung anlegen<ArrowRight size={16} aria-hidden="true" /></Button>}
    </article>

    <div className="tutor-guided-progress"><div><strong>{guided.progress.total ? `${guided.progress.covered} von ${guided.progress.total} Lernbereichen aufgegriffen` : "Deine Kartenbewertungen bleiben gespeichert"}</strong><span>{guided.progress.total ? `${guided.progress.secure} mit allen aktuellen Aufgaben zuletzt richtig` : `${insights.cards.reviewed} Bewertungen im Lernfokus`}{insights.plan ? ` · ${insights.continuity.weeklyActiveDays} von ${insights.plan.weeklyDays} Lerntagen diese Woche` : ""}</span></div>{guided.progress.total > 0 && <Progress value={guided.progress.covered / guided.progress.total * 100} aria-label={`${guided.progress.covered} von ${guided.progress.total} Lernbereichen aufgegriffen`} />}</div>
    {(guided.weakConcepts.length > 0 || guided.untouched.length > 0) && <aside className="tutor-guided-outlook" aria-label="Was der Tutor im Blick behält"><span>Im Blick behalten</span><p>{guided.weakConcepts.length > 0 && <><strong>Noch festigen:</strong> {guided.weakConcepts.slice(0, 2).join(", ")}. </>}{guided.untouched.length > 0 && <><strong>Noch nicht geprüft:</strong> {guided.untouched.slice(0, 3).join(", ")}{guided.untouched.length > 3 ? ` und ${guided.untouched.length - 3} weitere Bereiche` : ""}.</>}</p></aside>}

    <div className="tutor-guided-details">
      <TutorDetails title="Rückmeldung für die gemeinsame Planung" summary="Lernstand mitnehmen und den Plan im Chat verfeinern">
        <p>Diese Rückmeldung bündelt deinen gespeicherten Stand. Kopiere sie in unseren Chat, wenn wir die Vorbereitung gemeinsam anpassen.</p>
        <Textarea ref={reportRef} aria-label="Tutor-Rückmeldung zum Kopieren" readOnly value={feedbackReport} rows={10} className="tutor-feedback-report" />
        <div className="tutor-report-actions"><Button type="button" variant="outline" onClick={() => void copyReport()}><Copy size={16} aria-hidden="true" />Rückmeldung kopieren</Button>{copyStatus && <p role="status" className="tutor-form-status">{copyStatus}</p>}</div>
      </TutorDetails>

      <TutorDetails title="Lernplan und Fokus" summary={workspace.tutorPlan?.goal || "Gemeinsames Ziel und Lernablauf festhalten"}>
        <TutorPlanForm plan={workspace.tutorPlan} concepts={recommendation.areas.map(area => area.concept)} save={save} saving={saving} />
        <div className="tutor-focus-settings"><h3>Lernfokus</h3><div className="tutor-focus-controls">
          <label className="field"><span>Lernsammlung</span><select aria-label="Lernfokus auswählen" disabled={saving || resumable} value={collectionValue} onChange={event => {
            const chosen = collections.find(collection => collection.id === event.target.value);
            const questions = chosen ? collectionItems(workspace, chosen).questions : workspace.quizQuestions;
            void changeFocus(chosen?.id ?? null, questions[0]?.subject ?? null);
          }}><option value="::all">Gesamter Lernbestand</option>{collectionValue === "::saved" && <option value="::saved">Gespeicherte Lerneinheit</option>}{collections.map(collection => <option key={collection.id} value={collection.id}>{collection.title}</option>)}</select></label>
          {recommendation.subjects.length > 1 && <label className="field"><span>Fachthema</span><select aria-label="Fachthema im Lernfokus" disabled={saving || resumable} value={recommendation.subject ?? recommendation.subjects[0]} onChange={event => void changeFocus(recommendation.collectionId, event.target.value)}>{recommendation.subjects.map(subject => <option key={subject}>{subject}</option>)}</select></label>}
        </div>{resumable && <p className="tutor-evidence-note">Setze die gespeicherte Einheit fort, bevor du den Lernfokus wechselst.</p>}{focusError && <p className="tutor-form-status is-error" role="alert">{focusError}</p>}{selectedCollection && <Button variant="ghost" onClick={() => onOpenCollection(selectedCollection.id)}>Sammlung ansehen<ArrowRight size={15} aria-hidden="true" /></Button>}</div>
      </TutorDetails>

      <TutorDetails title="Lernbereiche und Grundlagen" summary={`${insights.coverage.covered} aufgegriffen · ${insights.coverage.total - insights.coverage.covered} noch nicht geprüft`}>
        <p>Eine bearbeitete Einheit zeigt, was du geübt hast. Die letzten Antworten zeigen zusätzlich, welche aktuellen Aufgaben richtig gelöst wurden.</p>
        {insights.coverage.areas.length ? <ul className="tutor-guided-area-list">{insights.coverage.areas.map(area => {
          const weak = guided.weakConcepts.includes(area.concept);
          const secure = area.secure && !weak;
          const noteIds = recommendation.areas.find(item => item.subject === area.subject && item.concept === area.concept)?.noteIds ?? [];
          return <li key={`${area.subject}::${area.concept}`}><div><strong>{area.concept}</strong><span className={`tutor-area-state ${secure ? "is-secure" : weak ? "is-weak" : ""}`}>{secure ? "Zuletzt richtig" : weak ? "Noch festigen" : area.covered ? "Aufgegriffen" : "Noch nicht geprüft"}</span><p>{area.answered} von {area.total} Aufgaben beantwortet · {area.correct} zuletzt richtig</p></div>{noteIds.length > 0 && <Button variant="ghost" onClick={() => onOpenNote(noteIds[0])} aria-label={`${area.concept}: Grundlagen nachlesen`}><BookOpen size={15} aria-hidden="true" />Grundlagen nachlesen</Button>}</li>;
        })}</ul> : <p className="tutor-evidence-note">Für diesen Lernfokus sind noch keine Testaufgaben vorhanden. Kartenbewertungen zeigen deine Selbsteinschätzung; sie prüfen das Basiswissen nicht unabhängig.</p>}
      </TutorDetails>

      <TutorDetails title="Ergebnisse und Verlauf" summary={latestResult ? `Letzte Einheit: ${latestResult.correct} von ${latestResult.total} richtig` : "Hier erscheinen deine abgeschlossenen Einheiten"}>
        {latestResult ? <><div className="tutor-panel-heading"><TrendingUp size={20} aria-hidden="true" /><div><h3>Deine Lernkurve</h3><p>Richtige Antworten in den letzten {Math.min(12, insights.history.length)} Einheiten</p></div></div><LearningCurve results={insights.history} /><div className="tutor-result-list" aria-label="Gespeicherte Testergebnisse">{insights.history.map(result => <article key={result.runId} className="tutor-result"><div className="tutor-result-score"><strong>{result.percent}<span> %</span></strong><span>{result.correct} von {result.total} richtig</span></div><div className="tutor-result-detail"><h4>{result.concept ?? (result.mode === "exam" ? "Test" : "Übungsrunde")}</h4><p>{result.subject} · {dateLabel(result.finishedAt)}</p><p>{resultChange(result)}</p></div><Button variant="outline" disabled={saving || resumable} onClick={() => onViewResult(result.runId, recommendation.collectionId)} aria-label={`${result.concept ?? "Einheit"} vom ${dateLabel(result.finishedAt)}: Auswertung ansehen`}>Auswertung ansehen<ArrowRight size={15} aria-hidden="true" /></Button></article>)}</div></> : <p>Nach der ersten abgeschlossenen Einheit erscheinen hier deine Antworten und Ergebnisse.</p>}
        {hasArchivedWording && <p className="tutor-evidence-note">Ältere gekürzte Ergebnisse bleiben erhalten. Ohne ursprünglichen Aufgabenwortlaut belegen sie keine richtigen Antworten auf aktuelle Aufgaben und sind nicht mit ihnen vergleichbar.</p>}
        <p className="tutor-evidence-note">Karten im Lernfokus: {insights.cards.reviewed} gespeicherte Bewertungen, {insights.cards.known} als gewusst eingeschätzt. Kartenbewertungen sind deine Selbsteinschätzung und werden getrennt von Testantworten geführt.</p>
      </TutorDetails>
    </div>
  </section>;
}
