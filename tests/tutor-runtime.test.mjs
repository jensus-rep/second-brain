import test from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace, workspaceSchema } from "../lib/brain/model.ts";
import { recordCardReview } from "../lib/brain/learning-tutor.ts";
import { createTutorRuntime, tutorInputSchema, tutorLlmConfig, tutorRuntimePlan, TutorRevisionConflict } from "../lib/server/tutor-runtime.ts";

const timestamp = "2026-10-11T10:00:00.000Z";
const initialNow = Date.parse("2026-10-11T12:00:00.000Z");
const env = {
  NEWHOPE_TUTOR_LLM_ENABLED: "true", AZURE_OPENAI_ENDPOINT: "https://test-resource.openai.azure.com",
  AZURE_OPENAI_API_KEY: "mock-key-never-used-externally", AZURE_OPENAI_TUTOR_DEPLOYMENT: "gpt-6.1-sol",
};
const question = (id = "q1", overrides = {}) => ({
  id, subject: "Projektmanagement", concept: "Ziele", difficulty: 1, noteIds: ["n1"], prompt: "PRIVATE_QUESTION",
  options: [{ id: "yes", text: "PRIVATE_OPTION", feedback: "PRIVATE_FEEDBACK" }, { id: "no", text: "Andere Möglichkeit", feedback: "" }],
  correctOptionIds: ["yes"], explanation: "PRIVATE_EXPLANATION", source: "", ...overrides,
});
const note = () => ({ id: "n1", title: "PRIVATE_NOTE_TITLE", summary: "PRIVATE_NOTE_SUMMARY", content: "PRIVATE_NOTE_CONTENT", topicId: null, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: timestamp, updatedAt: timestamp });
const card = (id = "card1") => ({ id, question: "PRIVATE_CARD_QUESTION", answer: "PRIVATE_CARD_ANSWER", noteId: "n1", dueAt: timestamp, intervalDays: 0, reviews: 0 });
const collection = () => ({ id: "alpha", title: "Projektmanagement", description: "PRIVATE_DESCRIPTION", noteIds: ["n1"], questionIds: ["q1"], cardIds: [], pathIds: [] });
const workspace = (overrides = {}) => workspaceSchema.parse({
  ...structuredClone(emptyWorkspace), notes: [note()], cards: [card()], quizQuestions: [question()], learningCollections: [collection()],
  learningFocus: { collectionId: "alpha", subject: "Projektmanagement", updatedAt: timestamp },
  tutorPlan: { goal: "PRIVATE_GOAL", targetDate: null, weeklyDays: 3, updatedAt: timestamp }, ...overrides,
});
const input = { revision: 7, context: "overview" };
const llmEnvelope = (selection = { candidate_id: "c0", message: "Eine kurze Runde bringt dich wieder ins Lernen." }, overrides = {}) => ({
  status: "completed", error: null, incomplete_details: null,
  output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(selection) }] }], ...overrides,
});
const mockedResponse = (selection, overrides) => Response.json(llmEnvelope(selection, overrides));
function harness({ data = workspace(), enabled = true, fetcher = async () => mockedResponse(), timeoutMs, deployment = "gpt-6.1-sol" } = {}) {
  const state = { revision: 7, now: initialNow, reads: [], calls: [], data, enabled };
  const runtime = createTutorRuntime({
    readWorkspace: async owner => { state.reads.push(owner); return { workspace: state.data, revision: state.revision }; },
    config: () => state.enabled ? tutorLlmConfig({ ...env, AZURE_OPENAI_TUTOR_DEPLOYMENT: deployment }) : tutorLlmConfig({ ...env, NEWHOPE_TUTOR_LLM_ENABLED: "false" }),
    fetch: async (...args) => { state.calls.push(args); return fetcher(...args); },
    now: () => state.now, timeoutMs,
  });
  return { state, runtime };
}

test("Azure runtime requires an explicit opt-in and all server settings", () => {
  assert.equal(tutorLlmConfig({}), null);
  assert.equal(tutorLlmConfig({ ...env, NEWHOPE_TUTOR_LLM_ENABLED: undefined }), null);
  assert.equal(tutorLlmConfig({ ...env, NEWHOPE_TUTOR_LLM_ENABLED: "TRUE" }), null);
  for (const name of ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_TUTOR_DEPLOYMENT"]) assert.equal(tutorLlmConfig({ ...env, [name]: "" }), null);
  assert.deepEqual(tutorLlmConfig(env), { endpoint: "https://test-resource.openai.azure.com/openai/v1/responses", apiKey: env.AZURE_OPENAI_API_KEY, deployment: "gpt-6.1-sol" });
  assert.equal(tutorLlmConfig({ ...env, AZURE_OPENAI_ENDPOINT: "https://test-resource.services.ai.azure.com/openai/v1/" }).endpoint, "https://test-resource.services.ai.azure.com/openai/v1/responses");
});

test("endpoint validation forbids non-Azure hosts, credentials, query strings, paths and insecure protocols", () => {
  for (const endpoint of [
    "http://test-resource.openai.azure.com", "https://localhost", "https://127.0.0.1", "https://openai.azure.com",
    "https://test-resource.openai.azure.com.evil.example", "https://name:password@test-resource.openai.azure.com",
    "https://test-resource.openai.azure.com:8443", "https://test-resource.openai.azure.com/?key=x",
    "https://test-resource.openai.azure.com/#x", "https://test-resource.openai.azure.com/untrusted",
  ]) assert.equal(tutorLlmConfig({ ...env, AZURE_OPENAI_ENDPOINT: endpoint }), null, endpoint);
  assert.equal(tutorLlmConfig({ ...env, AZURE_OPENAI_API_KEY: "key\r\nother: header" }), null);
});

test("request validation accepts only a bounded revision and server-owned context selector", () => {
  assert.deepEqual(tutorInputSchema.parse(input), input);
  for (const invalid of [
    { ...input, revision: -1 }, { ...input, revision: 0.5 }, { ...input, revision: Number.MAX_SAFE_INTEGER + 1 },
    { ...input, owner: "other" }, { ...input, workspace: {} }, { ...input, context: "chat" },
    { ...input, sessionId: "x".repeat(101) }, { ...input, sessionId: "http://example.com" },
  ]) assert.equal(tutorInputSchema.safeParse(invalid).success, false);
});

test("disabled mode gives an immediate rule-based action without external calls or workspace mutation", async () => {
  const { runtime, state } = harness({ enabled: false, fetcher: async () => { throw new Error("External calls forbidden"); } });
  const before = structuredClone(state.data);
  const response = await runtime("owner-alpha", input);
  assert.equal(response.source, "rules");
  assert.equal(response.revision, 7);
  assert.equal(response.action.kind, "review-cards");
  assert.match(response.message, /Wiederholung/);
  assert.equal(state.calls.length, 0);
  assert.deepEqual(state.reads, ["owner-alpha", "owner-alpha"]);
  assert.deepEqual(state.data, before);
});

test("a stale initial revision never invokes the model", async () => {
  const { runtime, state } = harness();
  await assert.rejects(runtime("owner", { ...input, revision: 6 }), TutorRevisionConflict);
  assert.equal(state.calls.length, 0);
  assert.equal(state.reads.length, 1);
});

test("the model selects only a server-generated candidate and gets compact scoped evidence", async () => {
  const data = workspace({ quizQuestions: [question(), question("other-task", { subject: "PRIVATE_OTHER_SUBJECT", concept: "PRIVATE_OTHER_CONCEPT", noteIds: [] })] });
  const { runtime, state } = harness({ data, fetcher: async () => mockedResponse({ candidate_id: "c1", message: "Prüfe die Zusammenhänge kurz mit einer vorhandenen Aufgabe." }) });
  const response = await runtime("PRIVATE_OWNER_ID", input);
  assert.equal(response.source, "llm");
  assert.deepEqual(response.action, { collectionId: "alpha", kind: "checkpoint", subject: "Projektmanagement", questionCount: 1 });
  const [url, options] = state.calls[0];
  assert.equal(url, "https://test-resource.openai.azure.com/openai/v1/responses");
  assert.equal(options.headers["api-key"], env.AZURE_OPENAI_API_KEY);
  assert.equal(options.redirect, "error");
  const body = JSON.parse(options.body);
  assert.equal(body.model, "gpt-6.1-sol");
  assert.equal(body.store, false);
  assert.equal(body.max_output_tokens, 1024);
  assert.deepEqual(body.reasoning, { effort: "low" });
  assert.equal(body.text.format.strict, true);
  assert.deepEqual(body.text.format.schema.properties.candidate_id.enum, ["c0", "c1"]);
  assert.equal(Object.hasOwn(body, "tools"), false);
  assert.equal(Object.hasOwn(body, "temperature"), false);
  assert.equal(Object.hasOwn(body, "previous_response_id"), false);
  assert.equal(Object.hasOwn(body, "conversation"), false);
  assert.equal(options.body.includes("PRIVATE_"), false, "No note, answer, goal, task content, identity or unrelated scope is sent");
  assert.equal(options.body.includes('"alpha"'), false, "Internal collection IDs stay server-side");
  assert.equal(options.body.includes('"q1"'), false, "Internal question IDs stay server-side");
});

test("Azure schema compatibility preserves local text limits and avoids unsupported reasoning parameters on other deployments", async () => {
  for (const deployment of ["gpt-6.1-sol", "gpt-4.1", "custom-deployment"]) {
    const { runtime, state } = harness({ deployment, fetcher: async (_url, options) => {
      const body = JSON.parse(options.body);
      const messageSchema = body.text.format.schema.properties.message;
      assert.equal(Object.hasOwn(messageSchema, "maxLength"), false, "Azure's supported schema subset does not accept string length keywords");
      assert.equal(messageSchema.type, "string");
      assert.deepEqual(body.text.format.schema.required, ["candidate_id", "message"]);
      if (deployment === "gpt-6.1-sol") assert.deepEqual(body.reasoning, { effort: "low" });
      else assert.equal(Object.hasOwn(body, "reasoning"), false, "Unspecified deployments must not receive model-specific parameters");
      return mockedResponse({ candidate_id: "c0", message: "x".repeat(421) });
    } });
    const result = await runtime("owner", input);
    assert.equal(state.calls.length, 1);
    assert.equal(result.source, "rules", "The local length check still rejects an oversized provider response");
    assert.ok(result.message.length <= 420);
  }
});

test("unfinished quiz and card rounds remain the sole permissible overview candidate", async () => {
  const q = question();
  const activeQuiz = { id: "active-quiz", collectionId: "alpha", subject: q.subject, mode: "practice", startedAt: timestamp, deadlineAt: null, finishedAt: null, questions: [q], answers: [] };
  const activeCards = { id: "active-cards", collectionId: "alpha", mode: "due", queue: [{ id: "card1", reviews: 0, dueAt: timestamp }], index: 0, startedAt: timestamp, updatedAt: timestamp };
  for (const overrides of [{ quizRuns: [activeQuiz] }, { flashcardSession: activeCards }]) {
    const data = workspace(overrides);
    const plan = tutorRuntimePlan(data, input, initialNow);
    assert.equal(plan.candidates.length, 1);
    assert.match(plan.candidates[0].action.kind, /^resume-/);
    const { runtime } = harness({ data, fetcher: async () => mockedResponse({ candidate_id: "c1", message: "Starte etwas anderes." }) });
    assert.equal((await runtime("owner", input)).source, "rules", "An alternative candidate cannot bypass resuming");
  }
});

test("the learning overview includes a bounded honest trend, global rhythm and Berlin plan timing while omitting private content", async () => {
  const questions = [question(), question("q2")];
  const round = (id, finishedAt, correct) => ({
    id, collectionId: "alpha", subject: "Projektmanagement", mode: "practice", startedAt: finishedAt,
    finishedAt, deadlineAt: null, questions,
    answers: questions.map((q, index) => ({ questionId: q.id, selectedOptionIds: [index < correct ? "yes" : "no"], answeredAt: finishedAt, reflection: "PRIVATE_REFLECTION" })),
  });
  const unrelated = question("unrelated", { subject: "PRIVATE_OTHER_SUBJECT", concept: "PRIVATE_OTHER_CONCEPT", noteIds: [] });
  const data = workspace({
    quizQuestions: [...questions, unrelated], learningCollections: [{ ...collection(), questionIds: ["q1", "q2"] }],
    quizRuns: [
      round("PRIVATE_OLD_ROUND", "2026-10-10T10:00:00.000Z", 0),
      round("PRIVATE_PREVIOUS_DAY", "2026-10-11T10:00:00.000Z", 1),
      round("PRIVATE_PREVIOUS_ROUND", "2026-10-11T22:00:00.000Z", 2),
      round("PRIVATE_LATEST_ROUND", "2026-10-11T22:20:00.000Z", 1),
      { id: "PRIVATE_OTHER_ROUND", subject: unrelated.subject, mode: "practice", startedAt: "2026-10-11T22:25:00.000Z", finishedAt: "2026-10-11T22:25:00.000Z", deadlineAt: null, questions: [unrelated], answers: [] },
    ],
    tutorPlan: { goal: "PRIVATE_GOAL", targetDate: "2026-10-13", weeklyDays: 3, updatedAt: timestamp },
  });
  const { runtime, state } = harness({ data });
  state.now = Date.parse("2026-10-11T22:30:00.000Z");
  await runtime("PRIVATE_OWNER_ID", input);
  const outgoing = state.calls[0][1].body;
  const summary = JSON.parse(JSON.parse(outgoing).input);
  assert.deepEqual(summary.recentTests, [
    { correct: 1, total: 2, comparableChange: -50 },
    { correct: 2, total: 2, comparableChange: 50 },
    { correct: 1, total: 2, comparableChange: 50 },
  ], "Only the last three scoped rounds contribute; unrelated results cannot create a trend");
  assert.deepEqual(summary.globalLearningRhythm, { weeklyActiveDays: 1, currentStreak: 3 }, "Berlin Monday starts a fresh week without losing the actual learning streak");
  assert.deepEqual(summary.planTiming, { weeklyDays: 3, targetDate: "2026-10-13", daysRemaining: 1, weeklyRemaining: 2 }, "The target is tomorrow in Berlin although the UTC date is still Sunday");
  assert.equal(outgoing.includes("PRIVATE_"), false, "Aggregate context never exposes goal wording, reflections, run IDs or unrelated subjects");
  assert.equal(outgoing.includes('"q1"'), false);
  assert.equal(outgoing.includes('"q2"'), false);
  state.data.quizRuns[2].questions = [questions[0]];
  state.data.quizRuns[2].answers = state.data.quizRuns[2].answers.slice(0, 1);
  state.revision++;
  state.now += 30_000;
  await runtime("PRIVATE_OWNER_ID", { ...input, revision: state.revision });
  const changedSummary = JSON.parse(JSON.parse(state.calls[1][1].body).input);
  assert.equal(changedSummary.recentTests[1].comparableChange, null, "A changed task set cannot be presented as an improving comparable result");
});

test("card checkpoint uses only questions explicitly linked to the reviewed cards", async () => {
  let data = workspace({ cards: Array.from({ length: 5 }, (_, index) => card(`c${index}`)) });
  for (let index = 0; index < 5; index++) data = recordCardReview(data, { collectionId: "alpha", sessionId: "card-session", cardId: `c${index}`, known: index < 3 }, new Date(initialNow - 60_000 + index * 1000));
  const { runtime, state } = harness({ data });
  const response = await runtime("owner", { ...input, context: "cards", sessionId: "card-session" });
  assert.equal(response.source, "llm");
  assert.deepEqual(response.action.questionIds, ["q1"]);
  assert.equal(response.action.cardCheckpoint.sessionId, "card-session");
  const summary = JSON.parse(JSON.parse(state.calls[0][1].body).input);
  assert.equal(summary.reviewedCards, 5);
  assert.equal(summary.selfAssessedKnown, 3);
  assert.deepEqual(summary.concepts, ["Ziele"]);
  assert.deepEqual(summary.planTiming, { weeklyDays: 3, targetDate: null, daysRemaining: null, weeklyRemaining: 2 });
  assert.equal(Object.hasOwn(summary, "recentTests"), false, "The card invitation keeps only evidence from the reviewed cards");
  assert.equal(Object.hasOwn(summary, "globalLearningRhythm"), false);
  assert.equal(state.calls[0][1].body.includes("PRIVATE_"), false);
  assert.equal(state.calls[0][1].body.includes("card-session"), false);
  const absent = await runtime("owner", { ...input, context: "cards", sessionId: "unknown-session" });
  assert.equal(absent.source, "rules");
  assert.equal(absent.action, null);
  assert.equal(state.calls.length, 1, "No external call without a permissible checkpoint");
});

test("refusal, incomplete output, malformed JSON, invented actions and unsupported claims fall back safely", async () => {
  const invalid = [
    Response.json(llmEnvelope(undefined, { status: "incomplete" })),
    Response.json(llmEnvelope(undefined, { error: { message: "PRIVATE_ERROR" } })),
    Response.json(llmEnvelope(undefined, { incomplete_details: { reason: "max_output_tokens" } })),
    Response.json(llmEnvelope(undefined, { output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }] })),
    Response.json(llmEnvelope(undefined, { output: [{ type: "function_call", name: "write_workspace" }] })),
    Response.json(llmEnvelope(undefined, { output: [{ type: "message", content: [{ type: "output_text", text: "not json" }] }] })),
    mockedResponse({ candidate_id: "invented-action", message: "Ein erfundener Schritt." }),
    mockedResponse({ candidate_id: "c0", message: "x".repeat(421) }),
    mockedResponse({ candidate_id: "c0", message: "<script>unsafe</script>" }),
    mockedResponse({ candidate_id: "c0", message: "Öffne https://external.example" }),
    mockedResponse({ candidate_id: "c0", message: "Du beherrschst das Fachthema vollständig." }),
    mockedResponse({ candidate_id: "c0", message: "Schritt", action: { kind: "delete" } }),
    new Response("PRIVATE_ERROR", { status: 429 }),
    new Response("x".repeat(32_769)),
  ];
  for (const externalResponse of invalid) {
    const { runtime, state } = harness({ fetcher: async () => externalResponse });
    const before = structuredClone(state.data);
    const result = await runtime("owner", input);
    assert.equal(result.source, "rules");
    assert.equal(result.message.includes("PRIVATE_"), false);
    assert.deepEqual(state.data, before);
  }
});

test("timeout and transport failures return ordinary suggestions with no retry", async () => {
  const never = new Promise(() => {});
  const slow = harness({ fetcher: async () => never, timeoutMs: 20 });
  assert.equal((await slow.runtime("owner", input)).source, "rules");
  assert.equal(slow.state.calls.length, 1);
  assert.equal(slow.state.calls[0][1].signal.aborted, true);
  const failed = harness({ fetcher: async () => { throw new Error("PRIVATE_NETWORK_ERROR"); } });
  assert.equal((await failed.runtime("owner", input)).source, "rules");
  assert.equal(failed.state.calls.length, 1);
});

test("revision changes during generation invalidate the advisory instead of publishing stale state", async () => {
  let release;
  const deferred = new Promise(resolve => { release = resolve; });
  const { runtime, state } = harness({ fetcher: async () => deferred });
  const operation = runtime("owner", input);
  await new Promise(resolve => setTimeout(resolve, 0));
  state.revision = 8;
  release(mockedResponse());
  await assert.rejects(operation, TutorRevisionConflict);
  assert.equal(state.calls.length, 1);
});

test("identical owner requests are coalesced and cached; another owner gets an independent result", async () => {
  let release;
  const deferred = new Promise(resolve => { release = resolve; });
  const { runtime, state } = harness({ fetcher: async () => { await deferred; return mockedResponse(); } });
  const first = runtime("owner-a", input);
  const second = runtime("owner-a", input);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(state.calls.length, 1);
  release(mockedResponse());
  assert.deepEqual(await first, await second);
  assert.equal((await runtime("owner-a", input)).source, "llm");
  assert.equal(state.calls.length, 1);
  assert.equal((await runtime("owner-b", input)).source, "llm");
  assert.equal(state.calls.length, 2);
  state.enabled = false;
  assert.equal((await runtime("owner-a", input)).source, "rules", "Disabling bypasses even existing LLM cache entries");
});

test("cost limits apply across revisions and reset only after their one-hour window", async () => {
  const { runtime, state } = harness();
  assert.equal((await runtime("owner", input)).source, "llm");
  state.revision = 8;
  assert.equal((await runtime("owner", { ...input, revision: 8 })).source, "rules", "At most one new call per 30 seconds");
  for (let index = 1; index < 12; index++) {
    state.now += 30_000;
    state.revision++;
    assert.equal((await runtime("owner", { ...input, revision: state.revision })).source, "llm");
  }
  state.now += 30_000;
  state.revision++;
  assert.equal((await runtime("owner", { ...input, revision: state.revision })).source, "rules");
  assert.equal(state.calls.length, 12);
  state.now = initialNow + 3_600_000;
  assert.equal((await runtime("owner", { ...input, revision: state.revision })).source, "llm");
  assert.equal(state.calls.length, 13);
});

test("global concurrent calls and owner capacity are bounded without evicting live owner budgets", async () => {
  let release;
  const deferred = new Promise(resolve => { release = resolve; });
  const concurrent = harness({ fetcher: async () => { await deferred; return mockedResponse(); } });
  const operations = Array.from({ length: 8 }, (_, index) => concurrent.runtime(`owner-${index}`, input));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal((await concurrent.runtime("owner-9", input)).source, "rules");
  assert.equal(concurrent.state.calls.length, 8);
  release();
  await Promise.all(operations);
  const bounded = harness();
  for (let index = 0; index < 500; index++) assert.equal((await bounded.runtime(`owner-${index}`, input)).source, "llm");
  assert.equal((await bounded.runtime("owner-501", input)).source, "rules");
  assert.equal(bounded.state.calls.length, 500);
  bounded.state.revision++;
  assert.equal((await bounded.runtime("owner-0", { ...input, revision: bounded.state.revision })).source, "rules", "Old owners retain their active rate limit");
});
