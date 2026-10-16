import type { QuizQuestion, QuizRun, Workspace } from "./model.ts";
import { collectionItems, learningCollections } from "./learning-collections.ts";
import { runMatchesLearningCollection, type LearningRecommendation } from "./learning-resume.ts";
import { latestQuestionResults, type QuestionLearningResult } from "./quiz-preparation.ts";
import { withLearningNotes } from "./quiz-content.ts";
import { ARCHIVED_TEXT, difficultyLabels, isCorrect } from "./quiz.ts";

export const EXAM_SIZES = [10, 20, 30] as const;
export const EXAM_TIME_LIMITS = [0, 30, 45, 60, 90] as const;
export const EXAM_MAX_QUESTIONS = 30;

// Status of a task before a simulation: a repeated mistake, a task never
// answered before, or a task that was answered correctly last time.
export type ExamQuestionStatus = "repeat" | "new" | "refresh";
export const examStatusLabels: Record<ExamQuestionStatus, string> = {
  repeat: "Frühere Fehler", new: "Noch nicht bearbeitet", refresh: "Zuletzt richtig",
};

export type ExamPlanArea = {
  concept: string; count: number; total: number;
  repeat: number; new: number; refresh: number; errorRate: number | null;
};
export type ExamPlan = {
  questions: QuizQuestion[]; size: number;
  composition: Record<ExamQuestionStatus, number>; areas: ExamPlanArea[];
};
export type ExamHistoryEntry = { runId: string; number: number; correct: number; total: number; percent: number; finishedAt: string };
export type ExamCoverage = { answered: number; total: number; areasCovered: number; areasTotal: number };
export type ExamSimulationInsights = {
  collectionId: string | null; subject: string | null; bankSize: number; areaCount: number;
  active: { runId: string; collectionId: string | null; answered: number; total: number; deadlineAt: string | null } | null;
  blocked: boolean; history: ExamHistoryEntry[]; coverage: ExamCoverage;
};
export type ExamReport = {
  number: number; correct: number; total: number; percent: number; unanswered: number;
  areas: { concept: string; correct: number; total: number; noteIds: string[] }[];
  difficulty: { level: number; label: string; correct: number; total: number }[];
  composition: { status: ExamQuestionStatus; correct: number; total: number }[];
  previous: ExamHistoryEntry | null; history: ExamHistoryEntry[]; coverage: ExamCoverage;
};

type Scope = { collectionId: string | null; subject: string; questions: QuizQuestion[]; runs: QuizRun[] };

function examScope(workspace: Workspace, collectionId: string | null, subject: string): Scope | null {
  const collection = collectionId ? learningCollections(workspace).find(item => item.id === collectionId) : null;
  if (collectionId && !collection) return null;
  const bank = collection ? collectionItems(workspace, collection).questions : workspace.quizQuestions;
  const questions = [...new Map(bank.filter(question => question.subject === subject).map(question => [question.id, question])).values()];
  const runs = workspace.quizRuns.filter(run => run.subject === subject && (!collection || runMatchesLearningCollection(run, collection)));
  return { collectionId: collection?.id ?? null, subject, questions, runs };
}

// Like the tutor, only count answers whose task wording is still known: a
// compacted snapshot cannot prove that it matches a task changed by an import.
function evidence(scope: Scope, before: number, excludeRunId?: string): Map<string, QuestionLearningResult> {
  const runs = scope.runs.filter(run => run.id !== excludeRunId && Date.parse(run.startedAt) <= before &&
    (run.mode !== "exam" || !!run.finishedAt && Date.parse(run.finishedAt) <= before))
    .map(run => ({ ...run, answers: run.answers.filter(answer => Date.parse(answer.answeredAt) <= before &&
      !run.questions.some(question => question.id === answer.questionId && question.prompt === ARCHIVED_TEXT)) }));
  return latestQuestionResults(scope.questions, runs);
}

const statusOf = (latest: Map<string, QuestionLearningResult>, id: string): ExamQuestionStatus => {
  const result = latest.get(id);
  return !result ? "new" : result.correct ? "refresh" : "repeat";
};

function finishedSimulations(scope: Scope, now: number) {
  return scope.runs.filter(run => run.examSimulation && !!run.finishedAt && Date.parse(run.finishedAt) <= now)
    .sort((a, b) => a.finishedAt!.localeCompare(b.finishedAt!) || a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id));
}

function score(run: QuizRun) {
  const correct = run.questions.filter(question => isCorrect(question, run.answers.find(answer => answer.questionId === question.id)?.selectedOptionIds ?? [])).length;
  return { correct, total: run.questions.length, percent: Math.round(correct / run.questions.length * 100) };
}

function historyOf(scope: Scope, now: number): ExamHistoryEntry[] {
  return finishedSimulations(scope, now).map((run, index) => ({ runId: run.id, number: index + 1, finishedAt: run.finishedAt!, ...score(run) }));
}

function coverageOf(scope: Scope, latest: Map<string, QuestionLearningResult>): ExamCoverage {
  const concepts = [...new Set(scope.questions.map(question => question.concept))];
  return {
    answered: scope.questions.filter(question => latest.has(question.id)).length, total: scope.questions.length,
    areasCovered: concepts.filter(concept => scope.questions.some(question => question.concept === concept && latest.has(question.id))).length,
    areasTotal: concepts.length,
  };
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function interleave<T>(first: T[], second: T[]): T[] {
  const result: T[] = [];
  for (let index = 0; index < Math.max(first.length, second.length); index++) {
    if (index < first.length) result.push(first[index]);
    if (index < second.length) result.push(second[index]);
  }
  return result;
}

// New tasks rotate through the difficulty levels, so a small share of a
// concept still mixes basics, application and transfer.
function byDifficultyRotation(questions: QuizQuestion[]): QuizQuestion[] {
  const levels = [1, 2, 3].map(level => questions.filter(question => question.difficulty === level).sort((a, b) => a.id.localeCompare(b.id)));
  const result: QuizQuestion[] = [];
  while (levels.some(level => level.length)) for (const level of levels) { const next = level.shift(); if (next) result.push(next); }
  return result;
}

// The blueprint follows a real exam: every learning area appears, larger areas
// get more tasks. Earlier mistakes and untested material raise an area's share;
// areas answered correctly throughout recede to half their usual weight.
export function planExamSimulation(workspace: Workspace, collectionId: string | null, subject: string, size: number = EXAM_MAX_QUESTIONS, now = Date.now(), random?: () => number): ExamPlan | null {
  const scope = examScope(workspace, collectionId, subject);
  if (!scope || !scope.questions.length) return null;
  const count = Math.min(EXAM_MAX_QUESTIONS, scope.questions.length, Math.max(1, Number.isFinite(size) ? Math.floor(size) : EXAM_MAX_QUESTIONS));
  const latest = evidence(scope, now);
  const askedBefore = new Map<string, string>();
  for (const run of finishedSimulations(scope, now)) for (const question of run.questions) askedBefore.set(question.id, run.finishedAt!);
  const concepts = [...new Set(scope.questions.map(question => question.concept))];
  const groups = concepts.map((concept, order) => {
    const pool = scope.questions.filter(question => question.concept === concept);
    const repeat = pool.filter(question => statusOf(latest, question.id) === "repeat")
      .sort((a, b) => latest.get(b.id)!.answeredAt.localeCompare(latest.get(a.id)!.answeredAt) || a.id.localeCompare(b.id));
    const fresh = byDifficultyRotation(pool.filter(question => statusOf(latest, question.id) === "new"));
    // Refresh the tasks answered longest ago; tasks not yet seen in a simulation come first.
    const refresh = pool.filter(question => statusOf(latest, question.id) === "refresh").sort((a, b) =>
      Number(askedBefore.has(a.id)) - Number(askedBefore.has(b.id)) ||
      latest.get(a.id)!.answeredAt.localeCompare(latest.get(b.id)!.answeredAt) || a.id.localeCompare(b.id));
    const answered = repeat.length + refresh.length;
    const errorRate = answered ? repeat.length / answered : null;
    const weight = pool.length * (0.5 + 1.5 * (errorRate ?? 0) + 0.5 * fresh.length / pool.length);
    return { concept, order, pool, ordered: [...interleave(repeat, fresh), ...refresh], weight, errorRate, quota: 0 };
  });
  let remaining = count;
  if (count >= groups.length) {
    for (const group of groups) group.quota = 1;
    remaining -= groups.length;
  } else {
    for (const group of [...groups].sort((a, b) => b.weight - a.weight || a.order - b.order).slice(0, count)) group.quota = 1;
    remaining = 0;
  }
  // Highest averages: each further slot goes to the area with the largest
  // weight per already assigned task, never beyond the tasks it holds.
  while (remaining > 0) {
    const next = groups.filter(group => group.quota < group.pool.length)
      .sort((a, b) => b.weight / (b.quota + 1) - a.weight / (a.quota + 1) || a.order - b.order)[0];
    if (!next) break;
    next.quota++;
    remaining--;
  }
  const selected = groups.flatMap(group => group.ordered.slice(0, group.quota));
  const composition: Record<ExamQuestionStatus, number> = { repeat: 0, new: 0, refresh: 0 };
  for (const question of selected) composition[statusOf(latest, question.id)]++;
  const areas = groups.filter(group => group.quota > 0).map(group => {
    const chosen = group.ordered.slice(0, group.quota);
    const counts = (status: ExamQuestionStatus) => chosen.filter(question => statusOf(latest, question.id) === status).length;
    return { concept: group.concept, count: group.quota, total: group.pool.length, repeat: counts("repeat"), new: counts("new"), refresh: counts("refresh"), errorRate: group.errorRate };
  }).sort((a, b) => b.count - a.count || (b.errorRate ?? 0) - (a.errorRate ?? 0) || a.concept.localeCompare(b.concept, "de"));
  const prepared = selected.map(question => withLearningNotes(question));
  const questions = random ? shuffled(prepared, random).map(question => ({ ...question, options: shuffled(question.options, random) })) : prepared;
  return { questions, size: count, composition, areas };
}

export function examSimulationInsights(workspace: Workspace, recommendation: Pick<LearningRecommendation, "collectionId" | "subject">, now = Date.now()): ExamSimulationInsights {
  const subject = recommendation.subject;
  const scope = subject ? examScope(workspace, recommendation.collectionId, subject) : null;
  const unfinished = workspace.quizRuns.find(run => !run.finishedAt);
  const active = unfinished?.examSimulation ? {
    runId: unfinished.id, collectionId: unfinished.collectionId ?? null,
    answered: unfinished.answers.length, total: unfinished.questions.length, deadlineAt: unfinished.deadlineAt,
  } : null;
  const empty = { answered: 0, total: 0, areasCovered: 0, areasTotal: 0 };
  return {
    collectionId: recommendation.collectionId, subject, bankSize: scope?.questions.length ?? 0,
    areaCount: scope ? new Set(scope.questions.map(question => question.concept)).size : 0,
    active, blocked: !!unfinished && !active,
    history: scope ? historyOf(scope, now).reverse() : [],
    coverage: scope ? coverageOf(scope, evidence(scope, now)) : empty,
  };
}

// The report compares each task with the evidence from before the simulation
// started, so it shows whether repeated mistakes are now solved.
export function examSimulationReport(workspace: Workspace, run: QuizRun, now = Date.now()): ExamReport | null {
  if (!run.examSimulation || !run.finishedAt) return null;
  const scope = examScope(workspace, run.collectionId ?? null, run.subject) ?? { collectionId: null, subject: run.subject, questions: [], runs: [] };
  const before = evidence(scope, Date.parse(run.startedAt), run.id);
  const answers = new Map(run.answers.map(answer => [answer.questionId, answer]));
  const correctIds = new Set(run.questions.filter(question => isCorrect(question, answers.get(question.id)?.selectedOptionIds ?? [])).map(question => question.id));
  const tally = <K>(keys: K[], keyOf: (question: QuizQuestion) => K) => keys.map(key => {
    const questions = run.questions.filter(question => keyOf(question) === key);
    return { key, correct: questions.filter(question => correctIds.has(question.id)).length, total: questions.length };
  }).filter(item => item.total > 0);
  const notes = new Set(workspace.notes.filter(note => !note.archived).map(note => note.id));
  const bank = new Map(scope.questions.map(question => [question.id, question]));
  const areas = tally([...new Set(run.questions.map(question => question.concept))], question => question.concept).map(({ key, ...counts }) => ({
    concept: key, ...counts,
    noteIds: [...new Set(run.questions.filter(question => question.concept === key)
      .flatMap(question => withLearningNotes(bank.get(question.id) ?? question).noteIds ?? []))].filter(id => notes.has(id)),
  })).sort((a, b) => a.correct / a.total - b.correct / b.total || b.total - a.total || a.concept.localeCompare(b.concept, "de"));
  const history = historyOf({ ...scope, runs: scope.runs.some(item => item.id === run.id) ? scope.runs : [...scope.runs, run] }, Math.max(now, Date.parse(run.finishedAt)));
  const number = history.find(entry => entry.runId === run.id)?.number ?? history.length;
  const { correct, total, percent } = score(run);
  return {
    number, correct, total, percent, unanswered: run.questions.filter(question => !answers.has(question.id)).length,
    areas,
    difficulty: tally([1, 2, 3], question => question.difficulty).map(({ key, ...counts }) => ({ level: key, label: difficultyLabels[key], ...counts })),
    composition: tally<ExamQuestionStatus>(["repeat", "new", "refresh"], question => statusOf(before, question.id)).map(({ key, ...counts }) => ({ status: key, ...counts })),
    previous: history.filter(entry => entry.number < number).at(-1) ?? null,
    history: history.filter(entry => entry.number <= number),
    coverage: coverageOf(scope, evidence(scope, Date.parse(run.finishedAt))),
  };
}

const normalized = (question: QuizQuestion) => JSON.stringify({ ...question, options: [...question.options].sort((a, b) => a.id.localeCompare(b.id)) });

// Called inside the saved update: the simulation may only contain current,
// unchanged tasks of its subject and learning collection.
export function validateExamSimulationRun(workspace: Workspace, run: QuizRun): void {
  if (!run.examSimulation) return;
  const scope = examScope(workspace, run.collectionId ?? null, run.subject);
  const bank = new Map(scope?.questions.map(question => [question.id, withLearningNotes(question)]));
  if (!scope || run.mode !== "exam" || !run.questions.length || run.questions.length > EXAM_MAX_QUESTIONS ||
    new Set(run.questions.map(question => question.id)).size !== run.questions.length ||
    run.questions.some(question => { const current = bank.get(question.id); return !current || normalized(current) !== normalized(question); })) {
    throw new Error("Die Aufgaben für diese Prüfungssimulation haben sich geändert. Stelle die Simulation im Tutor neu zusammen.");
  }
}
