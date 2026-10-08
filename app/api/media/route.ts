import { getApiUser, sameOrigin } from "@/lib/server/auth";
import { store } from "@/lib/server/store";
import { imageBytes } from "@/lib/brain/media-server";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Bitte melde dich erneut an." }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "Ungültiger Ursprung." }, { status: 403 });
  let image;
  try { image = await imageBytes(request); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Ungültiges Bild." }, { status: 400 }); }
  try {
    const id = crypto.randomUUID();
    await (await store()).putMedia(user.userId, id, image);
    return Response.json({ url: "/api/media/" + id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { console.error("Image upload failed", error); return Response.json({ error: "Bild konnte nicht gespeichert werden. Bitte erneut versuchen." }, { status: 503 }); }
}
