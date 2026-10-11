import { z } from "zod";

const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const plain = (limit: number) => z.string().trim().min(1).max(limit).refine(value =>
  !/[\u0000-\u001f\u007f]/.test(value) && !/<\/?[a-z][^>]*>/i.test(value) &&
  !/\b(?:[a-z][a-z0-9+.-]*:\/\/|www\.|mailto:|javascript:|data:)/i.test(value), "Bitte einen kurzen Text ohne HTML oder Links verwenden.");

export const answerComparisonInputSchema = z.object({
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  sessionId: id, cardId: id, response: z.string().trim().min(1).max(1500),
}).strict();
export type AnswerComparisonInput = z.infer<typeof answerComparisonInputSchema>;

export const answerComparisonSchema = z.object({
  source: z.enum(["llm", "reference"]),
  verdict: z.enum(["aligned", "partial", "needs_revision", "unclear", "reference"]),
  summary: plain(300), matched: z.array(plain(140)).max(2), missing: z.array(plain(140)).max(2),
  reference: plain(700),
}).strict().superRefine((value, ctx) => {
  if (value.source === "reference" && (value.verdict !== "reference" || value.matched.length || value.missing.length) ||
    value.source === "llm" && value.verdict === "reference" || value.verdict === "aligned" && value.missing.length) {
    ctx.addIssue({ code: "custom", message: "Der Antwortvergleich enthält widersprüchliche Angaben." });
  }
});
export type AnswerComparison = z.infer<typeof answerComparisonSchema>;
export const answerComparisonResultSchema = z.object({
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), cardId: id,
  responseFingerprint: z.string().regex(/^[a-f0-9]{16}$/),
  source: z.enum(["llm", "reference"]),
  verdict: z.enum(["aligned", "partial", "needs_revision", "unclear", "reference"]),
  summary: plain(300), matched: z.array(plain(140)).max(2), missing: z.array(plain(140)).max(2), reference: plain(700),
}).strict().superRefine((value, ctx) => {
  const parsed = answerComparisonSchema.safeParse({ source: value.source, verdict: value.verdict,
    summary: value.summary, matched: value.matched, missing: value.missing, reference: value.reference });
  if (!parsed.success) for (const issue of parsed.error.issues) ctx.addIssue(issue);
});
export type AnswerComparisonResult = z.infer<typeof answerComparisonResultSchema>;

/** Change detection shared by browser and server; this is not an authenticity signature. */
export function answerResponseFingerprint(response: string): string {
  const text = response.trim();
  let first = 2166136261, second = 3339675911;
  for (let index = 0; index < text.length; index++) {
    first = Math.imul(first ^ text.charCodeAt(index), 16777619);
    second = Math.imul(second ^ text.charCodeAt(index), 2246822519);
  }
  return (first >>> 0).toString(16).padStart(8, "0") + (second >>> 0).toString(16).padStart(8, "0");
}

/** A bounded excerpt, never a lexical score or an invented semantic assessment. */
export function referenceAnswer(answer: string, maxLength = 700): string {
  const limit = Math.max(40, Math.min(700, Math.floor(maxLength) || 700));
  const text = answer
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<\/?[a-z][^>]*>/gi, " ")
    .replace(/\b(?:[a-z][a-z0-9+.-]*:\/\/|www\.|mailto:|javascript:|data:)\S+/gi, " ")
    .replace(/```[^\n]*\n|```/g, " ")
    .replace(/^\s{0,3}(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s*)/gm, "")
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_match, stars: string | undefined, underscores: string | undefined) => stars ?? underscores ?? "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|[.,;:]|$)/g, "$1$2")
    .replace(/[\u0000-\u001f\u007f\s]+/g, " ").trim();
  if (!text) return "Die Musterantwort enthält keinen kurzen Textauszug. Öffne die vollständige Antwort darunter.";
  if (text.length <= limit) return text;
  const cut = text.lastIndexOf(" ", limit - 2);
  return text.slice(0, cut >= limit / 2 ? cut : limit - 2).trimEnd() + " …";
}

export function referenceAnswerComparison(input: Pick<AnswerComparisonInput, "revision" | "cardId" | "response">, answer: string): AnswerComparisonResult {
  return answerComparisonResultSchema.parse({
    revision: input.revision, cardId: input.cardId, responseFingerprint: answerResponseFingerprint(input.response),
    source: "reference", verdict: "reference", matched: [], missing: [], reference: referenceAnswer(answer),
    summary: "Der kurze Vergleich ist gerade nicht verfügbar. Vergleiche deine Erklärung mit diesem Auszug aus der Musterantwort.",
  });
}

/** Only keep a comparison belonging to this response and this current source. */
export function comparisonForCardReview(result: unknown, cardId: string, response: string, answer: string): AnswerComparison | undefined {
  const parsed = answerComparisonResultSchema.safeParse(result);
  if (!response.trim() || response.trim().length > 1500 || !parsed.success || parsed.data.cardId !== cardId ||
    parsed.data.responseFingerprint !== answerResponseFingerprint(response) || parsed.data.reference !== referenceAnswer(answer)) return undefined;
  const value = parsed.data;
  return answerComparisonSchema.parse({ source: value.source, verdict: value.verdict, summary: value.summary,
    matched: value.matched, missing: value.missing, reference: value.reference });
}
