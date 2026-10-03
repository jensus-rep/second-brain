import test from "node:test";
import assert from "node:assert/strict";
import { workspaceSchema, normalizeTags, searchNotes, pathProgress, reviewCard } from "../lib/brain/model.ts";
import { isAllowedDiagram } from "../lib/brain/diagram.ts";
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
test("old workspaces get cards without changing existing content", () => {
  const old = structuredClone(seedWorkspace); delete old.cards;
  assert.deepEqual(workspaceSchema.parse(old).cards, []);
  assert.equal(workspaceSchema.parse(old).notes.length, old.notes.length);
});
test("flashcards schedule atomically with stable UTC intervals", () => {
  const now = new Date("2026-10-03T12:00:00.000Z");
  let card = { id: "test-card", question: "Frage", answer: "Antwort", noteId: null, dueAt: now.toISOString(), intervalDays: 0, reviews: 0 };
  for (const interval of [1, 3, 7, 14, 30, 30]) {
    card = reviewCard(card, true, now);
    assert.equal(card.intervalDays, interval);
    assert.equal(Date.parse(card.dueAt) - now.getTime(), interval * 86400000);
  }
  card = reviewCard(card, false, now);
  assert.equal(card.reviews, 7);
  assert.equal(card.intervalDays, 0);
  assert.equal(card.dueAt, "2026-10-03T12:10:00.000Z");
  assert.equal(reviewCard(card, true, now).intervalDays, 1);
});
test("diagram boundary rejects network-capable image shapes and config", () => {
  assert.equal(isAllowedDiagram("flowchart LR\nA[Gedanke] --> B[Verstehen]"), true);
  assert.equal(isAllowedDiagram('flowchart LR\nA@{img: "https://example.com/pixel"}'), false);
  assert.equal(isAllowedDiagram('%%{init: {"securityLevel":"loose"}}%%\nflowchart LR\nA-->B'), false);
  assert.equal(isAllowedDiagram('flowchart LR\nA[<img src=x>]'), false);
});
