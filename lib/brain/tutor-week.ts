import type { QuizRun, TutorWeek, Workspace } from "./model.ts";
import { collectionItems, learningCollections } from "./learning-collections.ts";
import { comparableLearningRuns, runMatchesLearningCollection, selectCheckpointQuestions, type LearningAction, type LearningRecommendation } from "./learning-resume.ts";
import { tutorDate, tutorInsights } from "./learning-tutor.ts";
import { projectManagementLearning } from "./project-management-learning.ts";

const dayMs = 86_400_000;
const ordinal = (date: string) => Math.floor(Date.parse(date + "T00:00:00Z") / dayMs);
export const weekDate = (start: string, offset: number) => new Date((ordinal(start) + offset) * dayMs).toISOString().slice(0, 10);

function weekScope(workspace: Workspace, collectionId: string | null) {
  const collection = collectionId ? learningCollections(workspace).find(item => item.id === collectionId) : null;
  if (collectionId && !collection) return null;
  return {
    ...(collection ? collectionItems(workspace, collection) : { questions: workspace.quizQuestions, cards: workspace.cards }),
    runs: workspace.quizRuns.filter(run => !collection || runMatchesLearningCollection(run, collection)),
  };
}

export function createTutorWeek(workspace: Workspace, recommendation: LearningRecommendation, now = Date.now()): TutorWeek | null {
  const scope = weekScope(workspace, recommendation.collectionId);
  if (!scope || !recommendation.subject) return null;
  const questions = selectCheckpointQuestions(scope.questions, scope.runs, recommendation.subject);
  return questions.length ? {
    startedOn: tutorDate(now), collectionId: recommendation.collectionId, subject: recommendation.subject,
    checkpointQuestionIds: questions.map(question => question.id),
  } : null;
}

export function tutorWeekInsights(workspace: Workspace, recommendation: LearningRecommendation, now = Date.now()) {
  const week = workspace.tutorWeek;
  if (!week || week.collectionId !== recommendation.collectionId || week.subject !== recommendation.subject) return null;
  const scope = weekScope(workspace, week.collectionId);
  if (!scope) return null;
  const evidence = tutorInsights(workspace, recommendation, now);
  const order = projectManagementLearning.areas.map(area => area.concept);
  const areas = recommendation.areas.filter(area => area.subject === week.subject).sort((a, b) => {
    const index = (concept: string) => { const found = order.indexOf(concept); return found < 0 ? order.length : found; };
    return index(a.concept) - index(b.concept) || a.concept.localeCompare(b.concept, "de");
  }).map(area => {
    const progress = evidence.coverage.areas.find(item => item.subject === area.subject && item.concept === area.concept);
    const noteIds = area.noteIds.filter(id => workspace.notes.some(note => note.id === id && !note.archived));
    const cards = scope.cards.filter(card => card.noteId && noteIds.includes(card.noteId)).sort((a, b) =>
      a.dueAt.localeCompare(b.dueAt) || a.reviews - b.reviews || a.id.localeCompare(b.id)).slice(0, 5);
    return {
      concept: area.concept, noteIds, answered: progress?.answered ?? 0, correct: progress?.correct ?? 0,
      total: area.questionCount, secure: progress?.secure ?? false,
      cardsAction: cards.length ? { kind: "review-cards", collectionId: week.collectionId, mode: "all", cardIds: cards.map(card => card.id) } as LearningAction : null,
      practiceAction: { kind: "preparation", collectionId: week.collectionId, subject: week.subject, concept: area.concept, tutorWeekStartedOn: week.startedOn } as LearningAction,
    };
  });
  const priority = [...areas].sort((a, b) => Number(a.secure) - Number(b.secure) ||
    Number(b.answered > b.correct) - Number(a.answered > a.correct) || a.correct / a.total - b.correct / b.total);
  const days = Array.from({ length: 7 }, (_, index) => {
    const scheduled = index < 6 ? areas.slice(index * 3, index * 3 + 3) : [];
    const review = scheduled.length < 3 ? priority.filter(area => !scheduled.includes(area)).slice(0, 3 - scheduled.length) : [];
    return {
      number: index + 1, date: weekDate(week.startedOn, index),
      title: index === 0 ? "Ausgangspunkt & Grundlagen" : index === 3 ? "Vertiefen & Zwischenstand" : index === 5 ? "Lücken schließen" : index === 6 ? "Anwenden & Abschluss" : "Verstehen & anwenden",
      areas: [...scheduled, ...review], reviewConcepts: review.map(area => area.concept),
    };
  });
  const questions = scope.questions.filter(question => question.subject === week.subject);
  const checkpointAvailable = week.checkpointQuestionIds.every(id => questions.some(question => question.id === id));
  const stageResult = (stage: NonNullable<QuizRun["tutorWeekCheckpoint"]>["stage"]) => scope.runs
    .filter(run => run.subject === week.subject && run.mode === "exam" && run.finishedAt && Date.parse(run.finishedAt) <= now &&
      tutorDate(Date.parse(run.startedAt)) >= week.startedOn && run.tutorWeekCheckpoint?.startedOn === week.startedOn && run.tutorWeekCheckpoint.stage === stage)
    .sort((a, b) => b.finishedAt!.localeCompare(a.finishedAt!))[0] ?? null;
  const baseline = stageResult("baseline"), midpoint = stageResult("midpoint"), final = stageResult("final");
  const action = (stage: NonNullable<QuizRun["tutorWeekCheckpoint"]>["stage"]): LearningAction | null => {
    const ids = stage === "midpoint" ? selectCheckpointQuestions(questions, scope.runs, week.subject).map(question => question.id) : checkpointAvailable ? week.checkpointQuestionIds : [];
    return ids.length ? { kind: "checkpoint", collectionId: week.collectionId, subject: week.subject, questionCount: ids.length, questionIds: ids, tutorWeekCheckpoint: { startedOn: week.startedOn, stage } } : null;
  };
  return {
    week, days, currentDay: Math.max(1, Math.min(7, ordinal(tutorDate(now)) - ordinal(week.startedOn) + 1)),
    ended: tutorDate(now) > weekDate(week.startedOn, 6), areas, extraAreas: Math.max(0, areas.length - 18),
    baseline, midpoint, final, comparable: !!baseline && !!final && comparableLearningRuns(baseline, final, workspace.quizQuestions),
    checkpoints: [
      { stage: "baseline" as const, title: "Einstiegstest", day: 1, result: baseline, action: action("baseline") },
      { stage: "midpoint" as const, title: "Zwischentest", day: 4, result: midpoint, action: action("midpoint") },
      { stage: "final" as const, title: "Abschlusstest", day: 7, result: final, action: action("final") },
    ],
  };
}
