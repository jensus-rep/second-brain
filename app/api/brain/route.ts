import { getChatGPTUser } from "@/app/chatgpt-auth";
import { readWorkspace, writeWorkspace } from "@/lib/brain/storage";
import { workspaceSchema, MAX_WORKSPACE_BYTES } from "@/lib/brain/model";
import { z } from "zod";

export const dynamic = "force-dynamic";
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return response({ error: "Bitte melde dich erneut an." }, 401);
  try { return response(await readWorkspace(user.userId)); }
  catch (error) { console.error("Workspace read failed", error); return response({ error: "Dein Wissen ist gerade nicht erreichbar. Bitte versuche es erneut." }, 503); }
}
export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return response({ error: "Bitte melde dich erneut an." }, 401);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return response({ error: "Ungültiger Ursprung." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return response({ error: "JSON erwartet." }, 415);
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_WORKSPACE_BYTES + 1000) return response({ error: "Die Sammlung ist zu groß (maximal 1,8 MB)." }, 413);
    const input = z.object({ revision: z.number().int().nonnegative(), workspace: workspaceSchema }).safeParse(JSON.parse(text));
    if (!input.success) return response({ error: input.error.issues[0]?.message ?? "Ungültige Daten." }, 400);
    if (new TextEncoder().encode(JSON.stringify(input.data.workspace)).length > MAX_WORKSPACE_BYTES) return response({ error: "Die Sammlung ist zu groß (maximal 1,8 MB)." }, 413);
    const saved = await writeWorkspace(user.userId, input.data.workspace, input.data.revision);
    if (!saved) return response({ error: "Die Sammlung wurde in einem anderen Fenster geändert. Deine Eingabe bleibt erhalten. Sichere sie und lade den aktuellen Stand neu.", conflict: true }, 409);
    return response(saved);
  } catch (error) {
    if (error instanceof SyntaxError) return response({ error: "Die Datei enthält kein gültiges JSON." }, 400);
    console.error("Workspace write failed", error);
    return response({ error: "Speichern nicht möglich. Deine Eingabe bleibt erhalten. Bitte versuche es erneut." }, 503);
  }
}
