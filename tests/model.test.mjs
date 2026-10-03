import test from "node:test";
import assert from "node:assert/strict";
import { workspaceSchema, normalizeTags, searchNotes, pathProgress } from "../lib/brain/model.ts";
import { seedWorkspace } from "../lib/brain/seed.ts";
test("seed is a valid portable workspace with no fake learning progress", () => {
  assert.equal(workspaceSchema.parse(seedWorkspace).notes.length, 6);
  assert.deepEqual(seedWorkspace.completedStepIds, []);
});
test("imports reject duplicate IDs and broken references", () => {
  const duplicate = structuredClone(seedWorkspace);
  duplicate.notes.push(duplicate.notes[0]);
  assert.equal(workspaceSchema.safeParse(duplicate).success, false);
  const broken = structuredClone(seedWorkspace);
  broken.paths[0].steps[0].noteId = "missing";
  assert.equal(workspaceSchema.safeParse(broken).success, false);
  const progress = structuredClone(seedWorkspace);
  progress.completedStepIds = ["not-a-step"];
  assert.equal(workspaceSchema.safeParse(progress).success, false);
});
test("tags are normalized and full-text search combines words and topic names", () => {
  assert.deepEqual(normalizeTags(" Lernen, lernen, , Wissen "), ["lernen", "wissen"]);
  assert.equal(searchNotes(seedWorkspace.notes, "FUNdstelle eigenes")[0].id, "understand");
  assert.equal(searchNotes(seedWorkspace.notes, "wissensarbeit", seedWorkspace.topics).length, 2);
});
test("progress survives reordering and handles an empty path", () => {
  const path = structuredClone(seedWorkspace.paths[0]);
  const completed = [path.steps[0].id];
  path.steps.reverse();
  assert.deepEqual(pathProgress(path, completed), { done: 1, total: 6, percent: 17 });
  assert.deepEqual(pathProgress({ ...path, steps: [] }, []), { done: 0, total: 0, percent: 0 });
});

