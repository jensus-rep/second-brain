import type { CardReviewDay, CardReviewEvent, Flashcard, QuizRun, Workspace } from "./model.ts";
import { collectionItems, learningCollections } from "./learning-collections.ts";
import { comparableLearningRuns, runMatchesLearningCollection, selectCheckpointQuestions, type LearningAction, type LearningRecommendation } from "./learning-resume.ts";
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
export type TutorCardCheckpoint = {
  sessionId: string; reviewedAt: string; reviewedCount: number; knownCount: number; concepts: string[];
  action: Extract<LearningAction, { kind: "checkpoint" }>;
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
export function recordCardReview(workspace: Workspace, review: { collectionId: string | null; known: boolean; cardId?: string; sessionId?: string; response?: string }, now = new Date()): Workspace {
  const date = tutorDate(now);
  const existing = workspace.cardReviewDays ?? [];
  const index = existing.findIndex(day => day.date === date && day.collectionId === review.collectionId);
  const day: CardReviewDay = index < 0
    ? { date, collectionId: review.collectionId, reviewed: 1, known: review.known ? 1 : 0 }
    : { ...existing[index], reviewed: existing[index].reviewed + 1, known: existing[index].known + (review.known ? 1 : 0) };
  const updated = index < 0 ? [...existing, day] : existing.map((item, current) => current === index ? day : item);
  const result = { ...workspace, cardReviewDays: updated.sort((a, b) => a.date.localeCompare(b.date)).slice(-3000) };
  const card = review.cardId ? workspace.cards.find(item => item.id === review.cardId) : undefined;
  // Old callers keep their daily totals. They cannot invent the source or
  // session of an individual rating from a legacy review counter.
  if (!card || !review.sessionId) return result;
  const event: CardReviewEvent = {
    cardId: card.id, sessionId: review.sessionId, collectionId: review.collectionId,
    noteId: card.noteId, known: review.known, reviewedAt: now.toISOString(), contentFingerprint: tutorCardContentFingerprint(card),
    ...(review.response?.trim() ? { response: review.response.trim().slice(0, 1500) } : {}),
  };
  const events = workspace.cardReviewEvents ?? [];
  const duplicate = events.some(item => item.sessionId === event.sessionId && item.cardId === event.cardId && item.reviewedAt === event.reviewedAt);
  return { ...result, cardReviewEvents: duplicate ? events : [...events, event].slice(-1500) };
}

// Two deterministic 32-bit fingerprints detect ordinary wording edits in the
// browser and server alike. This is change detection, not a security hash.
// JSON preserves the boundary between question and answer even with newlines.
export function tutorCardContentFingerprint(card: Pick<Flashcard, "question" | "answer">): string {
  const text = JSON.stringify([card.question, card.answer]);
  let first = 2166136261, second = 3339675911;
  for (let index = 0; index < text.length; index++) {
    first = Math.imul(first ^ text.charCodeAt(index), 16777619);
    second = Math.imul(second ^ text.charCodeAt(index), 2246822519);
  }
  return (first >>> 0).toString(16).padStart(8, "0") + (second >>> 0).toString(16).padStart(8, "0");
}

export function tutorCardCheckpoint(workspace: Workspace, sessionId?: string | null, now = Date.now()): TutorCardCheckpoint | null {
  if (!Number.isFinite(now) || workspace.quizRuns.some(run => !run.finishedAt)) return null;
  const allEvents = workspace.cardReviewEvents ?? [];
  const recent = allEvents.filter(event => Date.parse(event.reviewedAt) <= now && Date.parse(event.reviewedAt) >= now - dayMilliseconds)
    .sort((a, b) => Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt));
  const currentSession = workspace.flashcardSession;
  const requestedSessionId = sessionId ?? currentSession?.id ?? recent.filter(event => event.collectionId === workspace.learningFocus?.collectionId).at(-1)?.sessionId;
  if (!requestedSessionId) return null;
  const sessionEvents = recent.filter(event => event.sessionId === requestedSessionId);
  const collectionId = currentSession?.id === requestedSessionId ? currentSession.collectionId : sessionEvents.at(-1)?.collectionId;
  if (collectionId === undefined) return null;
  const collection = collectionId === null ? null : learningCollections(workspace).find(item => item.id === collectionId);
  if (collectionId !== null && !collection) return null;
  const contents = collection ? collectionItems(workspace, collection) : { cards: workspace.cards, questions: workspace.quizQuestions };
  const cards = new Map(contents.cards.map(card => [card.id, card]));
  const notes = new Set(workspace.notes.map(note => note.id));
  const seen = new Set<string>();
  const valid = sessionEvents.filter(event => {
    const key = JSON.stringify([event.cardId, event.reviewedAt]);
    if (seen.has(key)) return false;
    seen.add(key);
    const card = cards.get(event.cardId);
    return event.collectionId === collectionId && !!event.noteId && notes.has(event.noteId) &&
      !!card && card.noteId === event.noteId && tutorCardContentFingerprint(card) === event.contentFingerprint;
  });
  const decision = (workspace.tutorCheckpointDecisions ?? []).filter(item => item.sessionId === requestedSessionId &&
    Date.parse(item.decidedAt) <= now && Date.parse(item.reviewedAt) <= Date.parse(item.decidedAt))
    .sort((a, b) => Date.parse(b.decidedAt) - Date.parse(a.decidedAt))[0];
  // The durable marker stays meaningful if its old card is subsequently edited
  // or the bounded event log rotates. Another offer needs five new ratings.
  const unconsumed = valid.filter(event => !decision || Date.parse(event.reviewedAt) > Date.parse(decision.reviewedAt));
  if (unconsumed.length < 5) return null;
  const byNote = new Map<string, CardReviewEvent>();
  for (const event of unconsumed) byNote.set(event.noteId!, event);
  const eligible = contents.questions.filter(question => question.noteIds?.some(noteId => byNote.has(noteId)));
  if (!eligible.length) return null;
  const subjects = [...new Set(eligible.map(question => question.subject))];
  const uncertainty = (question: typeof eligible[number]) => question.noteIds?.some(noteId => byNote.get(noteId)?.known === false) ? 0 : 1;
  const focusSubject = workspace.learningFocus?.collectionId === collectionId ? workspace.learningFocus.subject : null;
  const subject = focusSubject && subjects.includes(focusSubject) ? focusSubject : subjects.sort((a, b) => {
    const uncertain = (value: string) => eligible.filter(question => question.subject === value && uncertainty(question) === 0).length;
    return uncertain(b) - uncertain(a) || eligible.filter(question => question.subject === b).length - eligible.filter(question => question.subject === a).length || a.localeCompare(b);
  })[0];
  const pool = eligible.filter(question => question.subject === subject)
    .sort((a, b) => uncertainty(a) - uncertainty(b) || a.difficulty - b.difficulty || a.id.localeCompare(b.id));
  const history = workspace.quizRuns.filter(run => run.subject === subject && (!collection || runMatchesLearningCollection(run, collection)) &&
    Date.parse(run.startedAt) <= now && (!run.finishedAt || Date.parse(run.finishedAt) <= now))
    .map(run => ({ ...run, answers: run.answers.filter(answer => Date.parse(answer.answeredAt) <= now) }));
  // Cover several reviewed concepts before repeating one. Within each concept,
  // rotate through uncertain-note tasks first, then favor less-used questions.
  const uncertainConcepts = new Set(pool.filter(question => uncertainty(question) === 0).map(question => question.concept));
  const preferred = pool.filter(question => !uncertainConcepts.has(question.concept) || uncertainty(question) === 0);
  const selected = selectCheckpointQuestions(preferred, history, subject, 3);
  if (selected.length < 3) selected.push(...selectCheckpointQuestions(pool.filter(question => !selected.some(item => item.id === question.id)), history, subject, 3 - selected.length));
  selected.sort((a, b) => uncertainty(a) - uncertainty(b));
  const reviewedAt = sessionEvents.filter(event => event.collectionId === collectionId).at(-1)!.reviewedAt;
  return {
    sessionId: requestedSessionId, reviewedAt, reviewedCount: unconsumed.length,
    knownCount: unconsumed.filter(event => event.known).length, concepts: [...new Set(selected.map(question => question.concept))],
    action: { kind: "checkpoint", collectionId, subject, questionCount: selected.length,
      questionIds: selected.map(question => question.id), cardCheckpoint: { sessionId: requestedSessionId, reviewedAt } },
  };
}

export function recordTutorCheckpoint(workspace: Workspace, checkpoint: Pick<TutorCardCheckpoint, "sessionId" | "reviewedAt">, decision: "later" | "started", now = new Date()): Workspace {
  const current = tutorCardCheckpoint(workspace, checkpoint.sessionId, now.getTime());
  if (!current || current.reviewedAt !== checkpoint.reviewedAt) return workspace;
  const updated = { sessionId: checkpoint.sessionId, reviewedAt: checkpoint.reviewedAt, decision, decidedAt: now.toISOString() };
  return { ...workspace, tutorCheckpointDecisions: [...(workspace.tutorCheckpointDecisions ?? []).filter(item => item.sessionId !== checkpoint.sessionId), updated].slice(-300) };
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
