import test from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace, workspaceSchema, cardReviewEventSchema } from "../lib/brain/model.ts";
import { recordCardReview } from "../lib/brain/learning-tutor.ts";
import { answerComparisonInputSchema, answerComparisonResultSchema, answerResponseFingerprint,
  referenceAnswer, referenceAnswerComparison, comparisonForCardReview } from "../lib/brain/answer-comparison.ts";
import { AnswerComparisonConflict, createAnswerComparisonRuntime } from "../lib/server/answer-comparison.ts";

const timestamp = "2026-10-11T10:00:00.000Z";
const card = (id = "card1", overrides = {}) => ({
  id, question: "Was unterscheidet ein Projekt von laufender Arbeit?",
  answer: "Ein Projekt ist ein zeitlich begrenztes Vorhaben mit einem eigenen Ziel. Laufende Arbeit wird dauerhaft wiederholt.",
  noteId: null, dueAt: timestamp, intervalDays: 0, reviews: 0, ...overrides,
});
const data = (overrides = {}) => workspaceSchema.parse({ ...structuredClone(emptyWorkspace), cards: [card(), card("other")],
  learningCollections: [{ id: "scope", title: "Projektarbeit", description: "", noteIds: [], questionIds: [], cardIds: ["card1"], pathIds: [] }],
  flashcardSession: { id: "session1", collectionId: "scope", mode: "all", queue: [{ id: "card1", reviews: 0, dueAt: timestamp }], index: 0, startedAt: timestamp, updatedAt: timestamp },
  ...overrides,
});
const input = { revision: 7, sessionId: "session1", cardId: "card1", response: "Ein Projekt hat einen Anfang und ein Ende." };
const selection = { verdict: "partial", summary: "Die zeitliche Begrenzung passt. Ergänze das eigene Ziel.",
  matched: ["Zeitlich begrenztes Vorhaben"], missing: ["Eigenes Ziel des Vorhabens"] };
const config = { endpoint: "https://test-resource.openai.azure.com/openai/v1/responses", apiKey: "synthetic-test-key", deployment: "gpt-6.1-sol" };
const envelope = (selected = selection, overrides = {}) => ({ status: "completed", error: null, incomplete_details: null,
  output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(selected) }] }], ...overrides });
const providerResponse = (selected = selection, overrides) => Response.json(envelope(selected, overrides));
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness({ workspace = data(), enabled = true, fetcher = async () => providerResponse(), timeoutMs, deployment = "gpt-6.1-sol" } = {}) {
  const state = { revision: 7, workspace, now: Date.parse(timestamp), calls: [], reads: [], enabled };
  const runtime = createAnswerComparisonRuntime({
    readWorkspace: async owner => { state.reads.push(owner); return { revision: state.revision, workspace: state.workspace }; },
    config: () => state.enabled ? { ...config, deployment } : null,
    fetch: async (...args) => { state.calls.push(args); return fetcher(...args); }, now: () => state.now, timeoutMs,
  });
  return { state, runtime };
}

test("bounded request contains only server revision, session, card and the learner's response", () => {
  assert.deepEqual(answerComparisonInputSchema.parse({ ...input, response: "  Eigene Antwort  " }), { ...input, response: "Eigene Antwort" });
  for (const value of [
    { ...input, revision: -1 }, { ...input, revision: .5 }, { ...input, revision: Number.MAX_SAFE_INTEGER + 1 },
    { ...input, response: " " }, { ...input, response: "x".repeat(1501) }, { ...input, cardId: "http://host" },
    { ...input, sessionId: "x".repeat(101) }, { ...input, owner: "other-owner" },
    { ...input, answer: "A forged model answer" }, { ...input, question: "A forged question" },
  ]) assert.equal(answerComparisonInputSchema.safeParse(value).success, false);
});

test("reference excerpts retain negation, units, comparisons and variable names without HTML or URLs", () => {
  const answer = "## Nettowert\n**Netto** ist nicht brutto. `p_total` < 10 EUR.\n- [Beleg](https://example.test)\n<div>Weitere Erklärung</div>";
  assert.equal(referenceAnswer(answer), "Nettowert Netto ist nicht brutto. p_total < 10 EUR. Beleg Weitere Erklärung");
  assert.ok(referenceAnswer("Eine fachliche Aussage. ".repeat(100)).length <= 700);
  assert.match(referenceAnswer("Eine fachliche Aussage. ".repeat(100)), / …$/);
  assert.ok(referenceAnswer("<img src='x'>https://example.test").length > 0);
});

test("fingerprint is browser-friendly and detects changed answers while normalizing boundary whitespace only", () => {
  assert.match(answerResponseFingerprint(input.response), /^[a-f0-9]{16}$/);
  assert.equal(answerResponseFingerprint(input.response), answerResponseFingerprint("  " + input.response + "  "));
  assert.notEqual(answerResponseFingerprint("Es ist begrenzt."), answerResponseFingerprint("Es ist nicht begrenzt."));
});

test("reference fallback makes no semantic claim even for identical wording and never changes progress", async () => {
  const { runtime, state } = harness({ enabled: false, fetcher: async () => { throw new Error("No external request allowed"); } });
  const before = structuredClone(state.workspace);
  const result = await runtime("owner", { ...input, response: card().answer });
  assert.equal(result.source, "reference"); assert.equal(result.verdict, "reference");
  assert.deepEqual(result.matched, []); assert.deepEqual(result.missing, []);
  assert.equal(result.reference, card().answer); assert.match(result.summary, /gerade nicht verfügbar/);
  assert.equal(state.calls.length, 0); assert.deepEqual(state.reads, ["owner", "owner"]);
  assert.deepEqual(state.workspace, before);
});

test("stale revision and a wrong or completed active queue never invoke the provider", async () => {
  const variants = [
    { input: { ...input, revision: 6 } }, { input: { ...input, sessionId: "another-session" } }, { input: { ...input, cardId: "other" } },
    { workspace: data({ flashcardSession: null }) },
    { workspace: data({ flashcardSession: { ...data().flashcardSession, index: 1 } }) },
    { workspace: data({ cards: [card("card1", { reviews: 1 }), card("other")] }) },
    { workspace: data({ cards: [card("card1", { dueAt: "2026-10-12T10:00:00.000Z" }), card("other")] }) },
    { workspace: data({ learningCollections: [{ ...data().learningCollections[0], cardIds: [] }] }) },
    { workspace: data({ cards: [] , learningCollections: [] }) },
  ];
  for (const variant of variants) {
    const { runtime, state } = harness(variant);
    await assert.rejects(runtime("owner", variant.input ?? input), AnswerComparisonConflict);
    assert.equal(state.calls.length, 0);
  }
});

test("deleted collection retains comparison for the exact original unchanged queued card", async () => {
  const { runtime } = harness({ workspace: data({ learningCollections: [] }), enabled: false });
  assert.equal((await runtime("owner", input)).source, "reference");
  await assert.rejects(runtime("owner", { ...input, cardId: "other" }), AnswerComparisonConflict);
});

test("Responses API sends only explicit question, reference and response with strict schema and no conversation", async () => {
  const { runtime, state } = harness({ workspace: data({ cards: [card(), card("other", { answer: "PRIVATE_OTHER_CARD" })],
    tutorPlan: { goal: "PRIVATE_PLAN", targetDate: null, weeklyDays: 3, updatedAt: timestamp } }) });
  const before = structuredClone(state.workspace);
  const result = await runtime("PRIVATE_OWNER", input);
  assert.equal(result.source, "llm"); assert.equal(result.verdict, "partial"); assert.deepEqual(result.missing, selection.missing);
  assert.equal(result.responseFingerprint, answerResponseFingerprint(input.response));
  assert.equal(result.reference, card().answer);
  const [url, request] = state.calls[0];
  assert.equal(url, config.endpoint); assert.equal(request.headers["api-key"], config.apiKey); assert.equal(request.redirect, "error");
  const body = JSON.parse(request.body);
  assert.equal(body.store, false); assert.equal(body.max_output_tokens, 1024); assert.deepEqual(body.reasoning, { effort: "low" });
  assert.deepEqual(JSON.parse(body.input), { question: card().question, model_answer: card().answer, learner_response: input.response });
  assert.equal(body.text.format.strict, true); assert.equal(body.text.format.schema.additionalProperties, false);
  assert.equal(Object.hasOwn(body.text.format.schema.properties.summary, "maxLength"), false, "Keep Azure-supported schema limits local");
  for (const field of ["tools", "temperature", "conversation", "previous_response_id"]) assert.equal(Object.hasOwn(body, field), false);
  assert.equal(request.body.includes("PRIVATE_"), false); assert.equal(request.body.includes("session1"), false);
  assert.match(body.instructions, /untrusted data/); assert.match(body.instructions, /Diktier/); assert.match(body.instructions, /Keine Prozentwerte/);
  assert.deepEqual(state.workspace, before);
});

test("custom deployments do not receive model-specific reasoning options", async () => {
  const { runtime, state } = harness({ deployment: "custom-deployment" });
  await runtime("owner", input);
  assert.equal(Object.hasOwn(JSON.parse(state.calls[0][1].body), "reasoning"), false);
});

test("equivalent phrasing, contradictory response and unclear response preserve the provider's bounded verdict", async () => {
  for (const selected of [
    { verdict: "aligned", summary: "Die zeitliche Begrenzung und das eigene Ziel passen.", matched: ["Zeitliche Begrenzung", "Eigenes Ziel"], missing: [] },
    { verdict: "needs_revision", summary: "Ein Projekt ist zeitlich begrenzt; eine dauerhafte Routine ist kein Projekt.", matched: [], missing: ["Zeitliche Begrenzung des Vorhabens"] },
    { verdict: "unclear", summary: "Aus dieser Antwort kann ich die Kernaussage noch nicht sicher erkennen.", matched: [], missing: [] },
  ]) {
    const { runtime } = harness({ fetcher: async () => providerResponse(selected) });
    assert.equal((await runtime("owner", input)).verdict, selected.verdict);
  }
});

test("invalid, contradictory, oversized, linked or HTML model statements degrade honestly to reference", async () => {
  for (const selected of [
    { ...selection, verdict: "reference" }, { ...selection, score: 100 }, { ...selection, summary: "x".repeat(301) },
    { ...selection, matched: ["a", "b", "c"] }, { ...selection, missing: ["x".repeat(141)] },
    { ...selection, summary: "<strong>Alles richtig</strong>" }, { ...selection, summary: "Siehe https://example.test" },
    { ...selection, matched: ["javascript:alert(1)"] }, { ...selection, summary: "Eine Antwort\nmit Steuerzeichen" },
    { ...selection, verdict: "aligned" }, { ...selection, summary: "" },
  ]) {
    const { runtime } = harness({ fetcher: async () => providerResponse(selected) });
    const result = await runtime("owner", input);
    assert.equal(result.source, "reference", JSON.stringify(selected)); assert.equal(result.verdict, "reference");
    assert.deepEqual(result.matched, []); assert.deepEqual(result.missing, []);
  }
});

test("refusal, incomplete envelopes, tool output and multiple output fragments never become an assessment", async () => {
  for (const overrides of [
    { status: "incomplete" }, { error: { message: "Provider error" } }, { incomplete_details: { reason: "max_output_tokens" } },
    { output: [{ type: "function_call", arguments: "{}" }] },
    { output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }] },
    { output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(selection) }, { type: "output_text", text: "{}" }] }] },
  ]) {
    const { runtime } = harness({ fetcher: async () => providerResponse(selection, overrides) });
    assert.equal((await runtime("owner", input)).source, "reference");
  }
});

test("provider errors and oversized body streams fall back without exposing error text", async () => {
  for (const fetcher of [
    async () => { throw new Error("secret connection diagnostic"); },
    async () => new Response("secret connection diagnostic", { status: 500 }),
    async () => new Response("{}", { headers: { "content-length": "40000" } }),
    async () => new Response("x".repeat(32769)), async () => new Response("not JSON"),
  ]) {
    const { runtime } = harness({ fetcher });
    const result = await runtime("owner", input);
    assert.equal(result.source, "reference"); assert.equal(JSON.stringify(result).includes("secret"), false);
  }
});

test("non-cooperative provider is stopped by a bounded timeout and its signal is aborted", async () => {
  let signal;
  const { runtime } = harness({ timeoutMs: 5, fetcher: async (_url, options) => { signal = options.signal; return new Promise(() => {}); } });
  const start = Date.now();
  assert.equal((await runtime("owner", input)).source, "reference");
  assert.equal(signal.aborted, true); assert.ok(Date.now() - start < 1000);
});

test("a revision changed during generation rejects even a valid comparison", async () => {
  const { runtime, state } = harness({ fetcher: async () => { state.revision++; return providerResponse(); } });
  await assert.rejects(runtime("owner", input), AnswerComparisonConflict);
  assert.equal(state.reads.length, 2);
});

test("changed active card, queue position or source wording during generation also invalidates comparison", async () => {
  for (const mutate of [
    state => { state.workspace = { ...state.workspace, flashcardSession: { ...state.workspace.flashcardSession, index: 1 } }; },
    state => { state.workspace = { ...state.workspace, cards: state.workspace.cards.map(item => item.id === "card1" ? { ...item, answer: "Changed source" } : item) }; },
    state => { state.workspace = { ...state.workspace, cards: state.workspace.cards.map(item => item.id === "card1" ? { ...item, question: "Changed question" } : item) }; },
  ]) {
    const { runtime, state } = harness({ fetcher: async () => { mutate(state); return providerResponse(); } });
    await assert.rejects(runtime("owner", input), AnswerComparisonConflict);
  }
});

test("identical in-flight requests coalesce and a cached result still validates current revision", async () => {
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const { runtime, state } = harness({ fetcher: async () => { await blocked; return providerResponse(); } });
  const first = runtime("owner", input), second = runtime("owner", input);
  await flush(); assert.equal(state.calls.length, 1); release();
  assert.deepEqual(await first, await second);
  assert.equal((await runtime("owner", input)).source, "llm"); assert.equal(state.calls.length, 1);
  state.revision = 8;
  await assert.rejects(runtime("owner", input), AnswerComparisonConflict); assert.equal(state.calls.length, 1);
});

test("fallback and cached comparisons check the revision again after their initial read", async () => {
  let reads = 0;
  const runtime = createAnswerComparisonRuntime({ config: () => null,
    readWorkspace: async () => ({ workspace: data(), revision: ++reads === 1 ? 7 : 8 }) });
  await assert.rejects(runtime("owner", input), AnswerComparisonConflict);
  const { runtime: cached, state } = harness();
  await cached("owner", input);
  const readCount = state.reads.length;
  state.reads.push = function (...owners) { const size = Array.prototype.push.apply(this, owners); if (size === readCount + 2) state.revision = 8; return size; };
  await assert.rejects(cached("owner", input), AnswerComparisonConflict);
  assert.equal(state.calls.length, 1);
});

test("caches are owner-scoped and bounded to twenty recent response hashes", async () => {
  const { runtime, state } = harness();
  for (let index = 0; index < 21; index++) await runtime("owner", { ...input, response: "Antwort " + index });
  assert.equal(state.calls.length, 21);
  await runtime("owner", { ...input, response: "Antwort 20" }); assert.equal(state.calls.length, 21);
  await runtime("owner", { ...input, response: "Antwort 0" }); assert.equal(state.calls.length, 22);
  await runtime("different-owner", { ...input, response: "Antwort 20" }); assert.equal(state.calls.length, 23);
  state.now += 120_001;
  await runtime("owner", { ...input, response: "Antwort 20" }); assert.equal(state.calls.length, 24);
});

test("an owner's sixty-call hourly budget does not evict its limit and cached replies remain usable", async () => {
  const { runtime, state } = harness();
  for (let index = 0; index < 60; index++) assert.equal((await runtime("owner", { ...input, response: "Antwort " + index })).source, "llm");
  assert.equal((await runtime("owner", { ...input, response: "Antwort 60" })).source, "reference");
  assert.equal((await runtime("owner", { ...input, response: "Antwort 59" })).source, "llm");
  assert.equal(state.calls.length, 60);
  state.now += 3_600_001;
  assert.equal((await runtime("owner", { ...input, response: "Antwort 60" })).source, "llm");
  assert.equal(state.calls.length, 61);
});

test("at most eight external comparisons run globally while a ninth owner receives honest reference", async () => {
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const { runtime, state } = harness({ fetcher: async () => { await blocked; return providerResponse(); } });
  const running = Array.from({ length: 8 }, (_, index) => runtime("owner-" + index, input));
  await flush(); assert.equal(state.calls.length, 8);
  assert.equal((await runtime("ninth-owner", input)).source, "reference"); assert.equal(state.calls.length, 8);
  release(); assert.ok((await Promise.all(running)).every(result => result.source === "llm"));
});

test("two distinct pending requests per owner are bounded without losing duplicate coalescing", async () => {
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const { runtime, state } = harness({ fetcher: async () => { await blocked; return providerResponse(); } });
  const first = runtime("owner", input), second = runtime("owner", { ...input, response: "Andere Erklärung" });
  await flush(); assert.equal(state.calls.length, 2);
  assert.equal((await runtime("owner", { ...input, response: "Dritte Erklärung" })).source, "reference");
  const duplicate = runtime("owner", input); await flush(); assert.equal(state.calls.length, 2);
  release(); await Promise.all([first, second, duplicate]);
});

test("owner capacity preserves active hourly limits and expired idle owners free capacity", async () => {
  const { runtime, state } = harness();
  for (let index = 0; index < 500; index++) await runtime("owner-" + index, input);
  assert.equal(state.calls.length, 500);
  assert.equal((await runtime("overflow-owner", input)).source, "reference"); assert.equal(state.calls.length, 500);
  state.now += 3_600_001;
  assert.equal((await runtime("overflow-owner", input)).source, "llm"); assert.equal(state.calls.length, 501);
});

test("comparison evidence persists with its exact own answer and keeps self-assessment independent", () => {
  const comparison = { ...referenceAnswerComparison(input, card().answer), ...selection, source: "llm" };
  const recorded = recordCardReview(data(), { collectionId: "scope", cardId: "card1", sessionId: "session1",
    response: input.response, comparison, known: true }, new Date(timestamp));
  const event = recorded.cardReviewEvents[0];
  assert.equal(event.response, input.response); assert.equal(event.comparison.verdict, "partial"); assert.equal(event.known, true);
  assert.equal(recorded.cardReviewDays[0].known, 1, "The comparison cannot change the explicit self-rating");
  assert.equal(recorded.cards[0].reviews, 0, "Only the caller's explicit scheduling update can move progress");
  assert.deepEqual(workspaceSchema.parse(recorded).cardReviewEvents[0].comparison, event.comparison);
});

test("edited answer, different card, changed reference and malformed comparison are not persisted", () => {
  const comparison = referenceAnswerComparison(input, card().answer);
  for (const result of [
    { ...comparison, responseFingerprint: answerResponseFingerprint("Other text") },
    { ...comparison, cardId: "other" }, { ...comparison, reference: "Another source" },
    { ...comparison, source: "llm", verdict: "reference" }, { ...comparison, summary: "<script>alert(1)</script>" },
  ]) {
    assert.equal(comparisonForCardReview(result, "card1", input.response, card().answer), undefined);
    const recorded = recordCardReview(data(), { collectionId: "scope", cardId: "card1", sessionId: "session1", known: false, response: input.response, comparison: result }, new Date(timestamp));
    assert.equal(recorded.cardReviewEvents[0].comparison, undefined);
  }
});

test("historical imports retain old review events but reject comparisons without their learner response", () => {
  const recorded = recordCardReview(data(), { collectionId: "scope", cardId: "card1", sessionId: "session1", known: true }, new Date(timestamp));
  assert.equal(cardReviewEventSchema.safeParse(recorded.cardReviewEvents[0]).success, true);
  const reference = comparisonForCardReview(referenceAnswerComparison(input, card().answer), "card1", input.response, card().answer);
  assert.equal(cardReviewEventSchema.safeParse({ ...recorded.cardReviewEvents[0], comparison: reference }).success, false);
  assert.equal(answerComparisonResultSchema.safeParse({ ...referenceAnswerComparison(input, card().answer), source: "llm" }).success, false);
});
