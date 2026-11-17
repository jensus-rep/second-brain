// Build a script from chapter frames and the notes of a snapshot, using the app's own chapterFromNotes.
// node --experimental-strip-types tools/visualpflege/build-script.mjs <basis.json> <nachher.json> <rahmen.json> --id <skript-id> --topic <topic-id> [--collection <sammlungs-id>]
// rahmen.json: { title, summary, tags, introduction, chapters: [{ id, title, introduction, noteIds, summarizedIds? }] }
// summarizedIds are linked as sources (change tracking) without copying their text into the chapter.
import { readFile, writeFile } from "node:fs/promises";
import { addScript, chapterFromNotes, scriptSourceFingerprint } from "../../lib/brain/scripts.ts";
import { scriptSchema } from "../../lib/brain/model.ts";
import { isAllowedDiagram } from "../../lib/brain/diagram.ts";
import { validateSnapshot } from "../lernpaket/skripte/snapshot.mjs";

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf("--" + name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const id = option("id"), topicId = option("topic"), collectionId = option("collection");
const [baseFile, outFile, frameFile] = args;
if (!baseFile || !outFile || !frameFile || !id || !topicId) throw new Error("Aufruf: build-script.mjs <basis.json> <nachher.json> <rahmen.json> --id <id> --topic <topic> [--collection <id>]");

const base = JSON.parse(await readFile(baseFile, "utf8"));
const frame = JSON.parse(await readFile(frameFile, "utf8"));
const w = base.workspace;
if (!w.topics.some(t => t.id === topicId)) throw new Error("Thema fehlt: " + topicId);
if (collectionId && !w.learningCollections.some(c => c.id === collectionId)) throw new Error("Lernsammlung fehlt: " + collectionId);
const notes = new Map(w.notes.map(n => [n.id, n]));
const pick = ids => ids.map(noteId => { const n = notes.get(noteId); if (!n) throw new Error("Notiz fehlt: " + noteId); return n; });

const now = new Date().toISOString();
const chapters = frame.chapters.map(c => {
  const chapter = chapterFromNotes(c.id, c.title, pick(c.noteIds), c.introduction);
  const summarized = pick(c.summarizedIds ?? []).map(n => ({ noteId: n.id, fingerprint: scriptSourceFingerprint(n) }));
  return { ...chapter, sources: [...summarized, ...chapter.sources] };
});
const script = scriptSchema.parse({ id, title: frame.title, summary: frame.summary, introduction: frame.introduction, topicId,
  tags: frame.tags, status: "ready", chapters, readingPosition: null, createdAt: now, updatedAt: now });
const diagrams = [script.introduction, ...chapters.map(c => c.content)].flatMap(t => [...t.matchAll(/```mermaid\n([\s\S]*?)```/g)].map(m => m[1]));
if (diagrams.some(d => !isAllowedDiagram(d))) throw new Error("Unzulässiges Diagramm im Skript.");

const result = { ...base, workspace: addScript(w, script, collectionId) };
validateSnapshot(result);
await writeFile(outFile, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
const size = JSON.stringify(script).length;
console.log(`Skript „${script.title}“ · ${chapters.length} Kapitel · ${chapters.reduce((a, c) => a + c.sources.length, 0)} Quellen · ${diagrams.length} Diagramme · ${size} Zeichen → ${outFile}`);
