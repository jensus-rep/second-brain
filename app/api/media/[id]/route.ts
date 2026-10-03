import { getChatGPTUser } from "@/app/chatgpt-auth";
import { bucket, mediaKey } from "@/lib/brain/media-server";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return new Response("Nicht gefunden", { status: 404 });
  try {
    const object = await bucket().get(await mediaKey(user.userId, id));
    if (!object) return new Response("Nicht gefunden", { status: 404 });
    return new Response(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'", "Cross-Origin-Resource-Policy": "same-origin" } });
  } catch { return new Response("Bildspeicher nicht verfügbar", { status: 503 }); }
}

