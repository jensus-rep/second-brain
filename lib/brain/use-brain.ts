"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { emptyWorkspace, workspaceSchema, MAX_WORKSPACE_BYTES, type Snapshot, type Workspace } from "./model";

export function useBrain() {
  const [snapshot, setSnapshot] = useState<Snapshot>({ workspace: emptyWorkspace, revision: -1 });
  const current = useRef(snapshot);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/brain", { cache: "no-store" });
      const data = await response.json() as Snapshot & { error?: string };
      if (!response.ok) throw new Error(data.error);
      const next = { workspace: workspaceSchema.parse(data.workspace), revision: data.revision };
      current.current = next; setSnapshot(next); setConflict(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Laden nicht möglich."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const save = useCallback(async (update: (state: Workspace) => Workspace, message = "Gespeichert") => {
    if (busy.current || current.current.revision < 0) return false;
    busy.current = true; setSaving(true);
    try {
      const workspace = workspaceSchema.parse(update(current.current.workspace));
      if (new TextEncoder().encode(JSON.stringify(workspace)).length > MAX_WORKSPACE_BYTES) throw new Error("Deine Sammlung überschreitet 1,8 MB. Bitte sichere und verkleinere sie vor dem Speichern.");
      const response = await fetch("/api/brain", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace, revision: current.current.revision }),
      });
      const data = await response.json() as Snapshot & { error?: string };
      if (!response.ok) { if (response.status === 409) setConflict(true); throw new Error(data.error); }
      const next = { workspace: workspaceSchema.parse(data.workspace), revision: data.revision };
      current.current = next; setSnapshot(next); setError("");
      toast.success(message); return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Speichern nicht möglich.";
      setError(message); toast.error(message); return false;
    } finally { busy.current = false; setSaving(false); }
  }, []);
  return { ...snapshot, loading, saving, error, conflict, load, save };
}
export type SaveWorkspace = ReturnType<typeof useBrain>["save"];
