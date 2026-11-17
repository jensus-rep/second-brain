// Read-only visual audit of a pulled snapshot. Never talks to the API.
// Aufruf: node tools/visualpflege/audit.mjs <snapshot.json> [ausgabe-ordner]
// Schreibt bericht.md (für Menschen) und arbeitsliste.json (für Agenten).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, basename } from "node:path";

const [file, outArg] = process.argv.slice(2);
if (!file) throw new Error("Aufruf: node tools/visualpflege/audit.mjs <snapshot.json> [ausgabe-ordner]");
const snapshot = JSON.parse(await readFile(file, "utf8"));
const w = snapshot.workspace;
const outDir = resolve(outArg ?? ".data/exports/visualpflege-" + basename(file, ".json"));
// Entries deliberately without graphic (reason documented), see ausnahmen.json.
const exceptions = JSON.parse(await readFile(new URL("./ausnahmen.json", import.meta.url), "utf8")).notes;

// Same hash as lib/brain/scripts.ts scriptSourceFingerprint.
const fingerprint = note => {
  const text = note.title + "\n" + note.content;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
};

function visuals(markdown) {
  const mermaid = [...markdown.matchAll(/```mermaid\n([\s\S]*?)```/g)].map(m => m[1]);
  const images = [...markdown.matchAll(/!\[([^\]]*)\]\((\/api\/media\/[0-9a-f-]{36})/gi)];
  const foreignImages = [...markdown.matchAll(/!\[[^\]]*\]\((?!\/api\/media\/)([^)\s]+)/g)].map(m => m[1]);
  const tables = (markdown.match(/^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/gm) ?? []).length;
  const headings = (markdown.match(/^#{2,3} /gm) ?? []).length;
  const problems = [];
  for (const block of mermaid) {
    if (block.length > 12000) problems.push("Mermaid über 12.000 Zeichen");
    if (!/^\s*(flowchart|graph|sequenceDiagram|mindmap)\b/.test(block)) problems.push("Mermaid-Typ nicht freigeschaltet: " + block.trim().split(/\s/)[0]);
    if (/<[a-z]+[\s>]/i.test(block)) problems.push("HTML in Mermaid");
  }
  if (images.some(m => !m[1].trim())) problems.push("Bild ohne Alternativtext");
  if (foreignImages.length) problems.push("Bild nicht über /api/media: " + foreignImages.join(", "));
  return { mermaid: mermaid.length, images: images.length, tables, headings, chars: markdown.length, problems };
}

const topics = new Map(w.topics.map(t => [t.id, t]));
const topicPath = id => { const parts = []; let t = topics.get(id); while (t) { parts.unshift(t.title); t = topics.get(t.parentId); } return parts.join(" › ") || "(ohne Thema)"; };
const scripts = w.scripts ?? [];
const noteById = new Map(w.notes.map(n => [n.id, n]));
const inScripts = new Map();
for (const s of scripts) for (const c of s.chapters) for (const src of c.sources) inScripts.set(src.noteId, [...(inScripts.get(src.noteId) ?? []), s.title]);

const notes = w.notes.map(n => {
  const v = visuals(n.content);
  const graphic = v.mermaid + v.images;
  // Priority: long, structured notes without graphic first.
  const status = graphic ? "mit Grafik" : exceptions[n.id] ? "begründet ohne Grafik" : v.tables ? "nur Tabelle" : "ohne Grafik";
  const score = graphic || exceptions[n.id] ? 0 : Math.round(v.chars / 1000 + v.headings * 0.5 + (v.tables ? 0 : 2));
  return { id: n.id, title: n.title, topic: topicPath(n.topicId), topicId: n.topicId, archived: n.archived, status, score,
    ...v, scripts: inScripts.get(n.id) ?? [], cards: w.cards.filter(c => c.noteId === n.id).length };
}).sort((a, b) => b.score - a.score || a.topic.localeCompare(b.topic));

const chapters = scripts.flatMap(s => s.chapters.map(c => {
  const v = visuals(c.content);
  const stale = c.sources.filter(src => { const n = noteById.get(src.noteId); return !n || fingerprint(n) !== src.fingerprint; }).map(src => noteById.get(src.noteId)?.title ?? src.noteId + " (fehlt)");
  return { script: s.title, scriptId: s.id, chapterId: c.id, title: c.title, mermaid: v.mermaid, images: v.images, chars: v.chars, stale, problems: v.problems };
}));

// Topics (incl. subtopics) with notes but no script.
const scriptTopics = new Set(scripts.map(s => s.topicId));
const covers = (scriptTopic, topicId) => { let t = topics.get(topicId); while (t) { if (t.id === scriptTopic) return true; t = topics.get(t.parentId); } return false; };
const roots = w.topics.filter(t => !t.parentId);
const topicRows = roots.map(t => {
  const own = w.notes.filter(n => covers(t.id, n.topicId));
  const hasScript = scripts.some(s => s.topicId && (covers(s.topicId, t.id) || covers(t.id, s.topicId)));
  const covered = own.filter(n => inScripts.has(n.id)).length;
  const noGraphic = own.filter(n => ["ohne Grafik", "nur Tabelle"].includes(notes.find(x => x.id === n.id).status)).length;
  return { id: t.id, title: t.title, notes: own.length, inScripts: covered, hasScript, noGraphic };
}).sort((a, b) => b.notes - a.notes);

const count = s => notes.filter(n => n.status === s).length;
const lines = [];
lines.push(`# Visualpflege – Prüfbericht`, ``, `Snapshot: Revision ${snapshot.revision} · erstellt ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`, ``);
lines.push(`| Kennzahl | Wert |`, `| --- | --- |`,
  `| Notizen | ${notes.length} |`, `| mit Grafik (Mermaid oder Bild) | ${count("mit Grafik")} |`, `| begründet ohne Grafik | ${count("begründet ohne Grafik")} |`, `| nur Tabelle | ${count("nur Tabelle")} |`, `| ohne Grafik | ${count("ohne Grafik")} |`,
  `| Skripte | ${scripts.length} (${chapters.length} Kapitel) |`, `| Kapitel ohne Grafik | ${chapters.filter(c => !c.mermaid && !c.images).length} |`,
  `| Kapitel mit geänderten Quellen | ${chapters.filter(c => c.stale.length).length} |`, `| Notizen in keinem Skript | ${notes.filter(n => !n.scripts.length).length} |`, ``);
lines.push(`## 1. Notizen ohne Grafik (nach Priorität)`, ``, `| Prio | Notiz | Thema | Zeichen | Abschn. | Tabellen | Skript |`, `| --- | --- | --- | --- | --- | --- | --- |`);
for (const n of notes.filter(n => n.status === "ohne Grafik" || n.status === "nur Tabelle")) lines.push(`| ${n.score} | ${n.title} | ${n.topic} | ${n.chars} | ${n.headings} | ${n.tables} | ${n.scripts.length ? "ja" : "–"} |`);
lines.push(``, `## 2. Themen und Skriptabdeckung`, ``, `| Thema | Notizen | ohne Grafik | in Skript | Skript vorhanden |`, `| --- | --- | --- | --- | --- |`);
for (const t of topicRows) lines.push(`| ${t.title} | ${t.notes} | ${t.noGraphic} | ${t.inScripts} | ${t.hasScript ? "ja" : "**nein**"} |`);
lines.push(``, `## 3. Skriptkapitel`, ``, `| Skript | Kapitel | Mermaid | Bilder | geänderte Quellen |`, `| --- | --- | --- | --- | --- |`);
for (const c of chapters) lines.push(`| ${c.script} | ${c.title} | ${c.mermaid} | ${c.images} | ${c.stale.join("; ") || "–"} |`);
const problems = [...notes.filter(n => n.problems.length).map(n => `- Notiz „${n.title}“: ${n.problems.join("; ")}`), ...chapters.filter(c => c.problems.length).map(c => `- Kapitel „${c.title}“: ${c.problems.join("; ")}`)];
lines.push(``, `## 4. Technische Auffälligkeiten`, ``, ...(problems.length ? problems : ["Keine."]), ``);

await mkdir(outDir, { recursive: true });
await writeFile(resolve(outDir, "bericht.md"), lines.join("\n"));
await writeFile(resolve(outDir, "arbeitsliste.json"), JSON.stringify({ revision: snapshot.revision, notes, chapters, topics: topicRows }, null, 2));
console.log(`Notizen ${notes.length} · mit Grafik ${count("mit Grafik")} · nur Tabelle ${count("nur Tabelle")} · ohne Grafik ${count("ohne Grafik")} · Kapitel ohne Grafik ${chapters.filter(c => !c.mermaid && !c.images).length}/${chapters.length} · Themen ohne Skript ${topicRows.filter(t => t.notes && !t.hasScript).length}`);
console.log(`Bericht: ${outDir}`);
