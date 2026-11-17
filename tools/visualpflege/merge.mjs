// Merge graphic drafts into a freshly pulled snapshot. Writes a new snapshot file; never talks to the API.
// node --experimental-strip-types tools/visualpflege/merge.mjs <basis-pull.json> <nachher.json> <entwurf.json>...
// Entwurf: [{ id, content, status }] – only `content` and `updatedAt` of the note change.
// Rules: the base text must stay intact (every non-empty old line in order), every mermaid block
// must pass isAllowedDiagram, and script source fingerprints are carried along.
import { readFile, writeFile } from "node:fs/promises";
import { isAllowedDiagram } from "../../lib/brain/diagram.ts";
import { remapScriptSourceFingerprints } from "../../lib/brain/scripts.ts";
import { validateSnapshot } from "../lernpaket/skripte/snapshot.mjs";

// --textaenderung: wording may change (e.g. neutralising course references). Instead of "old text intact",
// mermaid blocks, media references and source lines (Aufzeichnung/Quelle) must stay identical; changed lines are logged.
const args = process.argv.slice(2);
const textMode = args.includes("--textaenderung");
const [baseFile, outFile, ...draftFiles] = args.filter(a => a !== "--textaenderung");
if (!baseFile || !outFile || !draftFiles.length) throw new Error("Aufruf: merge.mjs [--textaenderung] <basis-pull.json> <nachher.json> <entwurf.json>...");
const protectedParts = text => JSON.stringify([
  [...text.matchAll(/```mermaid\n[\s\S]*?```/g)].map(m => m[0]),
  [...text.matchAll(/\/api\/media\/[0-9a-f-]{36}/gi)].map(m => m[0]),
  // A recording reference: number, optional „title“, then the timestamp – never prose in between.
  [...text.matchAll(/Aufzeichnung(?:en)? \d+(?: „[^“\n]*“)? \[\d\d:\d\d\]/g)].map(m => m[0]),
]);
const changeLog = [];
const base = JSON.parse(await readFile(baseFile, "utf8"));
const before = base.workspace;
const now = new Date().toISOString();
const errors = [], changed = [];

function keepsOldText(oldText, newText) {
  const lines = newText.split("\n").map(l => l.trimEnd());
  let at = 0;
  for (const line of oldText.split("\n").map(l => l.trimEnd()).filter(Boolean)) {
    while (at < lines.length && lines[at] !== line) at++;
    if (at++ >= lines.length) return line;
  }
  return null;
}

const notes = before.notes.map(n => ({ ...n }));
const byId = new Map(notes.map(n => [n.id, n]));
for (const file of draftFiles) {
  for (const entry of JSON.parse(await readFile(file, "utf8"))) {
    const note = byId.get(entry.id);
    if (!note) { errors.push(`${file}: Notiz ${entry.id} fehlt im Basisstand`); continue; }
    if (entry.status !== "ergänzt" || entry.content === note.content) continue;
    if (textMode) {
      if (protectedParts(note.content) !== protectedParts(entry.content)) { errors.push(`„${note.title}“: Diagramme, Bildreferenzen oder Quellenangaben verändert`); continue; }
      const oldLines = new Set(note.content.split("\n")), newLines = new Set(entry.content.split("\n"));
      const removed = [...oldLines].filter(l => !newLines.has(l)), added = [...newLines].filter(l => !oldLines.has(l));
      changeLog.push(`## ${note.title} (${note.id})\n` + removed.map(l => "- " + l).join("\n") + "\n" + added.map(l => "+ " + l).join("\n"));
    } else {
      const missing = keepsOldText(note.content, entry.content);
      if (missing) { errors.push(`„${note.title}“: alter Text verändert oder entfernt: ${missing.slice(0, 80)}`); continue; }
    }
    const blocks = [...entry.content.matchAll(/```mermaid\n([\s\S]*?)```/g)].map(m => m[1]);
    const bad = blocks.filter(b => !isAllowedDiagram(b));
    if (bad.length) { errors.push(`„${note.title}“: ${bad.length} Diagramm(e) nicht zulässig`); continue; }
    if (entry.content.length > 80000) { errors.push(`„${note.title}“: Inhalt über 80.000 Zeichen`); continue; }
    note.content = entry.content;
    note.updatedAt = now;
    changed.push(note.title);
  }
}
if (errors.length) { console.error("NICHT zusammengeführt:\n- " + errors.join("\n- ")); process.exit(1); }

const after = remapScriptSourceFingerprints(before, { ...before, notes });
const result = { ...base, workspace: after };
validateSnapshot(result);
await writeFile(outFile, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
if (textMode) await writeFile(outFile.replace(/\.json$/, "") + "-aenderungen.md", changeLog.join("\n\n") + "\n", { flag: "wx" });
console.log(`${changed.length} Notizen zusammengeführt (Revision ${base.revision}) → ${outFile}`);
