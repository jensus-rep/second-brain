// Persistence for users, workspaces and images. Azure SQL in production, a local SQLite file otherwise.
export type UserRecord = { id: string; email: string; passwordHash: string; createdAt: string };
export type WorkspaceRow = { body: string; revision: number };
export type MediaRow = { mime: string; bytes: Uint8Array };

export interface Store {
  getWorkspace(owner: string): Promise<WorkspaceRow | null>;
  /** Inserts the initial body only when the owner has no workspace yet. */
  createWorkspace(owner: string, body: string): Promise<void>;
  /** Writes only when the stored revision still matches; returns false on conflict. */
  updateWorkspace(owner: string, body: string, revision: number): Promise<boolean>;
  countUsers(): Promise<number>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  /** Creates the first account atomically; returns false when an account already exists. */
  createFirstUser(user: UserRecord): Promise<boolean>;
  putMedia(owner: string, id: string, media: MediaRow): Promise<void>;
  getMedia(owner: string, id: string): Promise<MediaRow | null>;
}

const globalStore = globalThis as typeof globalThis & { newhopeStore?: Promise<Store> };

export function store(): Promise<Store> {
  globalStore.newhopeStore ??= createStore().catch(error => { globalStore.newhopeStore = undefined; throw error; });
  return globalStore.newhopeStore;
}

async function createStore(): Promise<Store> {
  if (process.env.AZURE_SQL_SERVER) return (await import("./store-mssql")).createMssqlStore();
  if (process.env.NODE_ENV === "production" && process.env.NEWHOPE_ALLOW_SQLITE !== "true") {
    throw new Error("AZURE_SQL_SERVER fehlt. Lokale SQLite-Speicherung ist in Produktion deaktiviert.");
  }
  return (await import("./store-sqlite")).createSqliteStore(process.env.NEWHOPE_SQLITE_PATH ?? ".data/newhope.sqlite");
}
