import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AccessKeyRecord, Store, UserRecord } from "./store";

// Local development and browser tests only; production uses Azure SQL.
export function createSqliteStore(path: string): Store {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS newhope_users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS newhope_workspaces (owner_id TEXT PRIMARY KEY, body TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS newhope_media (owner_id TEXT NOT NULL, id TEXT NOT NULL, mime TEXT NOT NULL, bytes BLOB NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (owner_id, id));
    CREATE TABLE IF NOT EXISTS newhope_access_keys (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, key_hash TEXT NOT NULL UNIQUE, hint TEXT NOT NULL, created_at TEXT NOT NULL, last_used_at TEXT);`);
  const now = () => new Date().toISOString();
  type UserRow = { id: string; email: string; password_hash: string; created_at: string };
  const toUser = (row: unknown): UserRecord | null => {
    const r = row as UserRow | undefined;
    return r ? { id: r.id, email: r.email, passwordHash: r.password_hash, createdAt: r.created_at } : null;
  };
  type KeyRow = { id: string; owner_id: string; name: string; hint: string; created_at: string; last_used_at: string | null };
  const toKey = (row: unknown): AccessKeyRecord => {
    const r = row as KeyRow;
    return { id: r.id, ownerId: r.owner_id, name: r.name, hint: r.hint, createdAt: r.created_at, lastUsedAt: r.last_used_at };
  };
  const KEY_COLUMNS = "id, owner_id, name, hint, created_at, last_used_at";

  return {
    async getWorkspace(owner) {
      const row = db.prepare("SELECT body, revision FROM newhope_workspaces WHERE owner_id = ?").get(owner) as { body: string; revision: number } | undefined;
      return row ? { body: row.body, revision: Number(row.revision) } : null;
    },
    async getWorkspaceRevision(owner) {
      const row = db.prepare("SELECT revision FROM newhope_workspaces WHERE owner_id = ?").get(owner) as { revision: number } | undefined;
      return row ? Number(row.revision) : null;
    },
    async createWorkspace(owner, body) {
      db.prepare("INSERT INTO newhope_workspaces (owner_id, body, revision, updated_at) VALUES (?, ?, 0, ?) ON CONFLICT(owner_id) DO NOTHING").run(owner, body, now());
    },
    async updateWorkspace(owner, body, revision) {
      const result = db.prepare("UPDATE newhope_workspaces SET body = ?, revision = revision + 1, updated_at = ? WHERE owner_id = ? AND revision = ?").run(body, now(), owner, revision);
      return Number(result.changes) === 1;
    },
    async countUsers() {
      return Number((db.prepare("SELECT COUNT(*) AS n FROM newhope_users").get() as { n: number }).n);
    },
    async findUserByEmail(email) { return toUser(db.prepare("SELECT * FROM newhope_users WHERE email = ?").get(email)); },
    async findUserById(id) { return toUser(db.prepare("SELECT * FROM newhope_users WHERE id = ?").get(id)); },
    async createFirstUser(user) {
      const result = db.prepare("INSERT INTO newhope_users (id, email, password_hash, created_at) SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM newhope_users)")
        .run(user.id, user.email, user.passwordHash, user.createdAt);
      return Number(result.changes) === 1;
    },
    async putMedia(owner, id, media) {
      db.prepare("INSERT INTO newhope_media (owner_id, id, mime, bytes, created_at) VALUES (?, ?, ?, ?, ?)").run(owner, id, media.mime, media.bytes, now());
    },
    async getMedia(owner, id) {
      const row = db.prepare("SELECT mime, bytes FROM newhope_media WHERE owner_id = ? AND id = ?").get(owner, id) as { mime: string; bytes: Uint8Array } | undefined;
      return row ? { mime: row.mime, bytes: new Uint8Array(row.bytes) } : null;
    },
    async createAccessKey(key) {
      db.prepare("INSERT INTO newhope_access_keys (id, owner_id, name, key_hash, hint, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?, NULL)")
        .run(key.id, key.ownerId, key.name, key.hash, key.hint, key.createdAt);
    },
    async listAccessKeys(owner) {
      return db.prepare(`SELECT ${KEY_COLUMNS} FROM newhope_access_keys WHERE owner_id = ? ORDER BY created_at`).all(owner).map(toKey);
    },
    async findAccessKey(hash) {
      const row = db.prepare(`SELECT ${KEY_COLUMNS} FROM newhope_access_keys WHERE key_hash = ?`).get(hash);
      return row ? toKey(row) : null;
    },
    async touchAccessKey(id, at) {
      db.prepare("UPDATE newhope_access_keys SET last_used_at = ? WHERE id = ?").run(at, id);
    },
    async deleteAccessKey(owner, id) {
      return Number(db.prepare("DELETE FROM newhope_access_keys WHERE owner_id = ? AND id = ?").run(owner, id).changes) === 1;
    },
  };
}
