"use client";
import { useEffect, useState } from "react";
import { Copy, KeyRound, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type AccessKey = { id: string; name: string; hint: string; createdAt: string; lastUsedAt: string | null };
const dateLabel = (value: string) => new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(value));
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { error?: string }).error ?? "Das hat nicht geklappt.");
  return body as T;
}

export function AccessKeysDialog({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const [keys, setKeys] = useState<AccessKey[] | null>(null);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) call<{ keys: AccessKey[] }>("/api/keys").then(body => setKeys(body.keys)).catch(error => toast.error(error.message));
  }, [open]);
  // The new key is shown only until the dialog closes.
  const change = (value: boolean) => { setOpen(value); if (!value) setSecret(null); };
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const body = await call<{ key: AccessKey; secret: string }>("/api/keys", { method: "POST", body: JSON.stringify({ name }) });
      setKeys(current => [...(current ?? []), body.key]); setSecret(body.secret); setName("");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Schlüssel konnte nicht erzeugt werden."); } finally { setBusy(false); }
  }
  async function revoke(key: AccessKey) {
    if (!window.confirm(`Zugangsschlüssel „${key.name}“ widerrufen? Werkzeuge mit diesem Schlüssel verlieren sofort den Zugriff.`)) return;
    setBusy(true);
    try { await call("/api/keys/" + key.id, { method: "DELETE" }); setKeys(current => (current ?? []).filter(k => k.id !== key.id)); toast.success("Zugangsschlüssel widerrufen."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Widerrufen fehlgeschlagen."); } finally { setBusy(false); }
  }
  async function copy() {
    if (!secret) return;
    try { await navigator.clipboard.writeText(secret); toast.success("Schlüssel kopiert."); } catch { toast.error("Kopieren nicht möglich. Bitte den Schlüssel markieren und kopieren."); }
  }
  return <Dialog open={open} onOpenChange={change}><DialogContent className="access-keys-dialog">
    <DialogHeader><DialogTitle>Zugangsschlüssel</DialogTitle><DialogDescription>Ein persönlicher Schlüssel erlaubt lokalen Werkzeugen, dein Wissen zu lesen und zu speichern. Schlüssel verwalten kannst du nur hier im angemeldeten Browser.</DialogDescription></DialogHeader>
    {secret && <section className="access-key-secret" aria-label="Neuer Zugangsschlüssel"><p><strong>Nur jetzt sichtbar.</strong> Kopiere den Schlüssel und bewahre ihn sicher auf; danach lässt er sich nicht mehr anzeigen.</p><div className="access-key-copy"><Input readOnly value={secret} aria-label="Neuer Schlüssel" onFocus={event => event.currentTarget.select()} /><Button type="button" onClick={() => void copy()}><Copy size={16} />Kopieren</Button></div></section>}
    <form className="access-key-form" onSubmit={create}><label className="field"><span>Name des Schlüssels</span><Input required maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder="z. B. Laptop – Lernkarten-Import" /></label><Button type="submit" disabled={busy || !name.trim() || (keys?.length ?? 0) >= 10}>{busy ? <LoaderCircle size={16} className="animate-spin" /> : <KeyRound size={16} />}Schlüssel erzeugen</Button></form>
    {keys === null ? <p className="small-note">Lädt …</p> : !keys.length ? <p className="small-note">Noch keine Zugangsschlüssel.</p> : <ul className="access-key-list">{keys.map(key => <li key={key.id}><div><strong>{key.name}</strong><small>endet auf …{key.hint} · erstellt {dateLabel(key.createdAt)} · {key.lastUsedAt ? "zuletzt genutzt " + dateLabel(key.lastUsedAt) : "noch nicht genutzt"}</small></div><Button variant="ghost" size="sm" disabled={busy} onClick={() => void revoke(key)} aria-label={"Widerrufen: " + key.name}><Trash2 size={16} />Widerrufen</Button></li>)}</ul>}
  </DialogContent></Dialog>;
}
