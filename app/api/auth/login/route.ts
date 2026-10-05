import { z } from "zod";
import { loginLocked, normalizeEmail, recordLogin, sameOrigin, startSession, verifyPassword } from "@/lib/server/auth";
import { store } from "@/lib/server/store";
export const dynamic = "force-dynamic";

const input = z.object({ email: z.string().max(320), password: z.string().min(1).max(500) });
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
// Used when the address is unknown so both paths take a comparable amount of time.
const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$" + "A".repeat(86);

export async function POST(request: Request) {
  if (!sameOrigin(request)) return response({ error: "Ungültiger Ursprung." }, 403);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return response({ error: "Bitte E-Mail-Adresse und Passwort eingeben." }, 400);
  const email = normalizeEmail(parsed.data.email);
  const client = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const key = email + "|" + client;
  if (loginLocked(key) || loginLocked(email)) return response({ error: "Zu viele Versuche. Bitte warte 15 Minuten." }, 429);
  try {
    const user = await (await store()).findUserByEmail(email);
    const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH) && !!user;
    recordLogin(key, valid);
    recordLogin(email, valid);
    if (!valid || !user) return response({ error: "E-Mail-Adresse oder Passwort ist falsch." }, 401);
    await startSession(user.id);
    return response({ ok: true });
  } catch (error) {
    console.error("Login failed", error);
    return response({ error: "Anmeldung gerade nicht möglich. Bitte versuche es erneut." }, 503);
  }
}
