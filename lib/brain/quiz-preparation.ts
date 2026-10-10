import type { QuizQuestion, QuizRun, Workspace } from "./model.ts";
import { isCorrect } from "./quiz.ts";
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
  const pool = questions.filter(question => question.subject === subject && question.concept === concept);
  const used = new Map<string, number>();
  for (const run of runs) for (const answer of run.answers) used.set(answer.questionId, (used.get(answer.questionId) ?? 0) + 1);
  if (allQuestions) return [...pool].sort((a, b) => a.difficulty - b.difficulty || (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0) || a.id.localeCompare(b.id)).slice(0, 30).map(question => withLearningNotes(question));
  const chosen: QuizQuestion[] = [];
  for (const level of [1, 2, 3]) {
    const candidates = pool.filter(question => question.difficulty === level && !chosen.some(item => item.id === question.id))
      .sort((a, b) => (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0) || a.id.localeCompare(b.id));
    if (candidates[0]) chosen.push(withLearningNotes(candidates[0]));
  }
  // A smaller custom bank can still be worked through without duplicates.
  for (const question of pool.filter(item => !chosen.some(chosenQuestion => chosenQuestion.id === item.id))) {
    if (chosen.length >= 3) break;
    chosen.push(withLearningNotes(question));
  }
  return chosen;
}
