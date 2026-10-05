import { store } from "@/lib/server/store";
import { seedWorkspace } from "./seed";
import { workspaceSchema, type Workspace, type Snapshot } from "./model";

export async function readWorkspace(owner: string): Promise<Snapshot> {
  const db = await store();
  let row = await db.getWorkspace(owner);
  if (!row) {
    await db.createWorkspace(owner, JSON.stringify(seedWorkspace));
    row = await db.getWorkspace(owner);
  }
  if (!row) throw new Error("Die Wissenssammlung konnte nicht geladen werden.");
  return { workspace: workspaceSchema.parse(JSON.parse(row.body)), revision: row.revision };
}
export async function writeWorkspace(owner: string, workspace: Workspace, revision: number): Promise<Snapshot | null> {
  const saved = await (await store()).updateWorkspace(owner, JSON.stringify(workspace), revision);
  return saved ? { workspace, revision: revision + 1 } : null;
}
