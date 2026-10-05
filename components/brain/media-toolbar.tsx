"use client";
import { useRef, useState } from "react";
import { ImagePlus, Network, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { imageMarkdown, uploadImage, MAX_IMAGE_BYTES } from "@/lib/brain/media";
export const DIAGRAM_TEMPLATE = "\n\n```mermaid\nflowchart TD\n  A[Gedanke] --> B[Verstehen]\n  B --> C[Anwenden]\n```\n";

export function MediaToolbar({ insert, onBusy }: { insert: (text: string) => void; onBusy?: (busy: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  async function addImage() {
    if (!pending || busy) return;
    setBusy(true); onBusy?.(true);
    try { const url = await uploadImage(pending); insert("\n\n" + imageMarkdown(url, alt, caption) + "\n"); setPending(null); setCaption(""); setAlt(""); toast.success("Abbildung eingefügt – jetzt die Notiz speichern."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Upload fehlgeschlagen."); }
    finally { setBusy(false); onBusy?.(false); }
  }
  return <div className="media-tools">
    <div className="media-toolbar"><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => input.current?.click()}><ImagePlus size={16} />Bild einfügen</Button><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => insert(DIAGRAM_TEMPLATE)}><Network size={16} />Diagramm einfügen</Button><input ref={input} className="sr-only" aria-label="Bilddatei auswählen" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; if (file.size > MAX_IMAGE_BYTES) { toast.error("Maximal 8 MB pro Bild."); return; } try { const bitmap = await createImageBitmap(file); const valid = bitmap.width * bitmap.height <= 24_000_000; bitmap.close(); if (!valid) throw new Error(); } catch { toast.error("Bitte ein gültiges Bild mit höchstens 24 Megapixeln auswählen."); return; } setPending(file); setAlt(file.name.replace(/\.[^.]+$/, "")); }} /></div>
    {pending && <div className="image-insert-form"><div className="image-file-name"><span>{pending.name}</span><Button type="button" variant="ghost" size="icon" disabled={busy} aria-label="Bildauswahl abbrechen" onClick={() => setPending(null)}><X size={15} /></Button></div><label>Bildbeschreibung<Input value={alt} onChange={e => setAlt(e.target.value)} maxLength={200} disabled={busy} placeholder="Was zeigt die Abbildung?" /></label><label>Bildunterschrift<Input value={caption} onChange={e => setCaption(e.target.value)} maxLength={300} disabled={busy} placeholder="Erklärung oder Quellenangabe (optional)" /></label><Button type="button" disabled={busy || !alt.trim()} onClick={() => void addImage()}>{busy && <LoaderCircle className="animate-spin" size={16} />}{busy ? "Wird hochgeladen …" : "Abbildung übernehmen"}</Button></div>}
  </div>;
}

