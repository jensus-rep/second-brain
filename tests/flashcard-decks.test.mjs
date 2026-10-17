import test from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace, reviewCard, workspaceSchema } from "../lib/brain/model.ts";
import { activateFlashcardSession, flashcardSessionForCollection, resumableDeckSession } from "../lib/brain/flashcard-decks.ts";
import { recommendLearning } from "../lib/brain/learning-resume.ts";
import { startTutorSession, tutorSessionInsights } from "../lib/brain/tutor-session.ts";

const timestamp = "2026-10-17T08:00:00.000Z";
const later = new Date("2026-10-17T09:00:00.000Z");
const card = id => ({ id, noteId: null, question: `Frage ${id}`, answer: `Antwort ${id}`, reviews: 0, intervalDays: 0, dueAt: timestamp });
const collection = (id, cardIds) => ({ id, title: `Deck ${id}`, description: "", noteIds: [], questionIds: [], cardIds, pathIds: [] });
const fixture = () => ({
  ...structuredClone(emptyWorkspace), cards: ["a1", "a2", "shared", "b1", "b2", "outside"].map(card),
  learningCollections: [collection("a", ["a1", "shared", "a2"]), collection("b", ["b1", "shared", "b2"])],
});
const session = (id, collectionId, cardIds = ["a1", "shared", "a2"], index = 0) => ({
  id, collectionId, mode: "all", queue: cardIds.map(id => ({ id, reviews: 0, dueAt: timestamp })),
  index, startedAt: timestamp, updatedAt: timestamp,
});

test("legacy workspaces keep their exact shape and new rounds do not add an empty pool", () => {
  const data = fixture();
  const before = structuredClone(data);
  assert.deepEqual(workspaceSchema.parse(data), before);
  assert.equal(Object.hasOwn(workspaceSchema.parse(data), "pausedFlashcardSessions"), false);
  const started = activateFlashcardSession(data, session("round-a", "a"));
  assert.equal(Object.hasOwn(started, "pausedFlashcardSessions"), false);
  assert.deepEqual(data, before);
  assert.equal(flashcardSessionForCollection(data, "a"), null);
  assert.equal(resumableDeckSession(data, "a", later), null);
});

test("A to B to A preserves exact queues, modes and saved positions without changing learning evidence", () => {
  const a = session("round-a", "a", ["a2", "a1", "shared"], 1);
  const data = { ...fixture(), flashcardSession: a,
    cardReviewDays: [{ date: "2026-10-17", collectionId: "a", reviewed: 1, known: 1 }],
    tutorSession: { id: "guided", collectionId: "a", subject: null, concept: null, reason: "practice", cardIds: ["a1"], questionIds: [], startedAt: timestamp },
    learningFocus: { collectionId: "a", subject: null, updatedAt: timestamp },
  };
  const before = structuredClone(data);
  const b = session("round-b", "b", ["b2", "b1", "shared"], 2);
  const inB = activateFlashcardSession(data, b);
  assert.equal(inB.flashcardSession, b);
  assert.deepEqual(inB.pausedFlashcardSessions, [a]);
  assert.equal(flashcardSessionForCollection(inB, "a"), a);
  assert.equal(flashcardSessionForCollection(inB, "b"), b);
  const resumed = resumableDeckSession(inB, "a", later);
  assert.deepEqual(resumed, { ...a, updatedAt: later.toISOString() });
  const inA = activateFlashcardSession(inB, resumed);
  assert.deepEqual(inA.pausedFlashcardSessions, [b]);
  assert.deepEqual(inA.flashcardSession, resumed);
  assert.deepEqual(workspaceSchema.parse(JSON.parse(JSON.stringify(inA))), inA);
  for (const key of ["cards", "cardReviewDays", "tutorSession", "learningFocus"]) assert.equal(inA[key], data[key], key);
  assert.deepEqual(data, before);
});

test("shared cards reviewed in another deck are skipped using their original scheduling snapshot", () => {
  const a = session("round-a", "a", ["a1", "shared", "a2"], 1);
  let data = activateFlashcardSession({ ...fixture(), flashcardSession: a }, session("round-b", "b", ["shared", "b1", "b2"]));
  data = { ...data, cards: data.cards.map(item => item.id === "shared" ? reviewCard(item, true, later) : item) };
  const before = structuredClone(data);
  const resumed = resumableDeckSession(data, "a", later);
  assert.equal(resumed.id, a.id);
  assert.equal(resumed.queue, a.queue);
  assert.equal(resumed.index, 2);
  assert.equal(resumed.mode, a.mode);
  assert.deepEqual(data, before);
});

test("resuming checks current explicit and note-linked deck membership without expanding the queue", () => {
  const data = fixture();
  data.notes = [{ id: "linked", title: "Verknüpfte Notiz", summary: "", content: "", topicId: null, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: timestamp, updatedAt: timestamp }];
  data.cards = data.cards.map(item => item.id === "a2" ? { ...item, noteId: "linked" } : item);
  data.learningCollections = data.learningCollections.map(item => item.id === "a" ? { ...item, cardIds: ["a1"], noteIds: ["linked"] } : item);
  data.pausedFlashcardSessions = [session("round-a", "a", ["outside", "shared", "a2"])];
  const resumed = resumableDeckSession(data, "a", later);
  assert.equal(resumed.index, 2);
  assert.deepEqual(resumed.queue, data.pausedFlashcardSessions[0].queue);
  data.cards = data.cards.filter(item => item.id !== "a2");
  assert.equal(resumableDeckSession(data, "a", later), null);
});

test("missing decks never resume cards from the global bank while null remains its own scope", () => {
  const missing = session("missing-round", "removed-deck", ["outside"]);
  const global = session("global-round", null, ["outside"]);
  const data = { ...fixture(), flashcardSession: missing, pausedFlashcardSessions: [global] };
  assert.equal(flashcardSessionForCollection(data, "removed-deck"), missing);
  assert.equal(resumableDeckSession(data, "removed-deck", later), null);
  assert.equal(resumableDeckSession(data, "a", later), null);
  assert.deepEqual(resumableDeckSession(data, null, later), { ...global, updatedAt: later.toISOString() });
});

test("completed or fully stale rounds do not resume and completed active rounds are not paused", () => {
  const done = session("round-a", "a", ["a1"], 1);
  const data = { ...fixture(), flashcardSession: done };
  assert.equal(resumableDeckSession(data, "a", later), null);
  const next = activateFlashcardSession(data, session("round-b", "b", ["b1"]));
  assert.equal(Object.hasOwn(next, "pausedFlashcardSessions"), false);
  const stale = { ...data, flashcardSession: session("round-a", "a", ["a1"]), cards: data.cards.map(item => item.id === "a1" ? { ...item, dueAt: later.toISOString() } : item) };
  assert.equal(resumableDeckSession(stale, "a", later), null);
});

test("activation replaces the target deck and deduplicates an older paused snapshot of the outgoing deck", () => {
  const a = session("round-a", "a", ["a1", "a2"], 1);
  const data = { ...fixture(), flashcardSession: a, pausedFlashcardSessions: [
    session("old-a", "a", ["a1"]), session("old-b", "b", ["b1"]), session("global", null, ["outside"]),
  ] };
  const next = activateFlashcardSession(data, session("new-b", "b", ["b1", "b2"]));
  assert.deepEqual(next.pausedFlashcardSessions.map(item => item.id), ["global", "round-a"]);
  assert.equal(workspaceSchema.safeParse(next).success, true);
  assert.equal(flashcardSessionForCollection(data, "a"), a, "The active round wins even before a stale pool is repaired");
});

test("the model rejects duplicate pool IDs and deck scopes including null and active intersections", () => {
  const data = fixture();
  const a = session("round-a", "a");
  for (const paused of [
    [a, { ...a, collectionId: "b" }],
    [a, { ...a, id: "another-a" }],
    [session("global-1", null), session("global-2", null)],
  ]) assert.equal(workspaceSchema.safeParse({ ...data, pausedFlashcardSessions: paused }).success, false);
  for (const paused of [[{ ...a, collectionId: "b" }], [{ ...a, id: "another-a" }]]) {
    assert.equal(workspaceSchema.safeParse({ ...data, flashcardSession: a, pausedFlashcardSessions: paused }).success, false);
  }
  assert.equal(workspaceSchema.safeParse({ ...data, flashcardSession: a, pausedFlashcardSessions: [session("round-b", "b"), session("global", null)] }).success, true);
});

test("a full pool supports swaps but rejects new capacity without dropping another deck", () => {
  const pool = Array.from({ length: 100 }, (_, index) => session(`paused-${index}`, `deck-${index}`, ["outside"]));
  const data = { ...fixture(), flashcardSession: session("round-a", "a"), pausedFlashcardSessions: pool };
  const before = structuredClone(data);
  assert.equal(workspaceSchema.safeParse(data).success, true);
  assert.equal(workspaceSchema.safeParse({ ...data, pausedFlashcardSessions: [...pool, session("extra", "extra-deck")] }).success, false);
  assert.throws(() => activateFlashcardSession(data, session("new-b", "b", ["b1"])), /100 Kartenrunden/);
  assert.deepEqual(data, before);
  const swapped = activateFlashcardSession(data, pool[0]);
  assert.equal(swapped.pausedFlashcardSessions.length, 100);
  assert.equal(swapped.pausedFlashcardSessions.at(-1).id, "round-a");
  assert.equal(workspaceSchema.safeParse(swapped).success, true);
  assert.throws(() => activateFlashcardSession(data, { ...data.flashcardSession, collectionId: "b" }), /andere.*Lernsammlung/);
});

test("starting a tutor round removes an older saved round for its target deck without changing other decks", () => {
  const data = { ...fixture(), learningFocus: { collectionId: "a", subject: null, updatedAt: timestamp }, pausedFlashcardSessions: [
    session("old-a", "a", ["a1"], 0), session("saved-b", "b", ["b1", "b2"], 1),
  ] };
  const started = startTutorSession(data, recommendLearning(data, later.getTime()), "guided-a", later.getTime());
  assert.equal(started.flashcardSession.id, "guided-a");
  assert.deepEqual(started.pausedFlashcardSessions, [data.pausedFlashcardSessions[1]]);
  assert.equal(workspaceSchema.safeParse(started).success, true);
});

test("a parked tutor round can be continued after finishing another deck and selecting its original focus", () => {
  const data = { ...fixture(), learningFocus: { collectionId: "a", subject: null, updatedAt: timestamp } };
  const guided = startTutorSession(data, recommendLearning(data, later.getTime()), "guided-a", later.getTime());
  const inB = activateFlashcardSession(guided, session("round-b", "b", ["b1", "b2"]));
  const backToFocus = { ...inB, flashcardSession: null };
  const state = tutorSessionInsights(backToFocus, recommendLearning(backToFocus, later.getTime()), later.getTime());
  assert.equal(state.phase, "cards");
  assert.equal(state.action.kind, "resume-cards");
  assert.equal(state.action.sessionId, "guided-a");
  assert.equal(state.cardProgress.total, guided.tutorSession.cardIds.length);
});
