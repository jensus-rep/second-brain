import { z } from "zod";
import { MIN_PASSWORD_LENGTH, hashPassword, loginLocked, normalizeEmail, recordLogin, sameOrigin, setupTokenMatches, startSession } from "@/lib/server/auth";
import { store } from "@/lib/server/store";
export const dynamic = "force-dynamic";

const input = z.object({
  token: z.string().max(500),
  email: z.string().trim().email("Bitte eine gültige E-Mail-Adresse eingeben.").max(320),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Das Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`).max(500),
});
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

// Creates the single owner account. Requires the one-time setup token from the server configuration.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return response({ error: "Ungültiger Ursprung." }, 403);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return response({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, 400);
  const client = "setup|" + (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (loginLocked(client) || loginLocked("setup")) return response({ error: "Zu viele Versuche. Bitte warte 15 Minuten." }, 429);
  if (!setupTokenMatches(parsed.data.token)) {
    recordLogin(client, false);
    recordLogin("setup", false);
    return response({ error: "Der Einrichtungscode ist ungültig." }, 403);
  }
  try {
    const db = await store();
    const created = await db.createFirstUser({ id: crypto.randomUUID(), email: normalizeEmail(parsed.data.email), passwordHash: await hashPassword(parsed.data.password), createdAt: new Date().toISOString() });
    if (!created) return response({ error: "Es gibt bereits ein Konto. Bitte melde dich an." }, 409);
    const user = await db.findUserByEmail(normalizeEmail(parsed.data.email));
    if (!user) throw new Error("Account missing after creation");
    await startSession(user.id);
    return response({ ok: true }, 201);
  } catch (error) {
    console.error("Setup failed", error);
    return response({ error: "Das Konto konnte nicht angelegt werden. Bitte versuche es erneut." }, 503);
  }
}
