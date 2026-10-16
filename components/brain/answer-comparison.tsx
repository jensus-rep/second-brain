"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { answerComparisonResultSchema, answerResponseFingerprint, referenceAnswer, referenceAnswerComparison, type AnswerComparisonResult } from "@/lib/brain/answer-comparison";
import { Markdown } from "./markdown";

/** A comparison belongs to one response and one revision of the source card. */
export function useAnswerComparison({ revision, sessionId, cardId, question, answer, response, active, revealed, requestEnabled }: {
  revision: number; sessionId?: string; cardId?: string; question: string; answer: string; response: string; active: boolean; revealed: boolean; requestEnabled: boolean;
}) {
  const ownResponse = response.trim();
  const [attempt, setAttempt] = useState(0);
  const sourceKey = JSON.stringify([revision, sessionId, cardId, question, answer]);
  const requestKey = active && revision >= 0 && sessionId && cardId && ownResponse
    ? JSON.stringify([sourceKey, ownResponse, attempt]) : null;
  const [completed, setCompleted] = useState<{ key: string; result: AnswerComparisonResult } | null>(null);
  const [scheduledKey, setScheduledKey] = useState<string | null>(null);
  const preloadedSource = useRef<string | null>(null);

  useEffect(() => {
    if (!requestKey || !requestEnabled || completed?.key === requestKey) return;
    // At most one speculative comparison per source, after a writing pause.
    // Later edits are compared on reveal, keeping the hourly budget useful.
    if (!revealed && preloadedSource.current === sourceKey) return;
    const timer = window.setTimeout(() => {
      if (!revealed) preloadedSource.current = sourceKey;
      setScheduledKey(requestKey);
    }, revealed ? 0 : 1200);
    return () => window.clearTimeout(timer);
  }, [requestKey, sourceKey, requestEnabled, revealed, completed?.key]);

  useEffect(() => {
    if (!requestKey || scheduledKey !== requestKey || !requestEnabled || !sessionId || !cardId || completed?.key === requestKey) return;
    const controller = new AbortController();
    let disposed = false;
    const fallback = referenceAnswerComparison({ revision, cardId, response: ownResponse }, answer);
    const timeout = window.setTimeout(() => controller.abort(), 13000);
    async function compare() {
      let result = fallback;
      try {
        const reply = await fetch("/api/tutor/compare", {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
          body: JSON.stringify({ revision, sessionId, cardId, response: ownResponse }),
        });
        if (!reply.ok) throw new Error("Der Vergleich ist gerade nicht verfügbar.");
        const parsed = answerComparisonResultSchema.safeParse(await reply.json());
        if (!parsed.success || parsed.data.revision !== revision || parsed.data.cardId !== cardId ||
          parsed.data.responseFingerprint !== answerResponseFingerprint(ownResponse) || parsed.data.reference !== referenceAnswer(answer)) {
          throw new Error("Der Vergleich gehört nicht zur aktuellen Antwort.");
        }
        result = parsed.data;
      } catch {
        // An honest source excerpt stays useful when a semantic comparison fails.
      } finally {
        window.clearTimeout(timeout);
      }
      if (!disposed) setCompleted({ key: requestKey!, result });
    }
    void compare();
    return () => { disposed = true; window.clearTimeout(timeout); controller.abort(); };
  }, [requestKey, scheduledKey, requestEnabled, completed?.key, revision, sessionId, cardId, ownResponse, answer]);

  const result = requestKey && cardId
    ? completed?.key === requestKey ? completed.result : referenceAnswerComparison({ revision, cardId, response: ownResponse }, answer)
    : null;
  // A comparison that waits for a background save is still on its way.
  return { result, pending: !!requestKey && completed?.key !== requestKey, retry: () => setAttempt(value => value + 1) };
}

const verdictTitles: Record<AnswerComparisonResult["verdict"], string> = {
  aligned: "Die Kernaussage passt", partial: "Schon teilweise passend", needs_revision: "Hier kannst du nachschärfen",
  unclear: "Deine Erklärung ist noch nicht eindeutig", reference: "Zum Abgleichen",
};

export function AnswerComparisonView({ comparison, pending, answer, onRetry }: {
  comparison: AnswerComparisonResult; pending: boolean; answer: string; onRetry?: () => void;
}) {
  return <div className="study-answer-comparison" data-source={comparison.source} data-verdict={comparison.verdict} aria-label="Vergleich deiner Antwort" aria-busy={pending}>
    <div className="study-comparison-heading"><span className="eyebrow">DEINE ERKLÄRUNG IM VERGLEICH</span><span className="study-comparison-source">{comparison.source === "llm" ? "KI-Kurzvergleich" : "Referenz zum Abgleichen"}</span></div>
    <div className="study-comparison-feedback" aria-live="polite" aria-atomic="true">
      {pending ? <p className="study-comparison-pending"><LoaderCircle size={14} className="animate-spin" aria-hidden="true" />Deine Erklärung wird kurz abgeglichen. Du kannst dich bereits selbst einschätzen.</p>
        : <><h3>{verdictTitles[comparison.verdict]}</h3><p>{comparison.summary}</p>
          {comparison.matched.length > 0 && <p><strong>Das passt schon:</strong> {comparison.matched.join("; ")}</p>}
          {comparison.missing.length > 0 && <p><strong>Das fehlt noch:</strong> {comparison.missing.join("; ")}</p>}
        </>}
    </div>
    {!pending && comparison.source === "reference" && onRetry && <Button type="button" variant="outline" onClick={onRetry}>Vergleich erneut versuchen</Button>}
    <div className="study-comparison-reference"><h3>Musterantwort in Kürze</h3><p>{referenceAnswer(comparison.reference, 360)}</p></div>
    <Collapsible className="study-reference-full"><CollapsibleTrigger asChild><Button type="button" variant="ghost">Vollständige Musterantwort<ChevronDown size={16} aria-hidden="true" /></Button></CollapsibleTrigger><CollapsibleContent><Markdown content={answer} linkTerms /></CollapsibleContent></Collapsible>
  </div>;
}
