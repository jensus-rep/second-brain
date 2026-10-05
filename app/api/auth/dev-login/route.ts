import { redirect } from "next/navigation";
import { devAutoLogin, safeReturnTo, startDevSession } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
// Development only: signs the browser in as the local test user. Returns 404 in production builds.
export async function GET(request: Request) {
  if (!devAutoLogin()) return new Response("Nicht gefunden", { status: 404 });
  await startDevSession();
  redirect(safeReturnTo(new URL(request.url).searchParams.get("return_to")));
}
