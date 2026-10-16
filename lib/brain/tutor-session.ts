import type { Flashcard, QuizQuestion, QuizRun, TutorSession, Workspace } from "./model.ts";
import { tutorSessionSchema } from "./model.ts";
import { collectionItems, flashcardPriority, learningCollections } from "./learning-collections.ts";
import { resumableFlashcardSession, runMatchesLearningCollection, selectCheckpointQuestions, type LearningAction, type LearningRecommendation } from "./learning-resume.ts";
import { tutorCardContentFingerprint } from "./learning-tutor.ts";
import { latestQuestionResults, preparationAreas, selectAdaptivePreparationQuestions } from "./quiz-preparation.ts";
import { withLearningNotes } from "./quiz-content.ts";
import { ARCHIVED_TEXT, isCorrect } from "./quiz.ts";

export type TutorSessionProposal = Pick<TutorSession, "collectionId" | "subject" | "concept" | "reason" | "cardIds" | "questionIds"> & {
  title: string; description: string; noteIds: string[];
};
export type TutorSessionInsights = {
  phase: "ready" | "cards" | "quiz" | "result" | "resume" | "unavailable";
  session: TutorSession | null; proposal: TutorSessionProposal | null; next: TutorSessionProposal | null;
  action: LearningAction | null; title: string; description: string;
  cardProgress: { done: number; total: number; known: number };
  result: { runId: string; correct: number; total: number; percent: number; finishedAt: string } | null;
  progress: { covered: number; secure: number; total: number };
  untouched: string[]; weakConcepts: string[];
};

function sameTask(saved: QuizQuestion, current: QuizQuestion) {
  return saved.subject === current.subject && saved.concept === current.concept && saved.difficulty === current.difficulty &&
    saved.prompt === current.prompt && saved.options.length === current.options.length &&
    saved.options.every(option => current.options.some(item => item.id === option.id && item.text === option.text)) &&
    saved.correctOptionIds.length === current.correctOptionIds.length && saved.correctOptionIds.every(id => current.correctOptionIds.includes(id));
}

function sessionScope(workspace: Workspace, collectionId: string | null, subject: string | null, now: number) {
  const collection = collectionId ? learningCollections(workspace).find(item => item.id === collectionId) : null;
  if (collectionId && !collection) return null;
  const contents = collection ? collectionItems(workspace, collection) : { cards: workspace.cards, questions: workspace.quizQuestions };
  const questions = contents.questions.filter(question => !subject || question.subject === subject).map(question => withLearningNotes(question, workspace.notes));
  const noteIds = new Set(workspace.notes.filter(note => !note.archived).map(note => note.id));
  // A subject-specific round only uses cards explicitly linked to that subject.
  // Cards without links remain available in a cards-only collection.
  const questionNotes = new Set(questions.flatMap(question => question.noteIds ?? []));
  const cards = contents.cards.filter(card => (!card.noteId || noteIds.has(card.noteId)) &&
    (!subject || !questions.length || !!card.noteId && questionNotes.has(card.noteId)));
  const runs = workspace.quizRuns.filter(run => (!collection || runMatchesLearningCollection(run, collection)) &&
    (!subject || run.subject === subject) && Date.parse(run.startedAt) <= now &&
    (run.mode !== "exam" || !!run.finishedAt && Date.parse(run.finishedAt) <= now))
    .map(run => ({ ...run, answers: run.answers.filter(answer => Date.parse(answer.answeredAt) <= now &&
      !run.questions.some(question => question.id === answer.questionId && question.prompt === ARCHIVED_TEXT)) }));
  return { cards, questions, runs };
}

function cardComparator(workspace: Workspace, collectionId: string | null, now: number) {
  const byId = new Map(workspace.cards.map(card => [card.id, card]));
  const ratings = new Map<string, { known: boolean; reviewedAt: string }>();
  for (const event of workspace.cardReviewEvents ?? []) {
    const card = byId.get(event.cardId);
    if (!card || event.collectionId !== collectionId || card.noteId !== event.noteId ||
      event.contentFingerprint !== tutorCardContentFingerprint(card) || Date.parse(event.reviewedAt) > now) continue;
    const previous = ratings.get(card.id);
    if (!previous || previous.reviewedAt <= event.reviewedAt) ratings.set(card.id, event);
  }
  const rank = (card: Flashcard) => ratings.get(card.id)?.known === false ? 0 : Date.parse(card.dueAt) <= now ? 1 : card.reviews === 0 ? 2 : 3;
  return (a: Flashcard, b: Flashcard) =>
    rank(a) - rank(b) || (flashcardPriority(a) ?? 2) - (flashcardPriority(b) ?? 2) ||
    a.reviews - b.reviews || a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id);
}

function selectProposal(workspace: Workspace, recommendation: LearningRecommendation, now: number) {
  const scope = sessionScope(workspace, recommendation.collectionId, recommendation.subject, now);
  const empty = { proposal: null, progress: { covered: 0, secure: 0, total: 0 }, untouched: [], weakConcepts: [] };
  if (!scope) return empty;
  const latest = latestQuestionResults(scope.questions, scope.runs);
  // Finishing early is evidence of an open task, even when an older round had
  // a correct answer. A later actual answer clears this open-task marker.
  const missing = new Map<string, string>();
  for (const run of scope.runs) {
    if (!run.finishedAt || !run.tutorSessionId) continue;
    for (const question of run.questions) {
      const current = scope.questions.find(item => item.id === question.id);
      if (!current || !sameTask(question, current) || run.answers.some(answer => answer.questionId === question.id)) continue;
      const answered = latest.get(question.id);
      if (answered && answered.answeredAt >= run.finishedAt) continue;
      const previous = missing.get(question.id);
      if (!previous || previous < run.finishedAt) missing.set(question.id, run.finishedAt);
    }
  }
  const availableConcepts = recommendation.subject
    ? preparationAreas({ ...workspace, quizQuestions: scope.questions, quizRuns: scope.runs }, recommendation.subject).map(area => area.concept)
    : [...new Set(scope.questions.map(question => question.concept))];
  const week = workspace.tutorWeek?.collectionId === recommendation.collectionId && workspace.tutorWeek.subject === recommendation.subject ? workspace.tutorWeek : null;
  const requestedOrder = workspace.tutorPlan?.conceptOrder?.length ? workspace.tutorPlan.conceptOrder : week?.topicOrder ?? [];
  const preferred = requestedOrder.filter(concept => availableConcepts.includes(concept));
  const ordered = [...new Set([...preferred, ...availableConcepts])];
  const areas = ordered.map(concept => {
    const questions = scope.questions.filter(question => question.concept === concept);
    return { concept, questions, covered: questions.some(question => latest.has(question.id)),
      secure: questions.every(question => latest.get(question.id)?.correct && !missing.has(question.id)),
      wrongAt: questions.flatMap(question => missing.has(question.id) ? [missing.get(question.id)!]
        : latest.get(question.id)?.correct === false ? [latest.get(question.id)!.answeredAt] : []).sort().at(-1) };
  });
  const untouched = areas.filter(area => !area.covered).map(area => area.concept);
  const weakConcepts = areas.filter(area => !!area.wrongAt).sort((a, b) => b.wrongAt!.localeCompare(a.wrongAt!)).map(area => area.concept);
  const progress = { covered: areas.filter(area => area.covered).length, secure: areas.filter(area => area.secure).length, total: areas.length };
  const next = areas.find(area => area.concept === weakConcepts[0]) ?? areas.find(area => !area.covered) ?? areas.find(area => !area.secure);
  const reason: TutorSession["reason"] = weakConcepts.length ? "repair" : next && !next.covered ? "foundation" : next ? "practice" : "refresh";
  const subject = recommendation.subject ?? next?.questions[0]?.subject ?? scope.questions[0]?.subject ?? null;
  const unanswered = next?.questions.filter(question => missing.has(question.id)) ?? [];
  const selected = next && subject
    ? [...unanswered, ...selectAdaptivePreparationQuestions(scope.questions, scope.runs, subject, next.concept).filter(question => !unanswered.some(item => item.id === question.id))].slice(0, 3)
    : subject ? selectCheckpointQuestions(scope.questions, scope.runs, subject, 3) : [];
  const noteIds = [...new Set((next?.questions ?? selected).flatMap(question => question.noteIds ?? []))]
    .filter(id => workspace.notes.some(note => note.id === id && !note.archived));
  const relevantCards = next ? scope.cards.filter(card => !!card.noteId && noteIds.includes(card.noteId)) : scope.cards;
  const cards = [...relevantCards].sort(cardComparator(workspace, recommendation.collectionId, now)).slice(0, 5);
  if (!cards.length && !selected.length) return { ...empty, progress, untouched, weakConcepts };
  const title = next ? next.concept : subject ? "Wissen festigen" : recommendation.title;
  const rationale = reason === "repair" ? `Bei „${title}“ sind noch Testantworten falsch. Wir schließen diese Lücke zuerst.`
    : reason === "foundation" ? `„${title}“ wurde noch nicht geprüft. Wir nehmen diesen Grundlagenbereich als Nächstes auf.`
      : reason === "practice" ? `„${title}“ wurde bereits begonnen. Jetzt folgen die noch offenen Aufgaben.`
        : selected.length ? "Die bisherigen Aufgaben wurden richtig beantwortet. Wir festigen den Abruf mit einer kurzen gemischten Einheit."
          : "Wir wiederholen die fälligen und noch unsicheren Karten in einer kurzen Einheit.";
  const route = cards.length && selected.length ? `${cards.length} Karten, danach ${selected.length} Testaufgaben.`
    : cards.length ? `${cards.length} Karten. Für diesen Bereich gibt es noch keine Testaufgaben.`
      : `${selected.length} Testaufgaben. Für diesen Bereich gibt es noch keine passenden Lernkarten.`;
  const proposal: TutorSessionProposal = { collectionId: recommendation.collectionId, subject, concept: next?.concept ?? null,
    reason, cardIds: cards.map(card => card.id), questionIds: selected.map(question => question.id), title, description: `${rationale} ${route}`, noteIds };
  return { proposal, progress, untouched, weakConcepts };
}

function reviewedSessionCards(workspace: Workspace, session: TutorSession, now: number) {
  const cards = new Map(workspace.cards.map(card => [card.id, card]));
  const reviews = new Map<string, boolean>();
  for (const event of [...(workspace.cardReviewEvents ?? [])].sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt))) {
    const card = cards.get(event.cardId);
    if (event.sessionId === session.id && event.collectionId === session.collectionId && session.cardIds.includes(event.cardId) &&
      card && card.noteId === event.noteId && tutorCardContentFingerprint(card) === event.contentFingerprint &&
      Date.parse(event.reviewedAt) >= Date.parse(session.startedAt) && Date.parse(event.reviewedAt) <= now) reviews.set(event.cardId, event.known);
  }
  return reviews;
}

export function tutorSessionInsights(workspace: Workspace, recommendation: LearningRecommendation, now = Date.now()): TutorSessionInsights {
  const active = workspace.quizRuns.find(run => !run.finishedAt);
  const paused = resumableFlashcardSession(workspace);
  const saved = workspace.tutorSession;
  // The general recommendation keeps deleted-source rounds launchable with a
  // null collection. Their historical scope must still constrain evidence;
  // it does not authorize borrowing the user's unrelated global task bank.
  const historicalCollectionId = active?.collectionId ?? (!active ? paused?.session.collectionId : null) ?? null;
  const historicalSubject = active?.subject ?? (!active && paused && saved && paused.session.id === saved.id ? saved.subject : null);
  const scopeCollectionId = recommendation.collectionId ?? historicalCollectionId;
  const scopeRecommendation = { ...recommendation, collectionId: scopeCollectionId, subject: recommendation.subject ?? historicalSubject };
  const unavailableScope = !!scopeCollectionId && !learningCollections(workspace).some(collection => collection.id === scopeCollectionId);
  const planned = selectProposal(workspace, scopeRecommendation, now);
  const initial: TutorSessionInsights = { ...planned, phase: planned.proposal ? "ready" : "unavailable", session: null, next: null,
    action: planned.proposal ? { kind: "tutor-session", collectionId: scopeCollectionId } : null,
    title: planned.proposal?.title ?? "Noch keine passende Einheit", description: planned.proposal?.description ?? "Ergänze passende Lernkarten oder Testaufgaben in deiner Lernsammlung.",
    cardProgress: { done: 0, total: planned.proposal?.cardIds.length ?? 0, known: 0 }, result: null };
  const session = saved && saved.collectionId === scopeCollectionId && saved.subject === scopeRecommendation.subject ? saved : null;
  if (active) {
    const activeSession = saved && active.tutorSessionId === saved.id ? saved : null;
    const reviews = activeSession ? reviewedSessionCards(workspace, activeSession, now) : null;
    return { ...initial, session: activeSession, phase: "resume",
      ...(activeSession && reviews ? { cardProgress: { done: reviews.size, total: activeSession.cardIds.length, known: [...reviews.values()].filter(Boolean).length } } : {}),
      action: { kind: "resume-quiz", collectionId: active.collectionId ?? null, runId: active.id },
      ...(active.examSimulation
        ? { title: "Deine Prüfungssimulation fortsetzen", description: `${active.answers.length} von ${active.questions.length} Aufgaben sind beantwortet und gespeichert. Gib die Simulation zuerst ab; danach geht es mit kurzen Einheiten weiter.` }
        : { title: "Deinen Test fortsetzen", description: "Deine bisherigen Antworten sind gespeichert. Wir beenden zuerst diese kurze Runde." }) };
  }
  if (paused && paused.session.id !== session?.id) return { ...initial, phase: "resume",
    action: { kind: "resume-cards", collectionId: paused.session.collectionId, sessionId: paused.session.id, remaining: paused.remaining.length },
    title: "Deine Kartenrunde fortsetzen", description: "Die offene Kartenposition bleibt gespeichert. Wir schließen zuerst diese Runde ab." };
  if (!session) return initial;
  const reviews = reviewedSessionCards(workspace, session, now);
  const cardProgress = { done: reviews.size, total: session.cardIds.length, known: [...reviews.values()].filter(Boolean).length };
  const state = { ...initial, session, cardProgress };
  const result = workspace.quizRuns.filter(run => run.tutorSessionId === session.id && run.subject === session.subject &&
    (run.collectionId ?? null) === session.collectionId && run.mode === "exam" && run.finishedAt && Date.parse(run.finishedAt) <= now &&
    Date.parse(run.startedAt) >= Date.parse(session.startedAt) && run.questions.length === session.questionIds.length &&
    run.questions.every(question => session.questionIds.includes(question.id)))
    .sort((a, b) => b.finishedAt!.localeCompare(a.finishedAt!))[0];
  if (result || !session.questionIds.length && reviews.size === session.cardIds.length) {
    const correct = result?.questions.filter(question => isCorrect(question, result.answers.find(answer => answer.questionId === question.id)?.selectedOptionIds ?? [])).length ?? 0;
    const feedback = result ? `${correct} von ${result.questions.length} Testaufgaben richtig. ${correct === result.questions.length ? "Diese Runde ist abgeschlossen." : "Offene und falsche Aufgaben fließen in die nächste Einheit ein."}`
      : `${reviews.size} Karten wiederholt; ${cardProgress.known} selbst als sicher eingeschätzt. Für diese Sammlung liegt noch kein Testergebnis vor.`;
    return { ...state, phase: "result", next: planned.proposal,
      title: "Deine Einheit ist abgeschlossen", description: `${feedback}${planned.proposal ? ` Als Nächstes: ${planned.proposal.title}.` : ""}`,
      result: result ? { runId: result.id, correct, total: result.questions.length, percent: Math.round(correct / result.questions.length * 100), finishedAt: result.finishedAt! } : null };
  }
  if (paused?.session.id === session.id) return { ...state, phase: "cards",
    action: { kind: "resume-cards", collectionId: session.collectionId, sessionId: session.id, remaining: paused.remaining.length },
    title: session.concept ?? "Deine kurze Kartenrunde", description: `Noch ${paused.remaining.length} von ${session.cardIds.length} Karten. ${unavailableScope ? "Die frühere Lernsammlung ist nicht mehr verfügbar; deine gespeicherten Karten kannst du noch abschließen." : session.questionIds.length ? "Danach folgt der Kurztest." : "Danach schauen wir auf deinen Stand."}` };
  const scope = sessionScope(workspace, session.collectionId, session.subject, now);
  const available = scope && session.cardIds.every(id => scope.cards.some(card => card.id === id)) &&
    session.questionIds.every(id => scope.questions.some(question => question.id === id)) && reviews.size === session.cardIds.length;
  if (!available || !session.subject) return { ...state, phase: "unavailable",
    title: "Diese Einheit muss neu zusammengestellt werden", description: "Karten oder Aufgaben haben sich geändert. Deine bisherigen Ergebnisse bleiben gespeichert; stelle die nächste kurze Einheit mit dem aktuellen Bestand zusammen." };
  return { ...state, phase: "quiz", title: "Jetzt kurz prüfen", description: `${session.cardIds.length ? `${reviews.size} Karten wiederholt. ` : ""}Mit ${session.questionIds.length} Testaufgaben prüfen wir, was du anwenden kannst.`,
    action: { kind: "checkpoint", collectionId: session.collectionId, subject: session.subject, questionCount: session.questionIds.length,
      questionIds: session.questionIds, tutorSessionId: session.id } };
}

// The caller saves this change through the ordinary revision-aware workspace
// update. Creating the plan and its bounded queue happens in one revision.
export function startTutorSession(workspace: Workspace, recommendation: LearningRecommendation, sessionId: string, now = Date.now()): Workspace {
  const state = tutorSessionInsights(workspace, recommendation, now);
  if (workspace.quizRuns.some(run => !run.finishedAt) || resumableFlashcardSession(workspace) || state.phase === "quiz") {
    throw new Error("Setze zuerst deine offene Tutor-Einheit fort.");
  }
  const proposal = state.phase === "result" ? state.next : state.proposal;
  if (!proposal) throw new Error("Für diesen Lernfokus ist noch keine passende Einheit verfügbar.");
  if (workspace.tutorSession?.id === sessionId || workspace.quizRuns.some(run => run.tutorSessionId === sessionId) ||
    workspace.cardReviewEvents?.some(event => event.sessionId === sessionId)) throw new Error("Diese Tutor-Einheit wurde bereits angelegt.");
  const startedAt = new Date(now).toISOString();
  const session = tutorSessionSchema.parse({ id: sessionId, collectionId: proposal.collectionId, subject: proposal.subject,
    concept: proposal.concept, reason: proposal.reason, cardIds: proposal.cardIds, questionIds: proposal.questionIds, startedAt });
  const cards = session.cardIds.map(id => workspace.cards.find(card => card.id === id)!);
  return { ...workspace, tutorSession: session,
    flashcardSession: cards.length ? { id: session.id, collectionId: session.collectionId, mode: "all",
      queue: cards.map(card => ({ id: card.id, reviews: card.reviews, dueAt: card.dueAt })), index: 0, startedAt, updatedAt: startedAt } : null,
    learningFocus: { collectionId: session.collectionId, subject: session.subject, updatedAt: startedAt } };
}

// Validate again inside the saved update, so an outdated launch request cannot
// substitute changed tasks or skip the persisted card stage.
export function validateTutorSessionQuiz(workspace: Workspace, run: QuizRun): Workspace {
  if (!run.tutorSessionId) return workspace;
  const session = workspace.tutorSession;
  const now = Date.parse(run.startedAt);
  const scope = session && sessionScope(workspace, session.collectionId, session.subject, now);
  if (!session || !scope || !session.questionIds.length || run.tutorSessionId !== session.id || run.mode !== "exam" || run.subject !== session.subject ||
    (run.collectionId ?? null) !== session.collectionId || run.questions.length !== session.questionIds.length ||
    JSON.stringify(run.questions.map(question => question.id)) !== JSON.stringify(session.questionIds) || now < Date.parse(session.startedAt) ||
    reviewedSessionCards(workspace, session, now).size !== session.cardIds.length || session.cardIds.some(id => !scope.cards.some(card => card.id === id)) ||
    resumableFlashcardSession(workspace) ||
    workspace.quizRuns.some(item => item.tutorSessionId === session.id || !item.finishedAt) ||
    run.questions.some(question => !scope.questions.some(current => JSON.stringify(current) === JSON.stringify(question)))) {
    throw new Error("Die Tutor-Einheit hat sich geändert. Öffne den aktuellen Tutor und setze dort fort.");
  }
  return workspace;
}
