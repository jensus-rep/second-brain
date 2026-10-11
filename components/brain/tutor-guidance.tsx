"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ClipboardCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Workspace } from "@/lib/brain/model";
import type { LearningAction } from "@/lib/brain/learning-resume";
import { recordTutorCheckpoint, tutorCardCheckpoint } from "@/lib/brain/learning-tutor";
import type { SaveWorkspace } from "@/lib/brain/use-brain";

type RuntimeReply = { revision: number; source: "llm"; message: string; action: LearningAction | null };

export function sameTutorAction(left: LearningAction | null, right: LearningAction | null) {
  const ordered = (action: LearningAction | null) => action && Object.fromEntries(Object.entries(action).sort(([a], [b]) => a.localeCompare(b)));
  return JSON.stringify(ordered(left)) === JSON.stringify(ordered(right));
}

// Local guidance is ready on the first render. A delayed answer is useful only
// for the exact saved revision and learning context that requested it.
export function useTutorRuntime(revision: number, context: "overview" | "cards", sessionId?: string, active = true) {
  const requestKey = JSON.stringify({ revision, context, sessionId });
  const [reply, setReply] = useState<{ key: string; data: RuntimeReply } | null>(null);
  useEffect(() => {
    if (!active || revision < 0) return;
    const controller = new AbortController();
    let disposed = false;
    const timeout = window.setTimeout(() => controller.abort(), 6500);
    void fetch("/api/tutor", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: requestKey,
      signal: controller.signal, cache: "no-store",
    }).then(async response => {
      if (!response.ok) return;
      const data = await response.json();
      if (!disposed && data.revision === revision && data.source === "llm" && typeof data.message === "string" && data.message.trim() && data.message.length <= 420) {
        setReply({ key: requestKey, data });
      }
    }).catch(() => undefined).finally(() => window.clearTimeout(timeout));
    return () => { disposed = true; controller.abort(); window.clearTimeout(timeout); };
  }, [requestKey, revision, active]);
  return active && reply?.key === requestKey ? reply.data : null;
}

export function TutorCardPrompt({ workspace, revision, save, saving, sessionId, now, onAction }: {
  workspace: Workspace; revision: number; save: SaveWorkspace; saving: boolean;
  sessionId?: string; now: number; onAction: (action: LearningAction) => void;
}) {
  const [evaluationTime, setEvaluationTime] = useState(now);
  // Saved activity can be newer than the overview/study clock. Refresh the
  // clock when a revision arrives, including one loaded from another window.
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setEvaluationTime(Date.now()); });
    return () => { active = false; };
  }, [revision]);
  const checkpoint = tutorCardCheckpoint(workspace, sessionId, Math.max(now, evaluationTime));
  const runtime = useTutorRuntime(revision, "cards", checkpoint?.sessionId, !!checkpoint && !saving);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!checkpoint) return null;
  const count = checkpoint.action.questionCount;
  const runtimeMessage = runtime && sameTutorAction(runtime.action, checkpoint.action) ? runtime.message : null;
  async function later() {
    if (!checkpoint || pending || saving) return;
    setPending(true); setError("");
    try {
      const saved = await save(current => {
        const fresh = tutorCardCheckpoint(current, checkpoint.sessionId);
        if (!fresh || fresh.reviewedAt !== checkpoint.reviewedAt) throw new Error("Dein Lernstand hat sich geändert. Bitte lade den aktuellen Stand.");
        return recordTutorCheckpoint(current, checkpoint, "later");
      }, "");
      setEvaluationTime(Date.now());
      if (!saved) setError("Deine Auswahl konnte nicht gespeichert werden. Du kannst es erneut versuchen.");
    } finally { setPending(false); }
  }
  return <aside className="tutor-card-prompt" role="region" aria-label="Lernimpuls">
    <span className="tutor-prompt-icon"><ClipboardCheck size={23} aria-hidden="true" /></span>
    <div className="tutor-prompt-content"><span className="eyebrow">EIN KURZER IMPULS</span><h3>Kurz prüfen, was hängen geblieben ist?</h3>
      <p>{runtimeMessage ?? `Du hast ${checkpoint.reviewedCount} Karten bewertet. ${count === 1 ? "Eine passende Frage prüft" : `${count} passende Fragen prüfen`}, was du von den gerade wiederholten Inhalten abrufen kannst.`}</p>
      <p className="tutor-prompt-context">{checkpoint.concepts.join(" · ")} · {count === 1 ? "etwa 1 Minute" : "etwa 2–3 Minuten"}</p>
      <p className="tutor-prompt-hint">Deine Kartenposition bleibt gespeichert. Danach kannst du direkt weiterlernen.</p>
      <div className="tutor-prompt-actions"><Button disabled={saving || pending} onClick={() => onAction(checkpoint.action)}>{count} {count === 1 ? "Frage" : "Fragen"} einschieben<ArrowRight size={16} /></Button><Button variant="ghost" disabled={saving || pending} onClick={() => void later()}>Weiter mit Karten</Button></div>
      {runtimeMessage && <span className="tutor-runtime-label"><Sparkles size={12} aria-hidden="true" />KI-Lernimpuls</span>}
      {error && <p role="alert" className="tutor-form-status is-error">{error}</p>}
    </div>
  </aside>;
}
