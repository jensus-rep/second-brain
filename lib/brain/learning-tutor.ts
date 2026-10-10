import type { CardReviewDay, QuizRun, Workspace } from "./model.ts";
import { collectionItems, learningCollections } from "./learning-collections.ts";
import { comparableLearningRuns, runMatchesLearningCollection, type LearningRecommendation } from "./learning-resume.ts";
import { latestQuestionResults } from "./quiz-preparation.ts";
import { ARCHIVED_TEXT, isCorrect } from "./quiz.ts";

export type TutorQuizResult = {
  runId: string; subject: string; mode: QuizRun["mode"]; concept: string | null; finishedAt: string;
  correct: number; total: number; percent: number;
  previousRunId: string | null; previousPercent: number | null; change: number | null;
};
export type TutorAreaEvidence = {
  subject: string; concept: string; covered: boolean; secure: boolean;
  answered: number; correct: number; total: number;
};
export type TutorInsights = {
  history: TutorQuizResult[];
  coverage: { covered: number; secure: number; total: number; areas: TutorAreaEvidence[] };
  continuity: {
    weeklyActiveDays: number; currentStreak: number; bestStreak: number;
    days: { date: string; active: boolean; isFuture: boolean; quizAnswers: number; cardReviews: number }[];
  };
  cards: { reviewed: number; known: number; days: number };
  plan: {
    goal: string; targetDate: string | null; weeklyDays: number; daysRemaining: number | null;
    weeklyRemaining: number; weeklyPercent: number;
  } | null;
};

const dayMilliseconds = 86_400_000;
const berlinFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });

// Calendar arithmetic uses date ordinals after converting the activity to
// Berlin. A local day can have 23 or 25 hours at the daylight-saving boundary.
export function tutorDate(now: number | Date = Date.now()): string {
  const parts = berlinFormatter.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)!.value;
  return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}
const ordinal = (date: string) => Math.floor(Date.parse(date + "T00:00:00.000Z") / dayMilliseconds);
const calendarDate = (day: number) => new Date(day * dayMilliseconds).toISOString().slice(0, 10);

// Call inside the same workspace update that schedules the reviewed card. The
// bucket records self-assessment, independently of objective quiz grading.
export function recordCardReview(workspace: Workspace, review: { collectionId: string | null; known: boolean }, now = new Date()): Workspace {
  const date = tutorDate(now);
  const existing = workspace.cardReviewDays ?? [];
  const index = existing.findIndex(day => day.date === date && day.collectionId === review.collectionId);
  const day: CardReviewDay = index < 0
    ? { date, collectionId: review.collectionId, reviewed: 1, known: review.known ? 1 : 0 }
    : { ...existing[index], reviewed: existing[index].reviewed + 1, known: existing[index].known + (review.known ? 1 : 0) };
  const updated = index < 0 ? [...existing, day] : existing.map((item, current) => current === index ? day : item);
  return { ...workspace, cardReviewDays: updated.sort((a, b) => a.date.localeCompare(b.date)).slice(-3000) };
}

const score = (run: QuizRun) => {
  const correct = run.questions.filter(question => isCorrect(question, run.answers.find(answer => answer.questionId === question.id)?.selectedOptionIds ?? [])).length;
  return { correct, total: run.questions.length, percent: Math.round(correct / run.questions.length * 100) };
};

export function tutorInsights(workspace: Workspace, recommendation: LearningRecommendation, now = Date.now()): TutorInsights {
  const today = ordinal(tutorDate(now));
  const action = recommendation.primaryAction;
  const savedCollectionId = action?.kind === "resume-cards" && workspace.flashcardSession?.id === action.sessionId
    ? workspace.flashcardSession.collectionId
    : action?.kind === "resume-quiz" ? workspace.quizRuns.find(run => run.id === action.runId)?.collectionId : null;
  // A missing collection is still a historical scope, rather than permission to
  // attribute unrelated global evidence to the saved round being resumed.
  const scopeCollectionId = recommendation.collectionId ?? savedCollectionId ?? null;
  const collection = scopeCollectionId ? learningCollections(workspace).find(item => item.id === scopeCollectionId) : null;
  const unavailableScope = !!scopeCollectionId && !collection;
  const available = unavailableScope ? [] : collection ? collectionItems(workspace, collection).questions : workspace.quizQuestions;
  const questions = available.filter(question => !recommendation.subject || question.subject === recommendation.subject);
  const scopedRuns = workspace.quizRuns.filter(run =>
    !unavailableScope && (!scopeCollectionId || !!collection && runMatchesLearningCollection(run, collection)) &&
    (!recommendation.subject || run.subject === recommendation.subject));
  const finished = scopedRuns.filter(run => !!run.finishedAt && Date.parse(run.finishedAt) <= now).sort((a, b) =>
    Date.parse(b.finishedAt!) - Date.parse(a.finishedAt!) || Date.parse(b.startedAt) - Date.parse(a.startedAt) || a.id.localeCompare(b.id));
  const history = finished.map((run, index): TutorQuizResult => {
    const previous = finished.slice(index + 1).find(candidate => comparableLearningRuns(run, candidate, workspace.quizQuestions));
    const previousPercent = previous ? score(previous).percent : null;
    const current = score(run);
    return {
      runId: run.id, subject: run.subject, mode: run.mode, concept: run.preparationConcept ?? null, finishedAt: run.finishedAt!, ...current,
      previousRunId: previous?.id ?? null, previousPercent, change: previousPercent === null ? null : current.percent - previousPercent,
    };
  });
  const usableRuns = scopedRuns.filter(run => run.mode !== "exam" || !!run.finishedAt && Date.parse(run.finishedAt) <= now)
    .map(run => {
      // Compacted wording cannot prove that the saved answer belongs to the
      // current task after an API write or import changed the bank directly.
      const unknownWording = new Set(run.questions.filter(question => question.prompt === ARCHIVED_TEXT).map(question => question.id));
      return { ...run, answers: run.answers.filter(answer => Date.parse(answer.answeredAt) <= now && !unknownWording.has(answer.questionId)) };
    });
  const latest = latestQuestionResults(questions, usableRuns);
  const grouped = new Map<string, TutorAreaEvidence>();
  for (const question of questions) {
    const key = JSON.stringify([question.subject, question.concept]);
    const area = grouped.get(key) ?? { subject: question.subject, concept: question.concept, covered: false, secure: false, answered: 0, correct: 0, total: 0 };
    area.total++;
    if (latest.has(question.id)) area.answered++;
    if (latest.get(question.id)?.correct) area.correct++;
    area.covered = area.answered > 0;
    area.secure = area.correct === area.total;
    grouped.set(key, area);
  }
  const areas = [...grouped.values()];
  const coverage = { covered: areas.filter(area => area.covered).length, secure: areas.filter(area => area.secure).length, total: areas.length, areas };

  const activity = new Map<number, { quizAnswers: number; cardReviews: number }>();
  const addActivity = (day: number, quizAnswers: number, cardReviews: number) => {
    if (day > today || !quizAnswers && !cardReviews) return;
    const old = activity.get(day) ?? { quizAnswers: 0, cardReviews: 0 };
    activity.set(day, { quizAnswers: old.quizAnswers + quizAnswers, cardReviews: old.cardReviews + cardReviews });
  };
  for (const run of workspace.quizRuns) {
    if (run.mode === "exam" && (!run.finishedAt || Date.parse(run.finishedAt) > now)) continue;
    for (const answer of run.answers) {
      if (Date.parse(answer.answeredAt) <= now) addActivity(ordinal(tutorDate(Date.parse(answer.answeredAt))), 1, 0);
    }
  }
  const recordedDays = (workspace.cardReviewDays ?? []).filter(day => ordinal(day.date) <= today);
  for (const day of recordedDays) addActivity(ordinal(day.date), 0, day.reviewed);
  const ordered = [...activity.keys()].sort((a, b) => a - b);
  let bestStreak = 0, streak = 0, previousDay: number | null = null;
  for (const day of ordered) {
    streak = previousDay === day - 1 ? streak + 1 : 1;
    bestStreak = Math.max(bestStreak, streak);
    previousDay = day;
  }
  let currentStreak = 0;
  // Today remains available to continue yesterday's streak until midnight.
  for (let day = activity.has(today) ? today : today - 1; activity.has(day); day--) currentStreak++;
  const weekStart = today - ((new Date(today * dayMilliseconds).getUTCDay() + 6) % 7);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = weekStart + index;
    const counts = activity.get(day) ?? { quizAnswers: 0, cardReviews: 0 };
    return { date: calendarDate(day), active: activity.has(day), isFuture: day > today, ...counts };
  });
  const weeklyActiveDays = days.filter(day => day.active).length;
  const continuity = { weeklyActiveDays, currentStreak, bestStreak, days };
  // Legacy card.reviews stores neither dates nor known/unknown ratings. It
  // cannot be backfilled into continuity or this self-assessment history.
  const scopedDays = recordedDays.filter(day => !scopeCollectionId || day.collectionId === scopeCollectionId);
  const cards = {
    reviewed: scopedDays.reduce((total, day) => total + day.reviewed, 0),
    known: scopedDays.reduce((total, day) => total + day.known, 0),
    days: new Set(scopedDays.filter(day => day.reviewed > 0).map(day => day.date)).size,
  };
  const savedPlan = workspace.tutorPlan;
  const plan = savedPlan ? {
    goal: savedPlan.goal, targetDate: savedPlan.targetDate, weeklyDays: savedPlan.weeklyDays,
    daysRemaining: savedPlan.targetDate ? ordinal(savedPlan.targetDate) - today : null,
    weeklyRemaining: Math.max(0, savedPlan.weeklyDays - weeklyActiveDays),
    weeklyPercent: Math.min(100, Math.round(weeklyActiveDays / savedPlan.weeklyDays * 100)),
  } : null;
  return { history, coverage, continuity, cards, plan };
}
