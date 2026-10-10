"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { emptyWorkspace, workspaceSchema, MAX_WORKSPACE_BYTES, type Snapshot, type Workspace } from "./model";
import { compactQuizRuns } from "./quiz";
import { createSaveQueue, type SaveOptions } from "./save-queue";

type SaveOperation = { update: (state: Workspace) => Workspace; message: string };

export function useBrain() {
  const [snapshot, setSnapshot] = useState<Snapshot>({ workspace: emptyWorkspace, revision: -1 });
  const current = useRef(snapshot);
  const [loading, setLoading] = useState(true);
  const loadingInProgress = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const unresolvedConflict = useRef(false);
  const performSave = useCallback(async ({ update, message }: SaveOperation) => {
    try {
      // Read the last confirmed revision only when this queued operation starts.
      const previous = current.current;
      // Every save trims older quiz runs, so stored runs shrink on the next save as well.
      // The previous state lets trimmed runs keep their wording when the bank changes.
      const workspace = workspaceSchema.parse(compactQuizRuns(update(previous.workspace), previous.workspace));
      const serialized = JSON.stringify(workspace);
      if (new TextEncoder().encode(serialized).length > MAX_WORKSPACE_BYTES) throw new Error("Deine Sammlung überschreitet 4 MB. Bitte sichere und verkleinere sie vor dem Speichern.");
      const response = await fetch("/api/brain", {
        method: "PUT", headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: `{"workspace":${serialized},"revision":${previous.revision}}`,
      });
      const data = await response.json() as Partial<Snapshot> & { error?: string };
      if (!response.ok) {
        if (response.status === 409) { unresolvedConflict.current = true; setConflict(true); }
        throw new Error(data.error);
      }
      if (data.revision !== previous.revision + 1) throw new Error("Der gespeicherte Stand konnte nicht bestätigt werden. Bitte lade den aktuellen Stand neu.");
      // The server validates the same submitted workspace. A revision-only
      // acknowledgement avoids downloading and parsing the collection again.
      const next = { workspace: data.workspace ? workspaceSchema.parse(data.workspace) : workspace, revision: data.revision };
      current.current = next; setSnapshot(next); setError("");
      if (message) toast.success(message); return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Speichern nicht möglich.";
      setError(message); toast.error(message); return false;
    }
  }, []);
  const [saveQueue] = useState(() => createSaveQueue<() => Promise<boolean>>(operation => operation(), setSaving));
  const load = useCallback(async () => {
    if (saveQueue.busy || loadingInProgress.current) return;
    loadingInProgress.current = true;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/brain", { cache: "no-store" });
      const data = await response.json() as Snapshot & { error?: string };
      if (!response.ok) throw new Error(data.error);
      const next = { workspace: workspaceSchema.parse(data.workspace), revision: data.revision };
      current.current = next; setSnapshot(next); unresolvedConflict.current = false; setConflict(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Laden nicht möglich."); }
    finally { loadingInProgress.current = false; setLoading(false); }
  }, [saveQueue]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    return () => { active = false; };
  }, [load]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (saveQueue.busy) event.preventDefault(); };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [saveQueue]);
  const save = useCallback((update: (state: Workspace) => Workspace, message = "Gespeichert", options: SaveOptions = {}) => {
    if (current.current.revision < 0 || unresolvedConflict.current || loadingInProgress.current) return Promise.resolve(false);
    return saveQueue.enqueue(() => performSave({ update, message }), options);
  }, [performSave, saveQueue]);
  return { ...snapshot, loading, saving, error, conflict, load, save };
}
export type SaveWorkspace = ReturnType<typeof useBrain>["save"];
