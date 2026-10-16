import test from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace, quizRunSchema, workspaceSchema } from "../lib/brain/model.ts";
import { examSimulationInsights, examSimulationReport, planExamSimulation, validateExamSimulationRun } from "../lib/brain/exam-simulation.ts";
import { ARCHIVED_EXPLANATION, ARCHIVED_TEXT, compactQuizRuns } from "../lib/brain/quiz.ts";

const now = Date.parse("2026-10-16T08:00:00.000Z");
const at = minutes => new Date(now + minutes * 60_000).toISOString();
const subject = "Projektmanagement";
const concepts = ["Grundlagen", "Stakeholder", "Planung", "Risiken"];

function fixture(perConcept = 6) {
  const quizQuestions = concepts.flatMap(concept => Array.from({ length: perConcept }, (_, index) => ({
    id: `q-${concept}-${index}`, subject, concept, difficulty: index % 3 + 1, prompt: `${concept}: Aufgabe ${index}`,
    options: [{ id: "yes", text: "Richtig", feedback: "Passt." }, { id: "no", text: "Falsch", feedback: "Passt nicht." }, { id: "maybe", text: "Teilweise", feedback: "Unvollständig." }],
    correctOptionIds: ["yes"], explanation: "Begründung.", source: "",
  })));
  const collection = { id: "pm", title: subject, description: "", noteIds: [], cardIds: [], questionIds: quizQuestions.map(question => question.id), pathIds: [] };
  return { ...structuredClone(emptyWorkspace), quizQuestions, learningCollections: [collection], learningFocus: { collectionId: "pm", subject, updatedAt: at(0) } };
}

// Simulations take the questions of a plan; `choice` decides the answer per task.
function simulate(data, { id, start, size = 12, choice = () => "yes", random }) {
  const plan = planExamSimulation(data, "pm", subject, size, Date.parse(at(start)), random);
  const answers = plan.questions.flatMap((question, index) => {
    const selected = choice(question);
    return selected ? [{ questionId: question.id, selectedOptionIds: [selected], answeredAt: at(start + 1 + index / 100), reflection: "" }] : [];
  });
  const run = { id, subject, collectionId: "pm", mode: "exam", examSimulation: true, startedAt: at(start), deadlineAt: null, finishedAt: at(start + 2), questions: plan.questions, answers };
  return { plan, run, data: { ...data, quizRuns: [...data.quizRuns, run] } };
}
const countBy = (questions, concept) => questions.filter(question => question.concept === concept).length;
// Deterministic shuffle source for reproducible order tests.
function seeded(seed = 7) { let value = seed; return () => (value = (value * 16807) % 2147483647) / 2147483647; }

test("simulation runs validate as their own exam mode and round-trip in the workspace", () => {
  const { run, data } = simulate(fixture(), { id: "sim-1", start: 1 });
  assert.equal(quizRunSchema.safeParse(run).success, true);
  assert.deepEqual(workspaceSchema.parse(JSON.parse(JSON.stringify(data))), data);
  for (const invalid of [{ mode: "practice" }, { tutorSessionId: "guided-1" }, { preparationConcept: "Grundlagen", mode: "practice" }, { examSimulation: false },
    { questions: run.questions.map((question, index) => index ? question : { ...question, subject: "Anderes Fach" }) }]) {
    assert.equal(quizRunSchema.safeParse({ ...run, ...invalid }).success, false, JSON.stringify(Object.keys(invalid)));
  }
  const { examSimulation, ...ordinary } = run;
  assert.equal(examSimulation, true);
  assert.equal(Object.hasOwn(quizRunSchema.parse(ordinary), "examSimulation"), false);
});

test("the first simulation covers every learning area, mixes difficulty and stays within 30 tasks", () => {
  const plan = planExamSimulation(fixture(), "pm", subject, 10, now);
  assert.equal(plan.questions.length, 10);
  assert.deepEqual(plan.composition, { repeat: 0, new: 10, refresh: 0 });
  for (const concept of concepts) assert.ok(countBy(plan.questions, concept) >= 1, concept);
  assert.deepEqual([...new Set(plan.questions.map(question => question.difficulty))].sort(), [1, 2, 3]);
  assert.equal(new Set(plan.questions.map(question => question.id)).size, 10);
  assert.equal(planExamSimulation(fixture(), "pm", subject, 30, now).questions.length, 24);
  assert.equal(planExamSimulation(fixture(10), "pm", subject, 50, now).questions.length, 30);
  assert.equal(planExamSimulation(fixture(), "pm", "Unbekannt", 30, now), null);
  assert.equal(planExamSimulation(fixture(), "missing", subject, 30, now), null);
  // Fewer tasks than areas still pick distinct areas.
  assert.equal(new Set(planExamSimulation(fixture(), "pm", subject, 3, now).questions.map(question => question.concept)).size, 3);
});

test("the next simulation repeats mistakes, gives weak areas more tasks and adds unseen tasks", () => {
  const first = simulate(fixture(), { id: "sim-1", start: 1, choice: question => question.concept === "Grundlagen" ? "no" : "yes" });
  assert.equal(countBy(first.run.questions, "Grundlagen"), 3);
  const next = planExamSimulation(first.data, "pm", subject, 12, Date.parse(at(10)));
  const wrong = first.run.questions.filter(question => question.concept === "Grundlagen").map(question => question.id);
  assert.deepEqual(next.composition, { repeat: 3, new: 9, refresh: 0 });
  assert.equal(countBy(next.questions, "Grundlagen"), 6);
  assert.ok(wrong.every(id => next.questions.some(question => question.id === id)));
  for (const concept of concepts.slice(1)) assert.equal(countBy(next.questions, concept), 2);
  // Correctly answered tasks wait while unseen tasks of their area remain.
  const solved = first.run.questions.filter(question => question.concept !== "Grundlagen").map(question => question.id);
  assert.ok(!next.questions.some(question => solved.includes(question.id)));
  assert.equal(next.areas[0].concept, "Grundlagen");
  assert.equal(next.areas[0].repeat, 3);
});

test("once every task is solved, simulations refresh the tasks answered longest ago", () => {
  let data = fixture(3);
  data = simulate(data, { id: "sim-1", start: 1, size: 6 }).data;
  data = simulate(data, { id: "sim-2", start: 10, size: 6 }).data;
  const third = planExamSimulation(data, "pm", subject, 6, Date.parse(at(20)));
  assert.deepEqual(third.composition, { repeat: 0, new: 0, refresh: 6 });
  const firstIds = data.quizRuns[0].questions.map(question => question.id);
  assert.deepEqual(new Set(third.questions.map(question => question.id)), new Set(firstIds));
});

test("simulations shuffle task and answer order without changing the selection", () => {
  const data = fixture();
  const plain = planExamSimulation(data, "pm", subject, 12, now);
  const shuffled = planExamSimulation(data, "pm", subject, 12, now, seeded());
  assert.deepEqual(new Set(shuffled.questions.map(question => question.id)), new Set(plain.questions.map(question => question.id)));
  assert.notDeepEqual(shuffled.questions.map(question => question.id), plain.questions.map(question => question.id));
  assert.ok(shuffled.questions.some(question => question.options[0].id !== "yes"));
});

test("the report compares each task with the state before the simulation", () => {
  const first = simulate(fixture(), { id: "sim-1", start: 1, choice: question => question.concept === "Grundlagen" ? "no" : "yes" });
  // In the second simulation, two of three repeated mistakes are solved and one new task stays open.
  let repeated = 0, fresh = 0;
  const second = simulate(first.data, { id: "sim-2", start: 10, choice: question => {
    if (first.run.questions.some(item => item.id === question.id)) return repeated++ < 2 ? "yes" : "no";
    return fresh++ === 0 ? null : "yes";
  } });
  const report = examSimulationReport(second.data, second.run, Date.parse(at(30)));
  assert.equal(report.number, 2);
  assert.equal(report.total, 12);
  assert.equal(report.unanswered, 1);
  assert.equal(report.correct, 10);
  assert.deepEqual(report.composition, [{ status: "repeat", correct: 2, total: 3 }, { status: "new", correct: 8, total: 9 }]);
  assert.equal(report.areas[0].concept, "Grundlagen");
  assert.equal(report.areas.reduce((sum, area) => sum + area.total, 0), 12);
  assert.equal(report.difficulty.reduce((sum, level) => sum + level.total, 0), 12);
  assert.equal(report.previous.runId, "sim-1");
  assert.equal(report.previous.percent, 75);
  assert.deepEqual(report.history.map(entry => entry.runId), ["sim-1", "sim-2"]);
  assert.deepEqual(report.coverage, { answered: 20, total: 24, areasCovered: 4, areasTotal: 4 });
  assert.equal(examSimulationReport(first.data, { ...first.run, examSimulation: undefined }), null);
  assert.equal(examSimulationReport(first.data, { ...first.run, finishedAt: null }), null);
  // The first report stays the same after later simulations.
  assert.equal(examSimulationReport(second.data, first.run, Date.parse(at(30))).number, 1);
  assert.equal(examSimulationReport(second.data, first.run, Date.parse(at(30))).previous, null);
});

test("starting validates current, unchanged tasks of the subject and collection", () => {
  const data = fixture();
  const { run } = simulate(data, { id: "sim-1", start: 1, random: seeded() });
  assert.doesNotThrow(() => validateExamSimulationRun(data, run));
  assert.doesNotThrow(() => validateExamSimulationRun(data, { ...run, examSimulation: undefined, questions: [] }));
  const edited = { ...data, quizQuestions: data.quizQuestions.map(question => question.id === run.questions[0].id ? { ...question, prompt: "Geändert" } : question) };
  assert.throws(() => validateExamSimulationRun(edited, run), /haben sich geändert/);
  const foreign = { ...fixture(), learningCollections: [{ ...data.learningCollections[0], questionIds: data.learningCollections[0].questionIds.filter(id => id !== run.questions[0].id) }] };
  assert.throws(() => validateExamSimulationRun(foreign, run), /haben sich geändert/);
  assert.throws(() => validateExamSimulationRun({ ...data, learningCollections: [] }, run), /haben sich geändert/);
  assert.throws(() => validateExamSimulationRun(data, { ...run, questions: [...run.questions, run.questions[0]] }), /haben sich geändert/);
});

test("compaction keeps the task wording of older simulations as durable evidence", () => {
  let data = simulate(fixture(), { id: "sim-1", start: 1 }).data;
  const ordinary = { ...data.quizRuns[0], id: "exam-1", examSimulation: undefined, startedAt: at(2), finishedAt: at(3) };
  data = { ...data, quizRuns: [...data.quizRuns, ordinary] };
  for (let index = 0; index < 5; index++) data = simulate(data, { id: `later-${index}`, start: 10 + index * 5, size: 2 }).data;
  const compacted = compactQuizRuns(data, data);
  const simulation = compacted.quizRuns.find(run => run.id === "sim-1");
  const exam = compacted.quizRuns.find(run => run.id === "exam-1");
  assert.ok(simulation.questions.every(question => question.explanation === ARCHIVED_EXPLANATION && question.prompt !== ARCHIVED_TEXT));
  assert.ok(exam.questions.every(question => question.prompt === ARCHIVED_TEXT));
  // Evidence from the compacted simulation still drives the next selection.
  assert.equal(planExamSimulation(compacted, "pm", subject, 24, Date.parse(at(60))).composition.new, 24 - 12 - 10);
});

test("insights show a running simulation, block other running rounds and list results newest first", () => {
  const first = simulate(fixture(), { id: "sim-1", start: 1, choice: question => question.concept === "Grundlagen" ? "no" : "yes" });
  const second = simulate(first.data, { id: "sim-2", start: 10 });
  const recommendation = { collectionId: "pm", subject };
  const finished = examSimulationInsights(second.data, recommendation, Date.parse(at(30)));
  assert.deepEqual(finished.history.map(entry => [entry.runId, entry.number, entry.percent]), [["sim-2", 2, 100], ["sim-1", 1, 75]]);
  assert.equal(finished.bankSize, 24);
  assert.equal(finished.areaCount, 4);
  assert.equal(finished.active, null);
  assert.equal(finished.blocked, false);
  const running = { ...second.data, quizRuns: second.data.quizRuns.map(run => run.id === "sim-2" ? { ...run, finishedAt: null, answers: run.answers.slice(0, 5) } : run) };
  const resumed = examSimulationInsights(running, recommendation, Date.parse(at(30)));
  assert.deepEqual(resumed.active, { runId: "sim-2", collectionId: "pm", answered: 5, total: 12, deadlineAt: null });
  assert.equal(resumed.history.length, 1);
  const other = { ...first.data, quizRuns: [...first.data.quizRuns, { ...first.run, id: "short", examSimulation: undefined, finishedAt: null, answers: [] }] };
  assert.equal(examSimulationInsights(other, recommendation, Date.parse(at(30))).blocked, true);
  assert.equal(examSimulationInsights(fixture(), { collectionId: "pm", subject: null }).bankSize, 0);
});
