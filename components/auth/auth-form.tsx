"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthForm({ mode, returnTo }: { mode: "login" | "setup"; returnTo: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const setup = mode === "setup";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    if (setup && data.password !== data.confirm) { setError("Die Passwörter stimmen nicht überein."); return; }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(setup ? "/api/auth/setup" : "/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setup ? { token: data.token, email: data.email, password: data.password } : { email: data.email, password: data.password }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { setError(result.error ?? "Anmeldung nicht möglich."); return; }
      window.location.assign(returnTo);
    } catch { setError("Keine Verbindung. Bitte versuche es erneut."); }
    finally { setBusy(false); }
  }

  return <form className="auth-form" onSubmit={submit} noValidate>
    {setup && <label className="field"><span>Einrichtungscode</span><Input name="token" autoComplete="off" required /></label>}
    <label className="field"><span>E-Mail-Adresse</span><Input name="email" type="email" autoComplete="email" required autoFocus={!setup} /></label>
    <div className="field">
      <label className="field"><span>Passwort</span><Input name="password" type="password" autoComplete={setup ? "new-password" : "current-password"} required aria-describedby={setup ? "password-hint" : undefined} /></label>
      {setup && <small id="password-hint">Mindestens 12 Zeichen.</small>}
    </div>
    {setup && <label className="field"><span>Passwort wiederholen</span><Input name="confirm" type="password" autoComplete="new-password" required /></label>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    <Button type="submit" size="lg" disabled={busy}>{busy && <LoaderCircle size={16} className="animate-spin" />}{setup ? "Konto anlegen" : "Anmelden"}</Button>
  </form>;
}
