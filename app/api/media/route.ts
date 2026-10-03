import { getChatGPTUser } from "@/app/chatgpt-auth";
import { bucket, imageBytes, mediaKey } from "@/lib/brain/media-server";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Bitte melde dich erneut an." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Ungültiger Ursprung." }, { status: 403 });
  let image;
  try { image = await imageBytes(request); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Ungültiges Bild." }, { status: 400 }); }
  try {
    const id = crypto.randomUUID();
    await bucket().put(await mediaKey(user.userId, id), image.bytes, { httpMetadata: { contentType: image.mime } });
    return Response.json({ url: "/api/media/" + id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { console.error("Image upload failed", error); return Response.json({ error: "Bild konnte nicht gespeichert werden. Bitte erneut versuchen." }, { status: 503 }); }
}

