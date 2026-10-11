import { z } from "zod";
import { getSessionUser, sameOrigin } from "@/lib/server/auth";
import { readWorkspace } from "@/lib/brain/storage";
import { answerComparisonInputSchema } from "@/lib/brain/answer-comparison";
import { AnswerComparisonConflict, createAnswerComparisonRuntime } from "@/lib/server/answer-comparison";

export const dynamic = "force-dynamic";
const compare = createAnswerComparisonRuntime({ readWorkspace });
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
class RequestTooLarge extends Error {}

async function readInput(request: Request): Promise<string> {
  // 1500 Unicode characters plus the small metadata can exceed 1500 bytes.
  const maxBytes = 10_240;
  if (Number(request.headers.get("content-length")) > maxBytes) throw new RequestTooLarge();
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > maxBytes) throw new RequestTooLarge();
      chunks.push(next.value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export async function POST(request: Request) {
  // Personal access keys intentionally remain limited to the two data routes.
  const user = await getSessionUser();
  if (!user) return response({ error: "Bitte melde dich erneut an." }, 401);
  if (!sameOrigin(request)) return response({ error: "Ungültiger Ursprung." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return response({ error: "JSON erwartet." }, 415);
  try {
    const input = answerComparisonInputSchema.parse(JSON.parse(await readInput(request)));
    return response(await compare(user.userId, input));
  } catch (error) {
    if (error instanceof RequestTooLarge) return response({ error: "Die Anfrage ist zu groß." }, 413);
    if (error instanceof AnswerComparisonConflict) return response({ error: error.message, conflict: true }, 409);
    if (error instanceof SyntaxError || error instanceof z.ZodError) return response({ error: "Ungültige Anfrage zum Antwortvergleich." }, 400);
    return response({ error: "Der Antwortvergleich ist gerade nicht erreichbar. Vergleiche deine Erklärung mit der Musterantwort." }, 503);
  }
}
