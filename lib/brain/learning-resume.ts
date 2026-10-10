import type { Flashcard, FlashcardSession, LearningCollection, QuizQuestion, QuizRun, Workspace } from "./model.ts";
import { collectionItems, learningCollections } from "./learning-collections.ts";
import { preparationAreas, type PreparationArea } from "./quiz-preparation.ts";
import { isCorrect } from "./quiz.ts";

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
  | { kind: "review-cards"; mode: "due" }
  | { kind: "preparation"; subject: string; concept: string }
  | { kind: "checkpoint"; subject: string; questionCount: number }
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

function recentLearningResult(runs: QuizRun[]): LearningResult | null {
  const finished = newestRuns(runs.filter(run => !!run.finishedAt));
  const latest = finished[0];
  if (!latest?.finishedAt) return null;
  const correct = (run: QuizRun) => run.questions.filter(question => isCorrect(question, run.answers.find(answer => answer.questionId === question.id)?.selectedOptionIds ?? [])).length;
  const percent = (run: QuizRun) => Math.round(correct(run) / run.questions.length * 100);
  // Matching counts alone would compare different tasks and difficulty levels.
  // Even stable IDs may have been edited. Require the same saved tasks and
  // grading so wording or solution changes cannot masquerade as improvement.
  const previous = finished.slice(1).find(run =>
    run.subject === latest.subject && run.mode === latest.mode && run.preparationConcept === latest.preparationConcept &&
    run.questions.length === latest.questions.length && latest.questions.every(question => {
      const old = run.questions.find(item => item.id === question.id);
      return old && old.subject === question.subject && old.concept === question.concept && old.difficulty === question.difficulty && old.prompt === question.prompt &&
        old.options.length === question.options.length && old.options.every(option => question.options.some(item => item.id === option.id && item.text === option.text)) &&
        old.correctOptionIds.length === question.correctOptionIds.length && old.correctOptionIds.every(id => question.correctOptionIds.includes(id));
    }));
  const currentPercent = percent(latest), previousPercent = previous ? percent(previous) : null;
  return { runId: latest.id, correct: correct(latest), total: latest.questions.length, percent: currentPercent, finishedAt: latest.finishedAt, previousPercent, change: previousPercent === null ? null : currentPercent - previousPercent };
}

function currentWeaknesses(workspace: Workspace, questions: QuizQuestion[], runs: QuizRun[]): LearningWeakness[] {
  const bank = new Map(questions.map(question => [question.id, question]));
  const availableNotes = new Set(workspace.notes.map(note => note.id));
  const latest = new Map<string, { weakness: LearningWeakness; correct: boolean; time: number }>();
  for (const run of [...runs].sort((a, b) => runActivity(a) - runActivity(b))) {
    // Practice reveals its feedback immediately. An unfinished exam reveals no
    // results, including indirectly through recommendations and weaknesses.
    if (run.mode === "exam" && !run.finishedAt) continue;
    for (const answer of run.answers) {
      const saved = run.questions.find(question => question.id === answer.questionId);
      const current = bank.get(answer.questionId);
      if (!saved || !current || saved.subject !== current.subject || saved.concept !== current.concept) continue;
      const key = conceptKey(current.subject, current.concept), time = Date.parse(answer.answeredAt);
      if ((latest.get(key)?.time ?? -Infinity) > time) continue;
      latest.set(key, {
        time, correct: isCorrect(saved, answer.selectedOptionIds),
        weakness: { subject: current.subject, concept: current.concept, questionId: current.id, answeredAt: answer.answeredAt, noteIds: [...new Set(current.noteIds ?? [])].filter(id => availableNotes.has(id)) },
      });
    }
  }
  return [...latest.values()].filter(item => !item.correct).sort((a, b) => b.time - a.time).map(item => item.weakness);
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
  const contents = collection ? collectionItems(workspace, collection) : workspace;
  const scopedQuestions = missingSessionCollection ? [] : ("questions" in contents ? contents.questions : contents.quizQuestions);
  const cards = missingSessionCollection ? workspace.cards.filter(card => paused.session.queue.some(item => item.id === card.id)) : contents.cards;
  const subjects = [...new Set(scopedQuestions.map(question => question.subject))];
  // Keep a historical active run launchable even if its bank was edited. For an
  // ordinary focus, use only subject values that remain in the current bank.
  if (!active && subject && !subjects.includes(subject)) subject = null;
  if (!subject && subjects.length) {
    subject = history.find(run => (!collection || runMatchesLearningCollection(run, collection)) && subjects.includes(run.subject))?.subject ?? subjects[0];
  }
  const questions = subject ? scopedQuestions.filter(question => question.subject === subject) : scopedQuestions;
  const runs = missingSessionCollection ? [] : workspace.quizRuns.filter(run =>
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
  } else if (subject && questions.length) primaryAction = { ...scope, kind: "checkpoint", subject, questionCount: selectCheckpointQuestions(questions, runs, subject).length };
  else if (collection) primaryAction = { ...scope, kind: "open-collection" };
  return {
    ...scope, title: missingSessionCollection ? "Gespeicherte Lernrunde" : collection?.title ?? subject ?? "Dein Lernen", subject, subjects,
    areas, preparation: { completed: areas.filter(area => area.completed).length, total: areas.length },
    cards: { reviewed: cards.filter(card => card.reviews > 0).length, total: cards.length, due },
    recentResult: recentLearningResult(runs), weaknesses, primaryAction,
  };
}
