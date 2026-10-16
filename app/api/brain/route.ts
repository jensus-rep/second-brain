import { getApiUser, sameOrigin } from "@/lib/server/auth";
import { readWorkspace, writeWorkspace } from "@/lib/brain/storage";
import { workspaceSchema, MAX_WORKSPACE_BYTES } from "@/lib/brain/model";
import { z } from "zod";
import { gunzip } from "node:zlib";
import { promisify } from "node:util";

export const dynamic = "force-dynamic";
const response = (body: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store", ...headers } });
const MAX_BODY_BYTES = MAX_WORKSPACE_BYTES + 1000;
const gunzipAsync = promisify(gunzip);
class BodyTooLarge extends Error {}
class InvalidEncoding extends Error {}

// The app uploads gzip; access-key clients may send plain JSON. JSON never starts
// with the gzip magic bytes, so the body itself decides, whatever proxies do to headers.
async function readBody(request: Request): Promise<string> {
  const raw = new Uint8Array(await request.arrayBuffer());
  if (raw.byteLength > MAX_BODY_BYTES) throw new BodyTooLarge();
  if (raw[0] !== 0x1f || raw[1] !== 0x8b) return new TextDecoder().decode(raw);
  try { return new TextDecoder().decode(await gunzipAsync(raw, { maxOutputLength: MAX_BODY_BYTES })); }
  catch (error) { throw (error as { code?: string }).code === "ERR_BUFFER_TOO_LARGE" ? new BodyTooLarge() : new InvalidEncoding(); }
}
export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return response({ error: "Bitte melde dich erneut an." }, 401);
  try { return response(await readWorkspace(user.userId)); }
  catch (error) { console.error("Workspace read failed", error); return response({ error: "Dein Wissen ist gerade nicht erreichbar. Bitte versuche es erneut." }, 503); }
}
export async function PUT(request: Request) {
  const user = await getApiUser(request);
  if (!user) return response({ error: "Bitte melde dich erneut an." }, 401);
  if (!sameOrigin(request)) return response({ error: "Ungültiger Ursprung." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return response({ error: "JSON erwartet." }, 415);
  try {
    const text = await readBody(request);
    const input = z.object({ revision: z.number().int().nonnegative(), workspace: workspaceSchema }).safeParse(JSON.parse(text));
    if (!input.success) return response({ error: input.error.issues[0]?.message ?? "Ungültige Daten." }, 400);
    if (new TextEncoder().encode(JSON.stringify(input.data.workspace)).length > MAX_WORKSPACE_BYTES) return response({ error: "Die Sammlung ist zu groß (maximal 4 MB)." }, 413);
    const saved = await writeWorkspace(user.userId, input.data.workspace, input.data.revision);
    if (!saved) return response({ error: "Die Sammlung wurde in einem anderen Fenster geändert. Deine Eingabe bleibt erhalten. Sichere sie und lade den aktuellen Stand neu.", conflict: true }, 409);
    if (request.headers.get("prefer")?.split(",").some(preference => preference.trim().toLowerCase() === "return=minimal")) {
      return response({ revision: saved.revision }, 200, { "Preference-Applied": "return=minimal" });
    }
    return response(saved);
  } catch (error) {
    if (error instanceof BodyTooLarge) return response({ error: "Die Sammlung ist zu groß (maximal 4 MB)." }, 413);
    if (error instanceof InvalidEncoding) return response({ error: "Die komprimierten Daten sind beschädigt." }, 415);
    if (error instanceof SyntaxError) return response({ error: "Die Datei enthält kein gültiges JSON." }, 400);
    console.error("Workspace write failed", error);
    return response({ error: "Speichern nicht möglich. Deine Eingabe bleibt erhalten. Bitte versuche es erneut." }, 503);
  }
}
