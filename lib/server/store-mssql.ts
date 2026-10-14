import sql from "mssql";
import type { AccessKeyRecord, MediaRow, Store, UserRecord } from "./store";

// Own tables next to the previous app's `second_brain_*` tables; those stay untouched.
const schema = `
IF OBJECT_ID(N'dbo.newhope_users', N'U') IS NULL
  CREATE TABLE dbo.newhope_users (
    id NVARCHAR(64) NOT NULL PRIMARY KEY,
    email NVARCHAR(320) NOT NULL CONSTRAINT newhope_users_email UNIQUE,
    password_hash NVARCHAR(400) NOT NULL,
    created_at NVARCHAR(40) NOT NULL);
IF OBJECT_ID(N'dbo.newhope_workspaces', N'U') IS NULL
  CREATE TABLE dbo.newhope_workspaces (
    owner_id NVARCHAR(64) NOT NULL PRIMARY KEY,
    body NVARCHAR(MAX) NOT NULL,
    revision INT NOT NULL,
    updated_at NVARCHAR(40) NOT NULL);
IF OBJECT_ID(N'dbo.newhope_media', N'U') IS NULL
  CREATE TABLE dbo.newhope_media (
    owner_id NVARCHAR(64) NOT NULL,
    id NVARCHAR(36) NOT NULL,
    mime NVARCHAR(40) NOT NULL,
    bytes VARBINARY(MAX) NOT NULL,
    created_at NVARCHAR(40) NOT NULL,
    CONSTRAINT newhope_media_pk PRIMARY KEY (owner_id, id));
IF OBJECT_ID(N'dbo.newhope_access_keys', N'U') IS NULL
  CREATE TABLE dbo.newhope_access_keys (
    id NVARCHAR(36) NOT NULL PRIMARY KEY,
    owner_id NVARCHAR(64) NOT NULL,
    name NVARCHAR(60) NOT NULL,
    key_hash NVARCHAR(64) NOT NULL CONSTRAINT newhope_access_keys_hash UNIQUE,
    hint NVARCHAR(4) NOT NULL,
    created_at NVARCHAR(40) NOT NULL,
    last_used_at NVARCHAR(40) NULL);`;

const flag = (value: string | undefined, fallback: boolean) => value === undefined ? fallback : ["1", "true", "yes"].includes(value.toLowerCase());
const now = () => new Date().toISOString();
const isDuplicate = (error: unknown) => typeof error === "object" && error !== null && [2627, 2601].includes((error as { number?: number }).number ?? 0);
type UserRow = { id: string; email: string; password_hash: string; created_at: string };
const toUser = (row: UserRow | undefined): UserRecord | null => row ? { id: row.id, email: row.email, passwordHash: row.password_hash, createdAt: row.created_at } : null;
type KeyRow = { id: string; owner_id: string; name: string; hint: string; created_at: string; last_used_at: string | null };
const toKey = (row: KeyRow): AccessKeyRecord => ({ id: row.id, ownerId: row.owner_id, name: row.name, hint: row.hint, createdAt: row.created_at, lastUsedAt: row.last_used_at });
const KEY_COLUMNS = "id, owner_id, name, hint, created_at, last_used_at";

export async function createMssqlStore(): Promise<Store> {
  const env = process.env;
  const pool = await new sql.ConnectionPool({
    server: env.AZURE_SQL_SERVER!.replace(/^tcp:/, "").replace(/,\d+$/, ""),
    database: env.AZURE_SQL_DATABASE,
    user: env.AZURE_SQL_USERNAME,
    password: env.AZURE_SQL_PASSWORD,
    port: Number(env.AZURE_SQL_PORT ?? 1433),
    connectionTimeout: Number(env.AZURE_SQL_CONNECTION_TIMEOUT ?? 30) * 1000,
    requestTimeout: 30000,
    pool: { max: 5, min: 0, idleTimeoutMillis: 60000 },
    options: { encrypt: flag(env.AZURE_SQL_ENCRYPT, true), trustServerCertificate: flag(env.AZURE_SQL_TRUST_SERVER_CERTIFICATE, false) },
  }).connect();
  await pool.request().batch(schema);
  const q = () => pool.request();

  return {
    async getWorkspace(owner) {
      const result = await q().input("owner", sql.NVarChar(64), owner).query<{ body: string; revision: number }>("SELECT body, revision FROM dbo.newhope_workspaces WHERE owner_id = @owner");
      return result.recordset[0] ?? null;
    },
    async getWorkspaceRevision(owner) {
      const result = await q().input("owner", sql.NVarChar(64), owner).query<{ revision: number }>("SELECT revision FROM dbo.newhope_workspaces WHERE owner_id = @owner");
      return result.recordset[0]?.revision ?? null;
    },
    async createWorkspace(owner, body) {
      try {
        await q().input("owner", sql.NVarChar(64), owner).input("body", sql.NVarChar(sql.MAX), body).input("at", sql.NVarChar(40), now())
          .query("IF NOT EXISTS (SELECT 1 FROM dbo.newhope_workspaces WHERE owner_id = @owner) INSERT INTO dbo.newhope_workspaces (owner_id, body, revision, updated_at) VALUES (@owner, @body, 0, @at)");
      } catch (error) { if (!isDuplicate(error)) throw error; }
    },
    async updateWorkspace(owner, body, revision) {
      const result = await q().input("owner", sql.NVarChar(64), owner).input("body", sql.NVarChar(sql.MAX), body).input("revision", sql.Int, revision).input("at", sql.NVarChar(40), now())
        .query("UPDATE dbo.newhope_workspaces SET body = @body, revision = revision + 1, updated_at = @at WHERE owner_id = @owner AND revision = @revision");
      return result.rowsAffected[0] === 1;
    },
    async countUsers() {
      const result = await q().query<{ n: number }>("SELECT COUNT(*) AS n FROM dbo.newhope_users");
      return result.recordset[0].n;
    },
    async findUserByEmail(email) {
      const result = await q().input("email", sql.NVarChar(320), email).query<UserRow>("SELECT id, email, password_hash, created_at FROM dbo.newhope_users WHERE email = @email");
      return toUser(result.recordset[0]);
    },
    async findUserById(id) {
      const result = await q().input("id", sql.NVarChar(64), id).query<UserRow>("SELECT id, email, password_hash, created_at FROM dbo.newhope_users WHERE id = @id");
      return toUser(result.recordset[0]);
    },
    async createFirstUser(user) {
      const transaction = new sql.Transaction(pool);
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      try {
        const existing = await new sql.Request(transaction).query<{ n: number }>("SELECT COUNT(*) AS n FROM dbo.newhope_users WITH (UPDLOCK, HOLDLOCK)");
        if (existing.recordset[0].n > 0) { await transaction.rollback(); return false; }
        await new sql.Request(transaction).input("id", sql.NVarChar(64), user.id).input("email", sql.NVarChar(320), user.email)
          .input("hash", sql.NVarChar(400), user.passwordHash).input("at", sql.NVarChar(40), user.createdAt)
          .query("INSERT INTO dbo.newhope_users (id, email, password_hash, created_at) VALUES (@id, @email, @hash, @at)");
        await transaction.commit();
        return true;
      } catch (error) { await transaction.rollback().catch(() => undefined); throw error; }
    },
    async putMedia(owner, id, media) {
      await q().input("owner", sql.NVarChar(64), owner).input("id", sql.NVarChar(36), id).input("mime", sql.NVarChar(40), media.mime)
        .input("bytes", sql.VarBinary(sql.MAX), Buffer.from(media.bytes)).input("at", sql.NVarChar(40), now())
        .query("INSERT INTO dbo.newhope_media (owner_id, id, mime, bytes, created_at) VALUES (@owner, @id, @mime, @bytes, @at)");
    },
    async getMedia(owner, id): Promise<MediaRow | null> {
      const result = await q().input("owner", sql.NVarChar(64), owner).input("id", sql.NVarChar(36), id).query<{ mime: string; bytes: Buffer }>("SELECT mime, bytes FROM dbo.newhope_media WHERE owner_id = @owner AND id = @id");
      const row = result.recordset[0];
      return row ? { mime: row.mime, bytes: new Uint8Array(row.bytes) } : null;
    },
    async createAccessKey(key) {
      await q().input("id", sql.NVarChar(36), key.id).input("owner", sql.NVarChar(64), key.ownerId).input("name", sql.NVarChar(60), key.name)
        .input("hash", sql.NVarChar(64), key.hash).input("hint", sql.NVarChar(4), key.hint).input("at", sql.NVarChar(40), key.createdAt)
        .query("INSERT INTO dbo.newhope_access_keys (id, owner_id, name, key_hash, hint, created_at, last_used_at) VALUES (@id, @owner, @name, @hash, @hint, @at, NULL)");
    },
    async listAccessKeys(owner) {
      const result = await q().input("owner", sql.NVarChar(64), owner).query<KeyRow>(`SELECT ${KEY_COLUMNS} FROM dbo.newhope_access_keys WHERE owner_id = @owner ORDER BY created_at`);
      return result.recordset.map(toKey);
    },
    async findAccessKey(hash) {
      const result = await q().input("hash", sql.NVarChar(64), hash).query<KeyRow>(`SELECT ${KEY_COLUMNS} FROM dbo.newhope_access_keys WHERE key_hash = @hash`);
      return result.recordset[0] ? toKey(result.recordset[0]) : null;
    },
    async touchAccessKey(id, at) {
      await q().input("id", sql.NVarChar(36), id).input("at", sql.NVarChar(40), at).query("UPDATE dbo.newhope_access_keys SET last_used_at = @at WHERE id = @id");
    },
    async deleteAccessKey(owner, id) {
      const result = await q().input("owner", sql.NVarChar(64), owner).input("id", sql.NVarChar(36), id).query("DELETE FROM dbo.newhope_access_keys WHERE owner_id = @owner AND id = @id");
      return result.rowsAffected[0] === 1;
    },
  };
}
