import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Atomic versioned snapshots prevent concurrent tabs from losing changes.
export const workspaces = sqliteTable("brain_workspaces", {
  ownerId: text("owner_id").primaryKey(),
  body: text("body").notNull(),
  revision: integer("revision").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

