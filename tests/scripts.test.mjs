import test from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace, scriptSchema, workspaceSchema } from "../lib/brain/model.ts";
import { acknowledgeChapterSources, addScript, chapterFromNotes, chapterSourceState, editScript, newScript, remapScriptSourceFingerprints, removeScript, researchScriptProposal, saveScriptPosition, scriptMarkdown, scriptSourceFingerprint, searchScripts } from "../lib/brain/scripts.ts";
import { collectionItems } from "../lib/brain/learning-collections.ts";
import { validateSnapshot } from "../tools/lernpaket/skripte/snapshot.mjs";
import { mediaReferences } from "../lib/brain/media.ts";

const now = "2026-11-14T10:00:00.000Z";
const note = (id = "note-1", changes = {}) => ({ id, title: "Forschungsfrage", summary: "Eine Frage eingrenzen.", content: "## Verstehen\n\nEine offene Frage.", topicId: null, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: now, updatedAt: now, ...changes });
const script = () => ({ ...newScript("script-1", now), title: "Forschung planen", chapters: [chapterFromNotes("chapter-1", "Die Frage", [note()]), chapterFromNotes("chapter-2", "Die Methode", [])] });
const workspace = () => ({ ...structuredClone(emptyWorkspace), notes: [note()], scripts: [script()] });

test("old workspaces remain lossless and scripts round-trip with references and progress", () => {
  const old = structuredClone(emptyWorkspace);
  assert.deepEqual(workspaceSchema.parse(old), old);
  const data = saveScriptPosition(workspace(), "script-1", "chapter-2", 0.45, now);
  assert.deepEqual(workspaceSchema.parse(JSON.parse(JSON.stringify(data))), data);
  assert.deepEqual(validateSnapshot({ revision: 3, workspace: data }).workspace, data);
});

test("schema rejects duplicate script IDs, chapters, sources and invalid reading positions", () => {
  const data = workspace();
  assert.equal(workspaceSchema.safeParse({ ...data, scripts: [script(), script()] }).success, false);
  assert.equal(scriptSchema.safeParse({ ...script(), chapters: [script().chapters[0], script().chapters[0]] }).success, false);
  const duplicate = structuredClone(script()); duplicate.chapters[0].sources.push(duplicate.chapters[0].sources[0]);
  assert.equal(scriptSchema.safeParse(duplicate).success, false);
  assert.equal(scriptSchema.safeParse({ ...script(), readingPosition: { chapterId: "missing", offset: 0, updatedAt: now } }).success, false);
  assert.equal(scriptSchema.safeParse({ ...script(), readingPosition: { chapterId: "chapter-1", offset: 1.1, updatedAt: now } }).success, false);
  assert.equal(scriptSchema.safeParse({ ...script(), chapters: [] }).success, false);
});

test("workspace validates script topics and collection links while retaining missing source evidence", () => {
  assert.equal(workspaceSchema.safeParse({ ...workspace(), scripts: [{ ...script(), topicId: "missing" }] }).success, false);
  const collection = { id: "collection", title: "Research", description: "", noteIds: [], questionIds: [], cardIds: [], pathIds: [], scriptIds: ["script-1"] };
  const data = { ...workspace(), learningCollections: [collection] };
  assert.equal(workspaceSchema.safeParse(data).success, true);
  assert.equal(workspaceSchema.safeParse({ ...data, scripts: [] }).success, false);
  assert.equal(workspaceSchema.safeParse({ ...data, learningCollections: [{ ...collection, scriptIds: ["script-1", "script-1"] }] }).success, false);
  assert.equal(workspaceSchema.safeParse({ ...workspace(), notes: [] }).success, true);
  assert.equal(chapterSourceState(script().chapters[0], [])[0].state, "missing");
});

test("source changes are flagged without rewriting the chapter", () => {
  const chapter = script().chapters[0], before = structuredClone(chapter);
  assert.equal(chapterSourceState(chapter, [note()])[0].state, "current");
  assert.equal(chapterSourceState(chapter, [note("note-1", { content: "Geänderte Erklärung." })])[0].state, "changed");
  assert.equal(chapterSourceState(chapter, [note("note-1", { title: "Geänderter Titel" })])[0].state, "changed");
  assert.equal(chapterSourceState(chapter, [note("note-1", { updatedAt: "2026-11-15T10:00:00.000Z", favorite: true })])[0].state, "current");
  assert.equal(chapterSourceState(chapter, [note("note-1", { archived: true })])[0].state, "archived");
  assert.deepEqual(chapter, before);
});

test("acknowledging a reviewed source keeps authored text and rejects missing or archived notes", () => {
  const chapter = script().chapters[0];
  const changed = [note("note-1", { content: "Korrigierte Erklärung." })];
  const reviewed = acknowledgeChapterSources(chapter, changed);
  assert.equal(reviewed.content, chapter.content);
  assert.equal(chapterSourceState(reviewed, changed)[0].state, "current");
  assert.throws(() => acknowledgeChapterSources(chapter, []));
  assert.throws(() => acknowledgeChapterSources(chapter, [note("note-1", { archived: true })]));
});

test("reading progress preserves editorial dates and clamps unsafe offsets", () => {
  const data = workspace(), before = structuredClone(data);
  const result = saveScriptPosition(data, "script-1", "chapter-2", 2, "2026-11-14T11:00:00.000Z");
  assert.equal(result.scripts[0].readingPosition.offset, 1);
  assert.equal(result.scripts[0].updatedAt, now);
  assert.equal(result.scripts[0].readingPosition.chapterId, "chapter-2");
  assert.equal(saveScriptPosition(data, "script-1", "chapter-1", NaN, now).scripts[0].readingPosition.offset, 0);
  assert.throws(() => saveScriptPosition(data, "script-1", "missing"));
  assert.deepEqual(data, before);
});

test("editing preserves newer reading progress, detects concurrent editorial changes and clears removed chapters", () => {
  const original = script();
  const data = saveScriptPosition(workspace(), original.id, "chapter-2", 0.6, now);
  const result = editScript(data, original, { ...original, summary: "Neue Beschreibung" });
  assert.equal(result.scripts[0].readingPosition.offset, 0.6);
  assert.equal(result.scripts[0].summary, "Neue Beschreibung");
  assert.equal(editScript(data, original, { ...original, chapters: [original.chapters[0]] }).scripts[0].readingPosition, null);
  assert.throws(() => editScript({ ...data, scripts: [{ ...data.scripts[0], title: "Parallel geändert" }] }, original, original), /inzwischen geändert/);
  assert.throws(() => editScript({ ...data, scripts: [] }, original, original));
});

test("script deletion cleans collection membership without changing notes or learning state", () => {
  const collection = { id: "collection", title: "Research", description: "", noteIds: ["note-1"], questionIds: [], cardIds: [], pathIds: [], scriptIds: ["script-1"] };
  const data = { ...workspace(), learningCollections: [collection] }, before = structuredClone(data);
  assert.deepEqual(collectionItems(data, collection).scripts.map(script => script.id), ["script-1"]);
  const result = workspaceSchema.parse(removeScript(data, "script-1"));
  assert.deepEqual(result.scripts, []);
  assert.deepEqual(result.learningCollections[0].scriptIds, []);
  assert.deepEqual(result.notes, before.notes);
  assert.deepEqual(result.completedStepIds, before.completedStepIds);
  assert.deepEqual(data, before);
});

test("full-text search includes chapter text, tags and ancestor topics", () => {
  const topics = [{ id: "root", title: "Wissenschaft", description: "", color: "blue" }, { id: "child", title: "Methoden", description: "", color: "blue", parentId: "root" }];
  const item = { ...script(), topicId: "child", tags: ["lernen"] };
  assert.equal(searchScripts([item], "WISSENSCHAFT offene lernen", topics).length, 1);
  assert.equal(searchScripts([item], "nichtvorhanden", topics).length, 0);
});

test("compiling and exporting preserve code fences, sources and authored introductions", () => {
  const n = note("note-1", { content: "## Erklärung\n\n```text\n## Unverändert\n```\n\n~~~text\n# Ebenfalls unverändert\n~~~" });
  const chapter = chapterFromNotes("chapter", "Einstieg", [n], "Der rote Faden beginnt hier.");
  assert.ok(chapter.content.includes("#### Erklärung"));
  assert.ok(chapter.content.includes("```text\n## Unverändert\n```"));
  assert.ok(chapter.content.includes("~~~text\n# Ebenfalls unverändert\n~~~"));
  const text = scriptMarkdown({ ...script(), chapters: [chapter] }, [n]);
  assert.ok(text.includes("## 1. Einstieg"));
  assert.ok(text.includes("Der rote Faden beginnt hier."));
  assert.ok(text.includes("Verknüpfte Fachnotizen"));
  assert.equal(chapter.sources[0].fingerprint, scriptSourceFingerprint(n));
});

test("research proposal uses existing notes and source stamps without mutating or duplicating content", () => {
  const data = { ...workspace(), scripts: [], notes: [note("fm-note-forschungslogik"), note("fm-note-wa-forschungsfrage"), note("fm-note-quellen")] };
  const before = structuredClone(data), proposal = researchScriptProposal(data, now);
  assert.equal(proposal.chapters.length, 2);
  assert.deepEqual(proposal.chapters.flatMap(chapter => chapter.sources.map(source => source.noteId)), ["fm-note-forschungslogik", "fm-note-wa-forschungsfrage"]);
  assert.equal(scriptSchema.safeParse(proposal).success, true);
  assert.deepEqual(data, before);
  assert.equal(researchScriptProposal(addScript(data, proposal)), null);
  assert.equal(researchScriptProposal(emptyWorkspace), null);
  assert.throws(() => addScript(workspace(), script()), /bereits vorhanden/);
});

test("backup remapping updates matching stamps without concealing real source changes", () => {
  const oldUrl = "/api/media/11111111-1111-4111-8111-111111111111", newUrl = "/api/media/22222222-2222-4222-8222-222222222222";
  const source = note("note-1", { content: `![Abbildung](${oldUrl})` });
  const chapter = chapterFromNotes("chapter", "Bild", [source]);
  const before = { ...workspace(), notes: [source], scripts: [{ ...script(), chapters: [chapter] }] };
  const after = JSON.parse(JSON.stringify(before).replaceAll(oldUrl, newUrl));
  const restored = remapScriptSourceFingerprints(before, after);
  assert.equal(chapterSourceState(restored.scripts[0].chapters[0], restored.notes)[0].state, "current");
  assert.deepEqual(mediaReferences(restored), [newUrl]);
  const staleBefore = { ...before, notes: [{ ...source, content: source.content + "\nNeue Aussage" }] };
  const staleAfter = JSON.parse(JSON.stringify(staleBefore).replaceAll(oldUrl, newUrl));
  const stale = remapScriptSourceFingerprints(staleBefore, staleAfter);
  assert.equal(chapterSourceState(stale.scripts[0].chapters[0], stale.notes)[0].state, "changed");
});
