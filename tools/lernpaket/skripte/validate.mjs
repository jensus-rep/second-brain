// Validate a snapshot with the app's own zod schema and size limit.
// node --experimental-strip-types tools/lernpaket/skripte/validate.mjs <nachher.json>
import { readFileSync } from "node:fs";

const model = await import(new URL("../../../lib/brain/model.ts", import.meta.url).href);
const snapshot = JSON.parse(readFileSync(process.argv[2], "utf8"));
const result = model.workspaceSchema.safeParse(snapshot.workspace);
if (!result.success) {
  console.log("UNGÜLTIG:", JSON.stringify(result.error.issues.slice(0, 5), null, 1));
  process.exit(1);
}
const bytes = new TextEncoder().encode(JSON.stringify(result.data)).length;
// zod drops unknown keys; compare to catch silent loss
const dropped = JSON.stringify(snapshot.workspace).length - JSON.stringify(result.data).length;
console.log(`gültig · ${bytes} von ${model.MAX_WORKSPACE_BYTES} Bytes · Differenz durch verworfene Felder: ${dropped} Zeichen`);
if (bytes > model.MAX_WORKSPACE_BYTES) process.exit(1);
