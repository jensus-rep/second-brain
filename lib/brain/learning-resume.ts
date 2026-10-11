import type { Flashcard, FlashcardSession, LearningCollection, QuizQuestion, QuizRun, Workspace } from "./model.ts";
import { collectionItems, learningCollections } from "./learning-collections.ts";
import { latestQuestionResults, preparationAreas, selectAdaptivePreparationQuestions, type PreparationArea } from "./quiz-preparation.ts";
import { withLearningNotes } from "./quiz-content.ts";
import { ARCHIVED_TEXT, isCorrect, restoreQuestion } from "./quiz.ts";

export type LearningWeakness = {
  subject: string; concept: string; noteIds: string[]; questionId: string; answeredAt: string;
};
export type LearningResult = {
  runId: string; correct: number; total: number; percent: number; finishedAt: string;
  previousPercent: number | null; change: number | null;
};
type ActionScope = { collectionId: string | null };
export type LearningAction = ActionScope & (
  | { kind: "resume-quiz"; runId: string }
  | { kind: "resume-cards"; sessionId: string; remaining: number }
  | { kind: "review-concept"; subject: string; concept: string; noteIds: string[] }
  | { kind: "review-cards"; mode: "due" | "all"; cardIds?: string[] }
  | { kind: "preparation"; subject: string; concept: string; tutorWeekStartedOn?: string }
  | { kind: "checkpoint"; subject: string; questionCount: number; questionIds?: string[]; cardCheckpoint?: { sessionId: string; reviewedAt: string }; tutorWeekCheckpoint?: QuizRun["tutorWeekCheckpoint"] }
  | { kind: "open-collection" }
);
export type LearningRecommendation = {
  collectionId: string | null; title: string; subject: string | null; subjects: string[];
  areas: (PreparationArea & { subject: string })[];
  preparation: { completed: number; total: number };
  cards: { reviewed: number; total: number; due: number };
  recentResult: LearningResult | null;
  weaknesses: LearningWeakness[];
  primaryAction: LearningAction | null;
};
export type LearningContinuation = {
  collectionId: string | null;
  title: string;
  subject: string;
  action: Extract<LearningAction, { kind: "preparation" | "checkpoint" }> | null;
  reason: "repair" | "coverage" | "application" | "checkpoint" | "unavailable";
  concept: string | null;
  questionCount: number;
  questions: QuizQuestion[];
  noteIds: string[];
  progress: { covered: number; total: number; secure: number };
  description: string;
};

const runActivity = (run: QuizRun) => Math.max(Date.parse(run.startedAt), ...run.answers.map(answer => Date.parse(answer.answeredAt)), run.finishedAt ? Date.parse(run.finishedAt) : 0);
const newestRuns = (runs: QuizRun[]) => [...runs].sort((a, b) => runActivity(b) - runActivity(a));
const conceptKey = (subject: string, concept: string) => JSON.stringify([subject, concept]);

// A legacy run belongs to a selection only when every saved question belongs to
// it. Partial overlap must not claim progress in a smaller learning collection.
export function runMatchesLearningCollection(run: QuizRun, collection: LearningCollection): boolean {
  if (run.collectionId) return run.collectionId === collection.id;
  const questionIds = new Set(collection.questionIds);
  return run.questions.length > 0 && run.questions.every(question => questionIds.has(question.id));
}

export function resumableFlashcardSession(workspace: Workspace): { session: FlashcardSession; remaining: Flashcard[] } | null {
  const session = workspace.flashcardSession;
  if (!session || session.index >= session.queue.length) return null;
  const collection = session.collectionId ? learningCollections(workspace).find(item => item.id === session.collectionId) : null;
  // A deleted collection does not destroy its saved queue. Only original card
  // IDs with unchanged scheduling snapshots can be resumed in that case.
  const cards = collection ? collectionItems(workspace, collection).cards : workspace.cards;
  const byId = new Map(cards.map(card => [card.id, card]));
  const remaining = session.queue.slice(session.index).flatMap(snapshot => {
    const card = byId.get(snapshot.id);
    return card && card.reviews === snapshot.reviews && card.dueAt === snapshot.dueAt ? [card] : [];
  });
  return remaining.length ? { session, remaining } : null;
}

// Percentages measure a change only when the same tasks were answered under
// the same conditions. A fully compacted snapshot lacks its original wording;
// a later import may have changed the bank, so it cannot prove equivalence.
export function comparableLearningRuns(a: QuizRun, b: QuizRun, bank: QuizQuestion[] = []): boolean {
  const timeLimit = (run: QuizRun) => run.deadlineAt ? Date.parse(run.deadlineAt) - Date.parse(run.startedAt) : null;
  return a.subject === b.subject && a.mode === b.mode && a.preparationConcept === b.preparationConcept &&
    timeLimit(a) === timeLimit(b) &&
    a.questions.length === b.questions.length && a.questions.every(saved => {
      const previous = b.questions.find(question => question.id === saved.id);
      if (!previous) return false;
      if (saved.prompt === ARCHIVED_TEXT || previous.prompt === ARCHIVED_TEXT) return false;
      const current = restoreQuestion(saved, bank), old = restoreQuestion(previous, bank);
      return current.prompt !== ARCHIVED_TEXT && old.prompt !== ARCHIVED_TEXT &&
        current.prompt !== "Wortlaut nicht mehr verfügbar" && old.prompt !== "Wortlaut nicht mehr verfügbar" &&
        old.subject === current.subject && old.concept === current.concept && old.difficulty === current.difficulty && old.prompt === current.prompt &&
        old.options.length === current.options.length && old.options.every(option => current.options.some(item => item.id === option.id && item.text === option.text)) &&
        old.correctOptionIds.length === current.correctOptionIds.length && old.correctOptionIds.every(id => current.correctOptionIds.includes(id));
    });
}

function recentLearningResult(runs: QuizRun[], bank: QuizQuestion[]): LearningResult | null {
  const finished = newestRuns(runs.filter(run => !!run.finishedAt));
  const latest = finished[0];
  if (!latest?.finishedAt) return null;
  const correct = (run: QuizRun) => run.questions.filter(question => isCorrect(question, run.answers.find(answer => answer.questionId === question.id)?.selectedOptionIds ?? [])).length;
  const percent = (run: QuizRun) => Math.round(correct(run) / run.questions.length * 100);
  // Matching counts alone would compare different tasks and difficulty levels.
  // Even stable IDs may have been edited. Require the same saved tasks and
  // grading so wording or solution changes cannot masquerade as improvement.
  const previous = finished.slice(1).find(run => comparableLearningRuns(latest, run, bank));
  const currentPercent = percent(latest), previousPercent = previous ? percent(previous) : null;
  return { runId: latest.id, correct: correct(latest), total: latest.questions.length, percent: currentPercent, finishedAt: latest.finishedAt, previousPercent, change: previousPercent === null ? null : currentPercent - previousPercent };
}

function currentWeaknesses(workspace: Workspace, questions: QuizQuestion[], runs: QuizRun[]): LearningWeakness[] {
  const availableNotes = new Set(workspace.notes.map(note => note.id));
  const latest = latestQuestionResults(questions, runs);
  const concepts = new Map<string, LearningWeakness>();
  for (const current of questions) {
    const result = latest.get(current.id);
    if (!result || result.correct) continue;
    const key = conceptKey(current.subject, current.concept);
    const previous = concepts.get(key);
    const noteIds = [...new Set([...(previous?.noteIds ?? []), ...(current.noteIds ?? [])])].filter(id => availableNotes.has(id));
    const newer = !previous || previous.answeredAt <= result.answeredAt;
    concepts.set(key, newer
      ? { subject: current.subject, concept: current.concept, questionId: current.id, answeredAt: result.answeredAt, noteIds }
      : { ...previous, noteIds });
  }
  return [...concepts.values()].sort((a, b) => b.answeredAt.localeCompare(a.answeredAt));
}

// The finished round anchors the selection even when the global focus changes.
// Continue directly with exercises: repair, cover new concepts, work through
// remaining application tasks, then check the concepts together.
export function recommendLearningAfterRun(workspace: Workspace, run: QuizRun, collectionId?: string | null): LearningContinuation | null {
  if (!run.finishedAt) return null;
  const collections = learningCollections(workspace);
  const requestedId = run.collectionId ?? collectionId ?? null;
  const collection = requestedId
    ? collections.find(item => item.id === requestedId && runMatchesLearningCollection(run, item))
    : collectionId === undefined ? collections.find(item => runMatchesLearningCollection(run, item)) : undefined;
  const unavailable = !!requestedId && !collection;
  const scope = { collectionId: collection?.id ?? requestedId };
  const empty: LearningContinuation = {
    ...scope, title: collection?.title ?? (unavailable ? "Frühere Lernsammlung" : run.subject), subject: run.subject,
    action: null, reason: "unavailable", concept: null, questions: [], questionCount: 0, noteIds: [],
    progress: { covered: 0, total: 0, secure: 0 },
    description: unavailable ? "Diese Lernsammlung ist nicht mehr verfügbar. Wähle im Lernüberblick eine aktuelle Sammlung." : "Für diese Runde sind keine aktuellen Aufgaben mehr verfügbar.",
  };
  if (unavailable) return empty;
  const questions = collection ? collectionItems(workspace, collection).questions : workspace.quizQuestions.filter(question => question.subject === run.subject);
  if (!questions.length) return empty;
  const history = [...workspace.quizRuns.filter(item => item.id !== run.id), run].filter(item =>
    !!item.finishedAt && (collection ? runMatchesLearningCollection(item, collection) : item.subject === run.subject));
  const latest = latestQuestionResults(questions, history);
  const subjects = [...new Set(questions.map(question => question.subject))];
  const areas = subjects.flatMap(subject => preparationAreas({ ...workspace, quizQuestions: questions, quizRuns: history }, subject).map(area => ({ ...area, subject })));
  const areaQuestions = (subject: string, concept: string) => questions.filter(question => question.subject === subject && question.concept === concept);
  // "Covered" records work, not mastery. "Secure" means every task currently in
  // this concept has a correct latest answer, including available higher levels.
  const progress = {
    covered: areas.filter(area => areaQuestions(area.subject, area.concept).some(question => latest.has(question.id))).length,
    total: areas.length,
    secure: areas.filter(area => areaQuestions(area.subject, area.concept).every(question => latest.get(question.id)?.correct)).length,
  };
  const weaknesses = currentWeaknesses(workspace, questions, history);
  const weakness = weaknesses[0];
  const unanswered = questions.find(question => run.questions.some(saved => saved.id === question.id) &&
    !run.answers.some(answer => answer.questionId === question.id) && !latest.get(question.id)?.correct);
  const uncovered = areas.find(area => !areaQuestions(area.subject, area.concept).some(question => latest.has(question.id)));
  const openApplication = areas.find(area => areaQuestions(area.subject, area.concept).some(question => !latest.get(question.id)?.correct));
  const next = weakness ?? unanswered ?? uncovered ?? openApplication;
  if (next) {
    const reason = weakness || unanswered ? "repair" : uncovered ? "coverage" : "application";
    const selected = selectAdaptivePreparationQuestions(questions, history, next.subject, next.concept);
    const noteIds = [...new Set(selected.flatMap(question => question.noteIds ?? []))].filter(id => workspace.notes.some(note => note.id === id));
    const hasApplication = selected.some(question => question.difficulty === 2);
    const hasTransfer = selected.some(question => question.difficulty === 3);
    const advancedTasks = hasApplication && hasTransfer ? "Anwendungs- und Transferaufgaben" : hasTransfer ? "Transferaufgaben" : "Anwendungsaufgaben";
    const description = reason === "repair"
      ? `Bei „${next.concept}“ sind noch Antworten falsch oder offen. Wir greifen diese Aufgaben erneut auf und wenden die Erklärung direkt an.`
      : reason === "coverage"
        ? `„${next.concept}“ wurde noch nicht geübt. Damit deine Lernsammlung Schritt für Schritt vollständig abgedeckt wird, folgt jetzt dieser Bereich.`
        : hasApplication || hasTransfer
          ? `Du hast „${next.concept}“ bereits aufgegriffen. Jetzt festigst du den Bereich mit weiteren ${advancedTasks}.`
          : `Du hast „${next.concept}“ bereits aufgegriffen. Weitere Aufgaben festigen den Bereich und schließen noch offene Inhalte.`;
    return {
      ...empty, subject: next.subject, action: { ...scope, kind: "preparation", subject: next.subject, concept: next.concept },
      reason, concept: next.concept, questions: selected, questionCount: selected.length, noteIds, progress, description,
    };
  }
  const checkpointSubject = subjects.includes(run.subject) ? run.subject : subjects[0];
  const selected = selectCheckpointQuestions(questions, history, checkpointSubject).map(question => withLearningNotes(question));
  return {
    ...empty, subject: checkpointSubject, action: { ...scope, kind: "checkpoint", subject: checkpointSubject, questionCount: selected.length },
    reason: "checkpoint", questions: selected, questionCount: selected.length, progress,
    description: "Für alle aktuellen Aufgaben liegt eine richtige Antwort vor. Ein gemischter Kurztest prüft jetzt, ob du die Zusammenhänge auch ohne direkte Hinweise abrufen und anwenden kannst.",
  };
}

// A checkpoint samples the current subject across concepts. It never adds
// unavailable questions, repeats an ID, or exceeds a short six-task round.
export function selectCheckpointQuestions(questions: QuizQuestion[], runs: QuizRun[], subject: string, count = 6): QuizQuestion[] {
  const limit = Math.min(6, Math.max(0, Number.isFinite(count) ? Math.floor(count) : 6));
  const used = new Map<string, number>();
  for (const run of runs) {
    if (run.mode === "exam" && !run.finishedAt) continue;
    for (const answer of run.answers) used.set(answer.questionId, (used.get(answer.questionId) ?? 0) + 1);
  }
  const seen = new Set<string>();
  const pool = questions.filter(question => {
    if (question.subject !== subject || seen.has(question.id)) return false;
    seen.add(question.id);
    return true;
  });
  const concepts = [...new Set(pool.map(question => question.concept))];
  const groups = concepts.map(concept => pool.filter(question => question.concept === concept).sort((a, b) =>
    (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0) || a.difficulty - b.difficulty || a.id.localeCompare(b.id)));
  const selected: QuizQuestion[] = [];
  while (selected.length < limit && groups.some(group => group.length)) {
    for (const group of groups) {
      const question = group.shift();
      if (question) selected.push(question);
      if (selected.length >= limit) break;
    }
  }
  return selected;
}

export function recommendLearning(workspace: Workspace, now = Date.now()): LearningRecommendation {
  const collections = learningCollections(workspace);
  const active = newestRuns(workspace.quizRuns.filter(run => !run.finishedAt))[0];
  const paused = resumableFlashcardSession(workspace);
  const history = newestRuns(workspace.quizRuns);
  const findRunCollection = (run: QuizRun) => run.collectionId
    ? collections.find(collection => collection.id === run.collectionId)
    : collections.find(collection => runMatchesLearningCollection(run, collection));
  let collection: LearningCollection | undefined;
  let subject: string | null = null;
  const focus = workspace.learningFocus;
  if (active) {
    collection = findRunCollection(active);
    subject = active.subject;
  } else if (paused) {
    collection = collections.find(item => item.id === paused.session.collectionId);
    subject = focus?.collectionId === paused.session.collectionId ? focus.subject : null;
  } else if (focus && (!focus.collectionId || collections.some(item => item.id === focus.collectionId))) {
    collection = collections.find(item => item.id === focus.collectionId);
    subject = focus.subject;
  } else if (history[0]) {
    collection = findRunCollection(history[0]);
    subject = history[0].subject;
  } else {
    collection = collections[0];
  }

  const missingSessionCollection = !active && paused && paused.session.collectionId && !collection;
  const missingRunCollection = active?.collectionId && !collection;
  const unavailableCollection = missingSessionCollection || missingRunCollection;
  const contents = collection ? collectionItems(workspace, collection) : workspace;
  const scopedQuestions = unavailableCollection ? [] : ("questions" in contents ? contents.questions : contents.quizQuestions);
  const cards = missingSessionCollection ? workspace.cards.filter(card => paused.session.queue.some(item => item.id === card.id)) : missingRunCollection ? [] : contents.cards;
  const subjects = [...new Set(scopedQuestions.map(question => question.subject))];
  // Keep a historical active run launchable even if its bank was edited. For an
  // ordinary focus, use only subject values that remain in the current bank.
  if (!active && subject && !subjects.includes(subject)) subject = null;
  if (!subject && subjects.length) {
    subject = history.find(run => (!collection || runMatchesLearningCollection(run, collection)) && subjects.includes(run.subject))?.subject ?? subjects[0];
  }
  const questions = subject ? scopedQuestions.filter(question => question.subject === subject) : scopedQuestions;
  const runs = unavailableCollection ? [] : workspace.quizRuns.filter(run =>
    (!collection || runMatchesLearningCollection(run, collection)) && (!subject || run.subject === subject));
  const areaSubjects = subject ? [subject] : subjects;
  const areas = areaSubjects.flatMap(areaSubject => preparationAreas({ ...workspace, quizQuestions: questions, quizRuns: runs }, areaSubject).map(area => ({
    ...area, subject: areaSubject,
    // Explicit links stay useful across collection membership changes; inferred
    // note-title matches never create remediation recommendations.
    noteIds: [...new Set(questions.filter(question => question.subject === areaSubject && question.concept === area.concept).flatMap(question => question.noteIds ?? []))].filter(id => workspace.notes.some(note => note.id === id)),
  })));
  const weaknesses = currentWeaknesses(workspace, questions, runs);
  const due = cards.filter(card => Date.parse(card.dueAt) <= now).length;
  const scope = { collectionId: collection?.id ?? null };
  let primaryAction: LearningAction | null = null;
  if (active) primaryAction = { ...scope, kind: "resume-quiz", runId: active.id };
  else if (paused) primaryAction = { ...scope, kind: "resume-cards", sessionId: paused.session.id, remaining: paused.remaining.length };
  else if (weaknesses[0]) primaryAction = { ...scope, kind: "review-concept", subject: weaknesses[0].subject, concept: weaknesses[0].concept, noteIds: weaknesses[0].noteIds };
  else if (due) primaryAction = { ...scope, kind: "review-cards", mode: "due" };
  else if (areas.some(area => !area.completed)) {
    const next = areas.find(area => !area.completed)!;
    primaryAction = { ...scope, kind: "preparation", subject: next.subject, concept: next.concept };
  } else if (subject && questions.length) {
    const latest = latestQuestionResults(questions, runs);
    const remaining = areas.find(area => questions.some(question => question.subject === area.subject && question.concept === area.concept && !latest.get(question.id)?.correct));
    primaryAction = remaining
      ? { ...scope, kind: "preparation", subject: remaining.subject, concept: remaining.concept }
      : { ...scope, kind: "checkpoint", subject, questionCount: selectCheckpointQuestions(questions, runs, subject).length };
  }
  else if (cards.length) primaryAction = { ...scope, kind: "review-cards", mode: "all" };
  else if (collection) primaryAction = { ...scope, kind: "open-collection" };
  return {
    ...scope, title: unavailableCollection ? "Gespeicherte Lernrunde" : collection?.title ?? subject ?? "Dein Lernen", subject, subjects,
    areas, preparation: { completed: areas.filter(area => area.completed).length, total: areas.length },
    cards: { reviewed: cards.filter(card => card.reviews > 0).length, total: cards.length, due },
    recentResult: recentLearningResult(runs, workspace.quizQuestions), weaknesses, primaryAction,
  };
}
