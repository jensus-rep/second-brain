import type { QuizQuestion, QuizRun, Workspace } from "./model.ts";
import { isCorrect, restoreQuestion } from "./quiz.ts";
import { projectManagementLearning } from "./project-management-learning.ts";
import { withLearningNotes } from "./quiz-content.ts";

export type PreparationArea = {
  concept: string;
  questionCount: number;
  noteIds: string[];
  completed: boolean;
  correct: number;
  total: number;
};

export type QuestionLearningResult = {
  correct: boolean;
  answeredAt: string;
  attempts: number;
};

// Evidence belongs to the current task, not merely its concept or a reused ID.
// Restore compacted wording first so old, unchanged tasks still contribute.
export function latestQuestionResults(questions: QuizQuestion[], runs: QuizRun[]): Map<string, QuestionLearningResult> {
  const bank = new Map(questions.map(question => [question.id, question]));
  const latest = new Map<string, QuestionLearningResult>();
  for (const run of [...runs].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    if (run.mode === "exam" && !run.finishedAt) continue;
    for (const answer of run.answers) {
      const saved = run.questions.find(question => question.id === answer.questionId);
      const current = bank.get(answer.questionId);
      if (!saved || !current) continue;
      const restored = restoreQuestion(saved, questions);
      if (restored.subject !== current.subject || restored.concept !== current.concept || restored.difficulty !== current.difficulty || restored.prompt !== current.prompt ||
        restored.options.length !== current.options.length || !restored.options.every(option => current.options.some(item => item.id === option.id && item.text === option.text)) ||
        restored.correctOptionIds.length !== current.correctOptionIds.length || !restored.correctOptionIds.every(id => current.correctOptionIds.includes(id))) continue;
      const previous = latest.get(current.id);
      const attempts = (previous?.attempts ?? 0) + 1;
      if (previous && previous.answeredAt > answer.answeredAt) latest.set(current.id, { ...previous, attempts });
      else latest.set(current.id, { correct: isCorrect(saved, answer.selectedOptionIds), answeredAt: answer.answeredAt, attempts });
    }
  }
  return latest;
}

// Repeat unresolved tasks before rotating through new tasks. A correct answer
// to another question of the same concept never clears the original mistake.
export function selectAdaptivePreparationQuestions(questions: QuizQuestion[], runs: QuizRun[], subject: string, concept: string): QuizQuestion[] {
  const pool = [...new Map(questions.filter(question => question.subject === subject && question.concept === concept).map(question => [question.id, question])).values()];
  const latest = latestQuestionResults(pool, runs);
  const open = pool.filter(question => !latest.get(question.id)?.correct);
  const candidates = open.length ? open : pool;
  const chosen = candidates.filter(question => latest.get(question.id)?.correct === false)
    .sort((a, b) => latest.get(b.id)!.answeredAt.localeCompare(latest.get(a.id)!.answeredAt) || a.difficulty - b.difficulty || a.id.localeCompare(b.id)).slice(0, 3);
  const remaining = candidates.filter(question => !chosen.some(item => item.id === question.id));
  const compare = (a: QuizQuestion, b: QuizQuestion) => (latest.get(a.id)?.attempts ?? 0) - (latest.get(b.id)?.attempts ?? 0) || a.id.localeCompare(b.id);
  for (const level of [1, 2, 3]) {
    if (chosen.length >= 3) break;
    const next = remaining.filter(question => question.difficulty === level && !chosen.some(item => item.id === question.id)).sort(compare)[0];
    if (next) chosen.push(next);
  }
  for (const next of remaining.filter(question => !chosen.some(item => item.id === question.id)).sort(compare)) {
    if (chosen.length >= 3) break;
    chosen.push(next);
  }
  return chosen.map(question => withLearningNotes(question));
}

export function preparationAreas(workspace: Workspace, subject: string): PreparationArea[] {
  const pool = workspace.quizQuestions.filter(question => question.subject === subject);
  const concepts = [...new Set(pool.map(question => question.concept))];
  const curated = subject === projectManagementLearning.subject ? projectManagementLearning.areas : [];
  const ordered = [...curated.map(area => area.concept).filter(concept => concepts.includes(concept)), ...concepts.filter(concept => !curated.some(area => area.concept === concept))];
  const noteIds = new Set(workspace.notes.map(note => note.id));
  return ordered.map(concept => {
    const questions = pool.filter(question => question.concept === concept);
    const relevantRuns = workspace.quizRuns.filter(run => run.subject === subject && run.preparationConcept === concept)
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
    const latestComplete = relevantRuns.find(run => !!run.finishedAt && run.questions.every(question => run.answers.some(answer => answer.questionId === question.id)));
    const latest = relevantRuns.find(run => !!run.finishedAt);
    const materials = curated.find(area => area.concept === concept)?.noteIds ?? questions.flatMap(question => withLearningNotes(question).noteIds ?? []);
    return {
      concept, questionCount: questions.length, noteIds: [...new Set(materials)].filter(id => noteIds.has(id)),
      completed: !!latestComplete,
      correct: latest?.questions.filter(question => isCorrect(question, latest.answers.find(answer => answer.questionId === question.id)?.selectedOptionIds ?? [])).length ?? 0,
      total: latest?.questions.length ?? 0,
    };
  });
}

export function selectPreparationQuestions(questions: QuizQuestion[], runs: QuizRun[], subject: string, concept: string, allQuestions = false): QuizQuestion[] {
  if (!allQuestions) return selectAdaptivePreparationQuestions(questions, runs, subject, concept);
  const pool = questions.filter(question => question.subject === subject && question.concept === concept);
  const used = new Map<string, number>();
  for (const run of runs) for (const answer of run.answers) used.set(answer.questionId, (used.get(answer.questionId) ?? 0) + 1);
  return [...pool].sort((a, b) => a.difficulty - b.difficulty || (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0) || a.id.localeCompare(b.id)).slice(0, 30).map(question => withLearningNotes(question));
}
