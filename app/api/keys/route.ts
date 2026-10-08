import { getSessionUser, sameOrigin } from "@/lib/server/auth";
import { store } from "@/lib/server/store";
import { MAX_ACCESS_KEYS, MAX_ACCESS_KEY_NAME, accessKeyName, newAccessKey } from "@/lib/server/access-keys";

// Managing keys requires the browser session; an access key alone is rejected here.
export const dynamic = "force-dynamic";
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET() {
  const user = await getSessionUser();
  if (!user) return response({ error: "Bitte melde dich erneut an." }, 401);
  try { return response({ keys: await (await store()).listAccessKeys(user.userId) }); }
  catch (error) { console.error("Access key list failed", error); return response({ error: "Zugangsschlüssel sind gerade nicht erreichbar." }, 503); }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return response({ error: "Bitte melde dich erneut an." }, 401);
  if (!sameOrigin(request)) return response({ error: "Ungültiger Ursprung." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return response({ error: "JSON erwartet." }, 415);
  let name: string | null = null;
  try { name = accessKeyName(((await request.json()) as { name?: unknown }).name); } catch { /* invalid JSON */ }
  if (!name) return response({ error: `Bitte einen Namen mit höchstens ${MAX_ACCESS_KEY_NAME} Zeichen angeben.` }, 400);
  try {
    const db = await store();
    if ((await db.listAccessKeys(user.userId)).length >= MAX_ACCESS_KEYS) return response({ error: `Höchstens ${MAX_ACCESS_KEYS} Zugangsschlüssel. Bitte zuerst einen widerrufen.` }, 409);
    const { key, hash, hint } = newAccessKey();
    const record = { id: crypto.randomUUID(), ownerId: user.userId, name, hint, createdAt: new Date().toISOString(), lastUsedAt: null };
    await db.createAccessKey({ ...record, hash });
    return response({ key: record, secret: key }, 201);
  } catch (error) { console.error("Access key create failed", error); return response({ error: "Zugangsschlüssel konnte nicht erzeugt werden." }, 503); }
}
