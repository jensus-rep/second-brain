// Validate a snapshot with the app's own zod schema and size limit.
// node --experimental-strip-types tools/lernpaket/skripte/validate.mjs <nachher.json>
import { readFileSync } from "node:fs";
import { validateSnapshot } from "./snapshot.mjs";
import { MAX_WORKSPACE_BYTES } from "../../../lib/brain/model.ts";

try {
  if (process.argv.length !== 3) throw new Error("Aufruf: node --experimental-strip-types tools/lernpaket/skripte/validate.mjs <snapshot.json>");
  const snapshot = validateSnapshot(JSON.parse(readFileSync(process.argv[2], "utf8")));
  console.log(`gültig · ${Buffer.byteLength(JSON.stringify(snapshot.workspace), "utf8")} von ${MAX_WORKSPACE_BYTES} Bytes · keine verworfenen oder veränderten Eingabefelder`);
} catch (error) {
  console.error(error instanceof SyntaxError ? "UNGÜLTIG: Datei enthält kein gültiges JSON." : error.message);
  process.exitCode = 1;
}
