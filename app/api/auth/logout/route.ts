import { endSession, sameOrigin } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Ungültiger Ursprung." }, { status: 403 });
  await endSession();
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
