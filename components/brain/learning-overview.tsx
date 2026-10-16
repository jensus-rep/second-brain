"use client";

import { ArrowRight, BookOpen, Check, CircleHelp, ClipboardCheck, Layers3, Play, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Workspace } from "@/lib/brain/model";
import type { SaveWorkspace } from "@/lib/brain/use-brain";
import { collectionItems, learningCollections } from "@/lib/brain/learning-collections";
import { recommendLearning, type LearningAction } from "@/lib/brain/learning-resume";

type Props = {
  workspace: Workspace;
  save: SaveWorkspace;
  saving: boolean;
  now: number;
  onAction: (action: LearningAction) => void;
  onOpenNote: (id: string) => void;
  onOpenCollection: (id: string) => void;
  onViewResult: (id: string, collectionId: string | null) => void;
};
const actionLabels: Record<LearningAction["kind"], string> = {
  "tutor-session": "Kurze Lernrunde starten",
  "resume-quiz": "Einheit fortsetzen",
  "resume-cards": "Lernkarten fortsetzen",
  "review-concept": "Schwachstelle üben",
  "review-cards": "Fällige Karten wiederholen",
  preparation: "Nächste Einheit starten",
  "exam-simulation": "Prüfungssimulation starten",
  checkpoint: "Kurztest starten",
  "open-collection": "Lernsammlung öffnen",
};
const dateLabel = (date: string) => new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(date));

export function LearningOverview({ workspace, save, saving, now, onAction, onOpenNote, onOpenCollection, onViewResult }: Props) {
  const recommendation = recommendLearning(workspace, now);
  const { primaryAction, recentResult, weaknesses, cards, preparation, areas } = recommendation;
  const primaryLabel = primaryAction?.kind === "review-cards" && primaryAction.mode === "all" ? "Alle Karten üben" : primaryAction ? actionLabels[primaryAction.kind] : "Deine Vorbereitung beginnt hier";
  const collections = learningCollections(workspace);
  const selectedCollection = collections.find(collection => collection.id === recommendation.collectionId);
  const resumable = primaryAction?.kind === "resume-quiz" || primaryAction?.kind === "resume-cards";
  const collectionValue = recommendation.collectionId && selectedCollection ? recommendation.collectionId : resumable && !selectedCollection ? "::saved" : "::all";
  async function changeFocus(collectionId: string | null, subject: string | null) {
    await save(current => ({ ...current, learningFocus: { collectionId, subject, updatedAt: new Date().toISOString() } }), "Lernfokus gespeichert");
  }
  const actionDescription = !primaryAction ? "Wähle eine Lernsammlung mit Karten oder Testaufgaben, um deine Vorbereitung zu beginnen."
    : primaryAction.kind === "resume-quiz" ? "Deine beantworteten Aufgaben sind gespeichert. Steige direkt in die offene Einheit ein."
    : primaryAction.kind === "resume-cards" ? `Deine Kartenrunde ist unterbrochen. ${primaryAction.remaining} ${primaryAction.remaining === 1 ? "Karte wartet" : "Karten warten"} noch auf dich.`
    : primaryAction.kind === "review-concept" ? `Bei „${primaryAction.concept}“ sind noch Antworten falsch. Schau den Zusammenhang nach und prüfe diese Aufgaben erneut.`
    : primaryAction.kind === "review-cards" ? primaryAction.mode === "all" ? "Aktuell sind keine Karten fällig. Starte eine Übungsrunde mit den Karten deines Lernfokus." : `${cards.due} ${cards.due === 1 ? "Karte ist" : "Karten sind"} jetzt fällig. Wiederhole diese Auswahl, bevor du neuen Stoff dazunimmst.`
    : primaryAction.kind === "preparation" ? areas.some(area => area.subject === primaryAction.subject && area.concept === primaryAction.concept && area.completed)
      ? `Du hast „${primaryAction.concept}“ bereits bearbeitet. Weitere Aufgaben festigen den Bereich und prüfen die Anwendung.`
      : `„${primaryAction.concept}“ ist noch offen. Die nächste kurze Einheit knüpft an deine Vorbereitung an.`
    : primaryAction.kind === "checkpoint" ? `Die Vorbereitungseinheiten sind bearbeitet. Prüfe mit ${primaryAction.questionCount} gemischten Aufgaben, was du bereits anwenden kannst.`
    : "Öffne die zugehörigen Wissensnotizen und Lernpfade für deinen nächsten Schritt.";
  const checkpointSubject = recommendation.subject;
  const checkpointCount = checkpointSubject ? (selectedCollection ? collectionItems(workspace, selectedCollection).questions : workspace.quizQuestions).filter(question => question.subject === checkpointSubject).length : 0;

  return <section className="learning-overview" aria-label="Dein Lernüberblick">
    <div className="learning-focus-heading"><span className="learning-focus-mark"><Target size={24} aria-hidden="true" /></span><div><span className="eyebrow">DEIN LERNFOKUS</span><h2>{recommendation.title}</h2><p>Hier geht deine Vorbereitung weiter.</p></div>{selectedCollection && <Button variant="ghost" size="sm" onClick={() => onOpenCollection(selectedCollection.id)}>Sammlung ansehen<ArrowRight size={15} /></Button>}</div>
    <div className="learning-next-step"><div><span className="eyebrow">{resumable ? "WO DU AUFGEHÖRT HAST" : "DEIN NÄCHSTER SCHRITT"}</span><h3>{primaryLabel}</h3><p>{actionDescription}</p></div>{primaryAction && <Button disabled={saving} onClick={() => onAction(primaryAction)}><Play size={17} />{primaryLabel}</Button>}</div>
    <div className="learning-focus-controls">
      <label className="field"><span>Deine Vorbereitung</span><select aria-label="Lernfokus auswählen" disabled={saving || resumable} value={collectionValue} onChange={event => {
        const chosen = collections.find(collection => collection.id === event.target.value);
        const questions = chosen ? collectionItems(workspace, chosen).questions : workspace.quizQuestions;
        void changeFocus(chosen?.id ?? null, questions[0]?.subject ?? null);
      }}><option value="::all">Gesamter Lernbestand</option>{collectionValue === "::saved" && <option value="::saved">Gespeicherte Lerneinheit</option>}{collections.map(collection => <option key={collection.id} value={collection.id}>{collection.title}</option>)}</select></label>
      {recommendation.subjects.length > 1 && <label className="field"><span>Fachthema</span><select aria-label="Fachthema im Lernfokus" disabled={saving || resumable} value={recommendation.subject ?? recommendation.subjects[0]} onChange={event => void changeFocus(recommendation.collectionId, event.target.value)}>{recommendation.subjects.map(subject => <option key={subject}>{subject}</option>)}</select></label>}
    </div>
    <dl className="learning-summary-stats" aria-label="Dein gespeicherter Lernstand">
      <div><dt><ClipboardCheck size={15} />Lernbereiche bearbeitet</dt><dd>{preparation.completed}<small> / {preparation.total}</small></dd>{preparation.total > 0 && <Progress value={preparation.completed / preparation.total * 100} aria-label={`${preparation.completed} von ${preparation.total} Lernbereichen bearbeitet`} />}</div>
      <div><dt><Layers3 size={15} />Karten bereits wiederholt</dt><dd>{cards.reviewed}<small> / {cards.total}</small></dd><span>{cards.due} jetzt fällig</span></div>
      <div><dt><TrendingUp size={15} />Letzte Auswertung</dt><dd>{recentResult ? <>{recentResult.percent}<small> % richtig</small></> : <span className="learning-stat-empty">Noch keine</span>}</dd>{recentResult && <span>{recentResult.correct} von {recentResult.total} Aufgaben · {dateLabel(recentResult.finishedAt)}</span>}</div>
    </dl>
    {recentResult && <div className="learning-recent-result"><div><span>Ergebnis der letzten Einheit</span><strong>{recentResult.change === null ? "Für diese Runde gibt es noch keinen vergleichbaren früheren Wert." : recentResult.change > 0 ? `+${recentResult.change} Prozentpunkte zur vorigen vergleichbaren Runde` : recentResult.change < 0 ? `${recentResult.change} Prozentpunkte zur vorigen vergleichbaren Runde` : "Ergebnis gegenüber der vorigen vergleichbaren Runde gehalten."}</strong></div><Button variant="outline" size="sm" disabled={saving || primaryAction?.kind === "resume-quiz"} onClick={() => onViewResult(recentResult.runId, recommendation.collectionId)}>Auswertung ansehen<ArrowRight size={15} /></Button></div>}
    {areas.length > 0 && <div className="learning-area-list" aria-label="Stand deiner Lernbereiche"><div className="section-heading"><h3>Was als Nächstes sinnvoll ist</h3><span>Bearbeitet bedeutet: eine vollständige Einheit beantwortet.</span></div>{areas.map(area => {
      const weakness = weaknesses.find(item => item.subject === area.subject && item.concept === area.concept);
      const state = weakness ? "Nachschauen & üben" : area.completed ? "Bearbeitet" : "Noch offen";
      return <article key={area.subject + "::" + area.concept} className={"learning-area is-" + (weakness ? "weak" : area.completed ? "completed" : "open")}><span className="learning-area-icon">{weakness ? <CircleHelp size={18} /> : area.completed ? <Check size={18} /> : <BookOpen size={18} />}</span><div><h4>{area.concept}</h4><p>{recommendation.subjects.length > 1 ? area.subject + " · " : ""}{state}{area.total > 0 && ` · zuletzt ${area.correct}/${area.total} richtig`}</p></div><div className="learning-area-actions">{(weakness?.noteIds[0] ?? area.noteIds[0]) && <Button variant="ghost" size="sm" onClick={() => onOpenNote(weakness?.noteIds[0] ?? area.noteIds[0])} aria-label={`${area.concept}: Wissen nachschlagen`}><BookOpen size={15} />Nachschlagen</Button>}<Button variant="outline" size="sm" disabled={saving || resumable} onClick={() => onAction(weakness ? { kind: "review-concept", collectionId: recommendation.collectionId, subject: area.subject, concept: area.concept, noteIds: weakness.noteIds } : { kind: "preparation", collectionId: recommendation.collectionId, subject: area.subject, concept: area.concept })} aria-label={`${area.concept}: ${weakness ? "erneut üben" : area.completed ? "wiederholen" : "Einheit starten"}`}>{weakness ? "Erneut üben" : area.completed ? "Wiederholen" : "Starten"}<ArrowRight size={14} /></Button></div></article>;
    })}</div>}
    {checkpointSubject && checkpointCount > 0 && primaryAction?.kind !== "checkpoint" && <div className="learning-checkpoint"><div><h3>Lernstand kurz prüfen</h3><p>Bis zu {Math.min(6, checkpointCount)} gemischte Aufgaben aus deinem Fachthema. Die Lösungen erscheinen nach der Abgabe.</p></div><Button variant="outline" disabled={saving || resumable} onClick={() => onAction({ kind: "checkpoint", collectionId: recommendation.collectionId, subject: checkpointSubject, questionCount: Math.min(6, checkpointCount) })}><ClipboardCheck size={16} />Kurztest starten</Button></div>}
  </section>;
}
