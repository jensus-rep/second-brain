import { getApiUser } from "@/lib/server/auth";
import { store } from "@/lib/server/store";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return new Response("Nicht gefunden", { status: 404 });
  try {
    const media = await (await store()).getMedia(user.userId, id.toLowerCase());
    if (!media) return new Response("Nicht gefunden", { status: 404 });
    return new Response(Buffer.from(media.bytes), { headers: { "Content-Type": media.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'", "Cross-Origin-Resource-Policy": "same-origin" } });
  } catch (error) { console.error("Image read failed", error); return new Response("Bildspeicher nicht verfügbar", { status: 503 }); }
}
