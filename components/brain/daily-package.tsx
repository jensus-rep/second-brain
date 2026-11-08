"use client";

import { useMemo } from "react";
import { ArrowRight, BookOpen, CalendarCheck, Check, ClipboardCheck, Layers3, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Workspace } from "@/lib/brain/model";
import type { SaveWorkspace } from "@/lib/brain/use-brain";
import type { LearningAction } from "@/lib/brain/learning-resume";
import { dailyPackageStatus, markDailyReading, type DailyProposal, type DailyStatus } from "@/lib/brain/daily-package";
import { Markdown } from "./markdown";

const cards = (count: number) => `${count} ${count === 1 ? "Karte" : "Karten"}`;
const questions = (count: number) => `${count} ${count === 1 ? "Frage" : "Fragen"}`;

function proposalSummary(proposal: DailyProposal) {
  const parts = [
    proposal.cardIds.length ? cards(proposal.cardIds.length) + (proposal.newCards ? `, davon ${proposal.newCards} neu` : "") : "",
    proposal.reading ? "ein Inhalt" : "",
    proposal.questionIds.length ? questions(proposal.questionIds.length) : "",
  ].filter(Boolean);
  return `${parts.join(" · ")} · ca. ${proposal.minutes} Min.`;
}

function seriesLabel(series: number) {
  return series > 1 ? `${series} Lerntage in Serie` : "Dein erster Lerntag in dieser Serie";
}

function nextStepLabel(status: DailyStatus) {
  if (status.stage === "cards") return `Noch ${cards(status.remainingCards)}, danach geht es im Paket weiter.`;
  if (status.stage === "read") return "Als Nächstes liest du einen kurzen Abschnitt.";
  if (status.blockedByQuiz) return "Beende zuerst deinen laufenden Test. Danach kommen deine Abschlussfragen.";
  return "Zum Schluss prüfen ein paar Fragen, was hängen geblieben ist.";
}

export function DailyPackageCard({ workspace, saving, now, onAction, onOpen }: {
  workspace: Workspace; saving: boolean; now: number; onAction: (action: LearningAction) => void; onOpen: () => void;
}) {
  const status = useMemo(() => dailyPackageStatus(workspace, now), [workspace, now]);
  const { stage, proposal } = status;
  if (stage === "ready" && !proposal) return null;
  const done = stage === "done";
  const open = stage !== "ready" && !done;
  const start = (short = false) => onAction({ kind: "daily-package", collectionId: null, short });
  const title = done ? "Für heute geschafft" : open ? "Dein Paket wartet" : "Dein Paket für heute";
  const text = done ? seriesLabel(status.series) + (status.completedToday > 1 ? ` · heute ${status.completedToday} Pakete` : "") : open ? nextStepLabel(status) : proposalSummary(proposal!);
  return <section className={"daily-card" + (done ? " is-done" : "")} aria-label="Dein Tagespaket">
    <span className="daily-card-mark">{done ? <Check size={22} aria-hidden="true" /> : <CalendarCheck size={22} aria-hidden="true" />}</span>
    <div className="daily-card-copy"><span className="eyebrow">HEUTE</span><h2>{title}</h2><p>{text}</p></div>
    <div className="daily-card-actions">
      {stage === "ready" && <Button disabled={saving} onClick={() => start()}><Play size={16} />Paket starten</Button>}
      {open && <Button disabled={saving} onClick={() => status.action ? onAction(status.action) : onOpen()}><Play size={16} />Weitermachen</Button>}
      {done && proposal && <Button variant="outline" disabled={saving} onClick={() => start()}>Noch ein Paket<ArrowRight size={15} /></Button>}
      {stage === "ready" && status.completedToday === 0 && <button className="daily-short-link" disabled={saving} onClick={() => start(true)}>Wenig Zeit? 3 Karten zählen auch.</button>}
    </div>
  </section>;
}

function Steps({ status }: { status: DailyStatus }) {
  const item = status.package;
  if (!item) return null;
  const order = ["cards", "read", "quiz", "done"];
  const position = order.indexOf(status.stage);
  const steps = [
    { stage: "cards", label: "Karten", icon: Layers3, shown: item.cardIds.length > 0 },
    { stage: "read", label: "Lesen", icon: BookOpen, shown: !!item.reading },
    { stage: "quiz", label: "Fragen", icon: ClipboardCheck, shown: item.questionIds.length > 0 },
  ].filter(step => step.shown);
  return <ol className="daily-steps" aria-label="Fortschritt in deinem Paket">{steps.map(({ stage, label, icon: Icon }) => {
    const state = order.indexOf(stage) < position ? "is-done" : stage === status.stage ? "is-current" : "";
    return <li key={stage} className={state} aria-current={stage === status.stage ? "step" : undefined}>{state === "is-done" ? <Check size={15} aria-hidden="true" /> : <Icon size={15} aria-hidden="true" />}{label}</li>;
  })}</ol>;
}

export function DailyPackageView({ workspace, save, saving, now, onAction, onContinue, onOpenNote }: {
  workspace: Workspace; save: SaveWorkspace; saving: boolean; now: number; onAction: (action: LearningAction) => void;
  onContinue: (state: Workspace) => void; onOpenNote: (id: string) => void;
}) {
  const status = useMemo(() => dailyPackageStatus(workspace, now), [workspace, now]);
  const { note, section, package: item } = status;
  async function finishReading() {
    if (!item) return;
    let updated: Workspace | null = null;
    const ok = await save(current => {
      updated = markDailyReading(current, item.id);
      return updated;
    }, "");
    if (ok && updated) onContinue(updated);
  }
  return <div className="daily-view">
    <Steps status={status} />
    {status.stage === "read" && note && section ? <article className="daily-reading">
      <span className="eyebrow">{note.title}</span>
      <h2>{section.title}</h2>
      <div className="daily-reading-body"><Markdown content={section.content.replace(/^##\s+.*\n?/, "")} linkTerms skipTermNoteId={note.id} /></div>
      <div className="daily-reading-actions">
        <Button disabled={saving} onClick={() => void finishReading()}>Gelesen, weiter<ArrowRight size={16} /></Button>
        <Button variant="ghost" onClick={() => onOpenNote(note.id)}><BookOpen size={16} />Ganze Notiz öffnen</Button>
      </div>
    </article> : <DailyPackageCard workspace={workspace} saving={saving} now={now} onAction={onAction} onOpen={() => undefined} />}
    {status.stage === "ready" && !status.proposal && <p className="daily-empty">Für ein Paket fehlen gerade Karten, Notizen und Testaufgaben.</p>}
  </div>;
}
