import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getSessionUser, safeReturnTo } from "@/lib/server/auth";
import { store } from "@/lib/server/store";
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const returnTo = safeReturnTo((await searchParams).return_to);
  if (await getSessionUser()) redirect(returnTo);
  const setup = (await (await store()).countUsers()) === 0;
  return <main className="auth-page">
    <section className="auth-panel">
      <div className="brand auth-brand"><span className="brand-mark"><img src="/brand/second-brain-mark.png" alt="" width={39} height={39} /></span><span>Second Brain<span className="brand-sub">Wissensatelier</span></span></div>
      <h1>{setup ? "Dein Wissensraum wartet." : "Willkommen zurück."}</h1>
      <p>{setup ? "Lege das Konto für deinen privaten Wissensraum an. Den Einrichtungscode findest du in der Serverkonfiguration." : "Melde dich an, um mit deinem Wissen weiterzuarbeiten."}</p>
      <AuthForm mode={setup ? "setup" : "login"} returnTo={returnTo} />
    </section>
  </main>;
}
