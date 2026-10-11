import { z } from "zod";
import { getSessionUser, sameOrigin } from "@/lib/server/auth";
import { readWorkspace } from "@/lib/brain/storage";
import { createTutorRuntime, tutorInputSchema, TutorRevisionConflict } from "@/lib/server/tutor-runtime";

export const dynamic = "force-dynamic";
const tutor = createTutorRuntime({ readWorkspace });
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
class RequestTooLarge extends Error {}

async function readInput(request: Request): Promise<string> {
  if (Number(request.headers.get("content-length")) > 1024) throw new RequestTooLarge();
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > 1024) throw new RequestTooLarge();
      chunks.push(next.value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export async function POST(request: Request) {
  // Personal access keys intentionally authenticate only /api/brain and /api/media.
  const user = await getSessionUser();
  if (!user) return response({ error: "Bitte melde dich erneut an." }, 401);
  if (!sameOrigin(request)) return response({ error: "Ungültiger Ursprung." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return response({ error: "JSON erwartet." }, 415);
  try {
    const text = await readInput(request);
    const input = tutorInputSchema.parse(JSON.parse(text));
    return response(await tutor(user.userId, input));
  } catch (error) {
    if (error instanceof RequestTooLarge) return response({ error: "Die Anfrage ist zu groß." }, 413);
    if (error instanceof TutorRevisionConflict) return response({ error: error.message, conflict: true }, 409);
    if (error instanceof SyntaxError || error instanceof z.ZodError) return response({ error: "Ungültige Tutor-Anfrage." }, 400);
    return response({ error: "Der Tutor ist gerade nicht erreichbar. Deine normalen Lernvorschläge bleiben verfügbar." }, 503);
  }
}
