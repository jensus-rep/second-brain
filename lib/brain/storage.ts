import { env } from "cloudflare:workers";
import { seedWorkspace } from "./seed";
import { workspaceSchema, type Workspace, type Snapshot } from "./model";

function database() {
  if (!env.DB) throw new Error("Die Wissensdatenbank ist nicht erreichbar.");
  return env.DB;
}
export async function readWorkspace(owner: string): Promise<Snapshot> {
  const db = database();
  await db.prepare("INSERT INTO brain_workspaces (owner_id, body, revision, updated_at) VALUES (?, ?, 0, ?) ON CONFLICT(owner_id) DO NOTHING")
    .bind(owner, JSON.stringify(seedWorkspace), new Date().toISOString()).run();
  const row = await db.prepare("SELECT body, revision FROM brain_workspaces WHERE owner_id = ?")
    .bind(owner).first<{ body: string; revision: number }>();
  if (!row) throw new Error("Die Wissenssammlung konnte nicht geladen werden.");
  return { workspace: workspaceSchema.parse(JSON.parse(row.body)), revision: row.revision };
}
export async function writeWorkspace(owner: string, workspace: Workspace, revision: number): Promise<Snapshot | null> {
  const result = await database().prepare("UPDATE brain_workspaces SET body = ?, revision = revision + 1, updated_at = ? WHERE owner_id = ? AND revision = ?")
    .bind(JSON.stringify(workspace), new Date().toISOString(), owner, revision).run();
  return result.meta.changes === 1 ? { workspace, revision: revision + 1 } : null;
}

