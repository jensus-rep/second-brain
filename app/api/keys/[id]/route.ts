import { getSessionUser, sameOrigin } from "@/lib/server/auth";
import { store } from "@/lib/server/store";

export const dynamic = "force-dynamic";
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return response({ error: "Bitte melde dich erneut an." }, 401);
  if (!sameOrigin(request)) return response({ error: "Ungültiger Ursprung." }, 403);
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return response({ error: "Nicht gefunden." }, 404);
  try {
    if (!(await (await store()).deleteAccessKey(user.userId, id.toLowerCase()))) return response({ error: "Nicht gefunden." }, 404);
    return response({ ok: true });
  } catch (error) { console.error("Access key delete failed", error); return response({ error: "Zugangsschlüssel konnte nicht widerrufen werden." }, 503); }
}
