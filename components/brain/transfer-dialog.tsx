"use client";
import { useRef, useState } from "react";
import { Download, Upload, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { exportBackup, exportJson, prepareImport, readBackup, type ImportBundle } from "@/lib/brain/backup";
import type { Workspace } from "@/lib/brain/model";
import type { SaveWorkspace } from "@/lib/brain/use-brain";

export function TransferDialog({ open, setOpen, workspace, save, saving, onImported }: { open: boolean; setOpen: (open: boolean) => void; workspace: Workspace; save: SaveWorkspace; saving: boolean; onImported: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ImportBundle | null>(null);
  const [busy, setBusy] = useState(false);
  async function backup() { setBusy(true); try { await exportBackup(workspace); toast.success("Sicherung mit Bildern heruntergeladen."); } catch (e) { toast.error(e instanceof Error ? e.message : "Sicherung fehlgeschlagen."); } finally { setBusy(false); } }
  return <><Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent><DialogHeader><DialogTitle>Dein Wissen bleibt deins.</DialogTitle><DialogDescription>Notizen, Lernkarten, Lernfortschritte und Abbildungen gemeinsam sichern.</DialogDescription></DialogHeader>
    <div className="transfer-option"><Download /><div><h3>Vollständige Sicherung</h3><p>Eine ZIP-Datei mit deinem Wissen und allen hochgeladenen Bildern.</p><Button disabled={busy || saving} onClick={() => void backup()}>{busy && <LoaderCircle size={16} className="animate-spin" />}Sicherung herunterladen</Button><button className="text-action" disabled={busy} onClick={() => exportJson(workspace)}>Nur Wissensdaten als JSON</button><small>JSON enthält Bildverweise. Zum Übertragen auf eine andere Umgebung bitte ZIP verwenden.</small></div></div>
    <div className="transfer-option"><Upload /><div><h3>Sicherung wiederherstellen</h3><p>Der Import ersetzt deine aktuelle Sammlung nach Bestätigung.</p><Button variant="outline" disabled={busy || saving} onClick={() => input.current?.click()}>Datei auswählen</Button><input ref={input} className="sr-only" type="file" accept=".zip,.json" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; setBusy(true); try { setPending(await readBackup(file)); setOpen(false); } catch (error) { toast.error(error instanceof Error ? error.message : "Ungültige Sicherung."); } finally { setBusy(false); } }} /></div></div>
  </DialogContent></Dialog><AlertDialog open={!!pending} onOpenChange={value => { if (!value && !busy && !saving) setPending(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Sammlung ersetzen?</AlertDialogTitle><AlertDialogDescription>{pending?.workspace.notes.length} Notizen, {pending?.workspace.cards.length} Lernkarten und {pending?.assets.length} gesicherte Bilder werden übernommen. Dein aktueller Bestand wird ersetzt.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy || saving}>Abbrechen</AlertDialogCancel><Button variant="outline" disabled={busy || saving} onClick={() => void backup()}>Vorher sichern</Button><AlertDialogAction disabled={busy || saving} onClick={async event => { event.preventDefault(); if (!pending) return; setBusy(true); try { const restored = await prepareImport(pending); if (await save(() => restored, "Sammlung wiederhergestellt")) { setPending(null); onImported(); } } catch (error) { toast.error(error instanceof Error ? error.message : "Import fehlgeschlagen."); } finally { setBusy(false); } }}>{busy ? "Wird wiederhergestellt …" : "Sammlung ersetzen"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}

