import { isDeepStrictEqual } from "node:util";
import { workspaceSchema, MAX_WORKSPACE_BYTES } from "../../../lib/brain/model.ts";

// Defaults may add fields. Every value supplied by the caller must survive parsing.
function changedPaths(input, parsed, path = "workspace") {
  if (input === null || typeof input !== "object") return isDeepStrictEqual(input, parsed) ? [] : [path];
  if (parsed === null || typeof parsed !== "object" || Array.isArray(input) !== Array.isArray(parsed)) return [path];
  return Object.keys(input).flatMap(key => Object.hasOwn(parsed, key)
    ? changedPaths(input[key], parsed[key], `${path}.${key}`) : [`${path}.${key}`]);
}

export function validateSnapshot(snapshot) {
  if (!Number.isSafeInteger(snapshot?.revision) || snapshot.revision < 0) throw new Error("Snapshot braucht eine gültige Revision.");
  const result = workspaceSchema.safeParse(snapshot.workspace);
  if (!result.success) {
    const paths = result.error.issues.slice(0, 5).map(issue => issue.path.join(".") || "workspace");
    throw new Error(`Ungültige Wissensdaten. Betroffene Felder: ${paths.join(", ")}`);
  }
  const changed = changedPaths(snapshot.workspace, result.data);
  if (changed.length) throw new Error(`Schema würde Felder verwerfen oder Werte verändern: ${changed.slice(0, 5).join(", ")}`);
  const bytes = Buffer.byteLength(JSON.stringify(result.data), "utf8");
  if (bytes > MAX_WORKSPACE_BYTES) throw new Error(`Sammlung zu groß: ${bytes} von ${MAX_WORKSPACE_BYTES} Bytes.`);
  return { revision: snapshot.revision, workspace: result.data };
}
