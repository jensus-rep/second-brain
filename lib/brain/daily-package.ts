import type { DailyPackage, Flashcard, Note, QuizQuestion, QuizRun, Workspace } from "./model.ts";
import { DAILY_PACKAGE_DECK, dailyPackageSchema } from "./model.ts";
import { activateFlashcardSession, flashcardSessionForCollection } from "./flashcard-decks.ts";
import { collectionItems, flashcardPriority, learningCollections } from "./learning-collections.ts";
import type { LearningAction } from "./learning-resume.ts";
import { tutorDate } from "./learning-tutor.ts";
import { withLearningNotes } from "./quiz-content.ts";
import { latestQuestionResults } from "./quiz-preparation.ts";
import { getTopicAncestors } from "./topics.ts";

export const DAILY_REVIEW_CARDS = 8;
export const DAILY_PACKAGE_CARDS = 10;
export const DAILY_NEW_CARDS = 2;
export const DAILY_SHORT_CARDS = 3;
// Every new card returns several times, so the limit spans all packages of a day.
export const NEW_CARDS_PER_DAY = 5;
export const DAILY_QUESTIONS = 3;
const MAX_QUIZ_RUNS = 200;
const MIN_SECTION_WORDS = 60;
const MAX_SECTION_WORDS = 750;
const dayMs = 86_400_000;

export type NoteSection = { key: string; title: string; content: string; words: number };
export type DailyProposal = {
  short: boolean; cardIds: string[]; newCards: number; reading: { noteId: string; section: string } | null;
  subject: string | null; questionIds: string[]; minutes: number;
};
export type DailyStage = "ready" | "cards" | "read" | "quiz" | "done";
export type DailyStatus = {
  today: string; stage: DailyStage; package: DailyPackage | null; proposal: DailyProposal | null;
  action: LearningAction | null; completedToday: number; series: number; blockedByQuiz: boolean;
  remainingCards: number; section: NoteSection | null; note: Note | null;
};

const wordCount = (text: string) => text.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").split(/\s+/).filter(Boolean).length;
const plainHeading = (text: string) => text.replace(/[*_`]/g, "").trim().slice(0, 180);
const ordinal = (date: string) => Math.floor(Date.parse(date + "T00:00:00.000Z") / dayMs);
const skippedHeading = /^(\d+[.)]?\s*)?(quellen|literatur|verwandte gebiete|weiterführend)/i;

function splitLongBlock(title: string, text: string): { title: string; text: string }[] {
  if (wordCount(text) <= MAX_SECTION_WORDS) return [{ title, text }];
  const parts: string[][] = [[]];
  let fenced = false, words = 0;
  for (const paragraph of text.split(/\n\s*\n/)) {
    const count = wordCount(paragraph);
    if (!fenced && words && words + count > MAX_SECTION_WORDS) { parts.push([]); words = 0; }
    parts.at(-1)!.push(paragraph);
    words += count;
    if ((paragraph.match(/^\s*(```|~~~)/gm)?.length ?? 0) % 2) fenced = !fenced;
  }
  return parts.map((part, index) => ({ title: parts.length > 1 ? `${title} (Teil ${index + 1})` : title, text: part.join("\n\n") }));
}

// A section is roughly three minutes of reading. Headings stay the stable key,
// so editing a paragraph does not make an already read section look new.
export function noteSections(note: Pick<Note, "content">): NoteSection[] {
  const blocks: { title: string; lines: string[] }[] = [{ title: "Einführung", lines: [] }];
  let fenced = false;
  for (const line of note.content.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const heading = fenced ? null : /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) blocks.push({ title: plainHeading(heading[1]), lines: [line] });
    else if (!(blocks.length === 1 && /^#\s/.test(line))) blocks.at(-1)!.lines.push(line);
  }
  const merged: { title: string; text: string }[] = [];
  let lead = "";
  for (const block of blocks) {
    const text = block.lines.join("\n").trim();
    if (!text || skippedHeading.test(block.title)) continue;
    if (!merged.length && wordCount(lead + " " + text) < MIN_SECTION_WORDS) { lead = lead ? `${lead}\n\n${text}` : text; continue; }
    if (merged.length && wordCount(text) < MIN_SECTION_WORDS) { merged.at(-1)!.text += "\n\n" + text; continue; }
    merged.push({ title: block.title, text: lead ? `${lead}\n\n${text}` : text });
    lead = "";
  }
  if (lead && !merged.length) merged.push({ title: "Einführung", text: lead });
  const seen = new Map<string, number>();
  return merged.flatMap(block => splitLongBlock(block.title, block.text)).map(block => {
    const count = (seen.get(block.title) ?? 0) + 1;
    seen.set(block.title, count);
    const key = (count > 1 ? `${block.title} (${count})` : block.title).slice(0, 200);
    return { key, title: block.title, content: block.text, words: wordCount(block.text) };
  });
}

function domains(workspace: Workspace) {
  const cache = new Map<string, string>();
  return (topicId: string | null) => {
    if (!topicId) return "::ohne";
    if (!cache.has(topicId)) cache.set(topicId, getTopicAncestors(workspace.topics, topicId)[0]?.id ?? topicId);
    return cache.get(topicId)!;
  };
}

// Takes one card per domain in turn, so a package does not drift into one field.
function interleave<T>(items: T[], domainOf: (item: T) => string): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(domainOf(item), [...groups.get(domainOf(item)) ?? [], item]);
  const queues = [...groups.values()];
  const result: T[] = [];
  while (result.length < items.length) for (const queue of queues) { const next = queue.shift(); if (next !== undefined) result.push(next); }
  return result;
}

function dayEntry(workspace: Workspace, date: string) {
  return workspace.dailyPackageDays?.find(day => day.date === date) ?? { date, completed: 0, newCards: 0 };
}

function chooseCards(workspace: Workspace, short: boolean, now: number) {
  const notes = new Map(workspace.notes.map(note => [note.id, note]));
  const domainOfTopic = domains(workspace);
  const domainOf = (card: Flashcard) => domainOfTopic(card.noteId ? notes.get(card.noteId)?.topicId ?? null : null);
  const active = workspace.cards.filter(card => !card.noteId || notes.get(card.noteId)?.archived === false);
  const priority = (card: Flashcard) => flashcardPriority(card) ?? 2;
  // Cards that are not due yet stay out: rating one would push its interval up early.
  const reviews = active.filter(card => card.reviews > 0 && (Date.parse(card.dueAt) <= now || card.intervalDays === 0)).sort((a, b) =>
    Number(b.intervalDays === 0) - Number(a.intervalDays === 0) || priority(a) - priority(b) || a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id));
  const today = tutorDate(now);
  const plan = workspace.tutorPlan;
  const focus = plan?.targetDate && plan.targetDate >= today && workspace.learningFocus?.collectionId
    ? learningCollections(workspace).find(collection => collection.id === workspace.learningFocus?.collectionId) : null;
  const examIds = new Set(focus ? collectionItems(workspace, focus).cards.map(card => card.id) : []);
  const reviewLimit = short ? DAILY_SHORT_CARDS : DAILY_REVIEW_CARDS;
  const exam = interleave(reviews.filter(card => examIds.has(card.id)), domainOf).slice(0, Math.ceil(reviewLimit / 2));
  const taken = new Set(exam.map(card => card.id));
  const rest = interleave(reviews.filter(card => !taken.has(card.id)), domainOf).slice(0, reviewLimit - exam.length);
  const review = interleave([...exam, ...rest], domainOf);

  const room = Math.max(0, NEW_CARDS_PER_DAY - dayEntry(workspace, today).newCards);
  const created = (card: Flashcard) => (card.noteId ? notes.get(card.noteId)?.createdAt : "") ?? "";
  const fresh = active.filter(card => card.reviews === 0).sort((a, b) =>
    created(b).localeCompare(created(a)) || priority(a) - priority(b) || a.id.localeCompare(b.id));
  const free = (short ? DAILY_SHORT_CARDS : DAILY_PACKAGE_CARDS) - review.length;
  const newLimit = Math.min(room, free, short || review.length < DAILY_REVIEW_CARDS ? free : DAILY_NEW_CARDS);
  const added = fresh.slice(0, Math.max(0, newLimit));
  return { cardIds: [...review, ...added].map(card => card.id), newCards: added.length };
}

function linkedQuestions(workspace: Workspace) {
  return workspace.quizQuestions.map(question => withLearningNotes(question, workspace.notes));
}

function chooseReading(workspace: Workspace, questions: QuizQuestion[]) {
  const domainOfTopic = domains(workspace);
  const reads = workspace.noteReads ?? [];
  const readAt = new Map(reads.map(read => [JSON.stringify([read.noteId, read.section]), read.readAt]));
  const withQuestions = new Set(questions.flatMap(question => question.noteIds ?? []));
  const candidates = workspace.notes.filter(note => !note.archived && !note.title.startsWith("Quellen") && !note.tags.includes("quellen"))
    .map(note => ({ note, sections: noteSections(note), domain: domainOfTopic(note.topicId) })).filter(item => item.sections.length);
  if (!candidates.length) return null;
  const isRead = (note: Note, key: string) => readAt.has(JSON.stringify([note.id, key]));
  const lastRead = new Map<string, string>();
  const started = new Set(reads.map(read => read.noteId));
  for (const read of reads) {
    const domain = candidates.find(item => item.note.id === read.noteId)?.domain;
    if (domain && (lastRead.get(domain) ?? "") < read.readAt) lastRead.set(domain, read.readAt);
  }
  const order = [...new Set(candidates.map(item => item.domain))].sort((a, b) => (lastRead.get(a) ?? "").localeCompare(lastRead.get(b) ?? "") || a.localeCompare(b));
  for (const domain of order) {
    const unread = candidates.filter(item => item.domain === domain && item.sections.some(section => !isRead(item.note, section.key)));
    // A note that was started is finished before the next one begins.
    const pick = unread.sort((a, b) => Number(started.has(b.note.id)) - Number(started.has(a.note.id)) ||
      Number(withQuestions.has(b.note.id)) - Number(withQuestions.has(a.note.id)) ||
      b.note.createdAt.slice(0, 10).localeCompare(a.note.createdAt.slice(0, 10)) || a.note.title.localeCompare(b.note.title, "de"))[0];
    if (pick) return { noteId: pick.note.id, section: pick.sections.find(section => !isRead(pick.note, section.key))!.key };
  }
  const oldest = candidates.flatMap(item => item.sections.map(section => ({ noteId: item.note.id, section: section.key, at: readAt.get(JSON.stringify([item.note.id, section.key])) ?? "" })))
    .sort((a, b) => a.at.localeCompare(b.at))[0];
  return { noteId: oldest.noteId, section: oldest.section };
}

function hasRoomForRun(workspace: Workspace) {
  return workspace.quizRuns.length < MAX_QUIZ_RUNS || workspace.quizRuns.some(run => run.dailyPackageId && run.finishedAt);
}

// Daily runs would otherwise use up the shared round limit within months. Only
// older daily rounds make room; rounds started elsewhere are never removed.
export function withRoomForDailyRun(workspace: Workspace): Workspace {
  if (workspace.quizRuns.length < MAX_QUIZ_RUNS) return workspace;
  const oldest = workspace.quizRuns.filter(run => run.dailyPackageId && run.finishedAt).sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0];
  return oldest ? { ...workspace, quizRuns: workspace.quizRuns.filter(run => run.id !== oldest.id) } : workspace;
}

// Questions prove the section just read. Without linked ones, the weakest task
// of the same field is used, then the weakest task overall.
function chooseQuestions(workspace: Workspace, questions: QuizQuestion[], noteId: string | null) {
  if (!questions.length || !hasRoomForRun(workspace)) return { subject: null, questionIds: [] };
  const latest = latestQuestionResults(questions, workspace.quizRuns);
  const rank = (question: QuizQuestion) => { const result = latest.get(question.id); return !result ? 1 : result.correct ? 2 : 0; };
  const order = (a: QuizQuestion, b: QuizQuestion) => rank(a) - rank(b) ||
    (latest.get(a.id)?.answeredAt ?? "").localeCompare(latest.get(b.id)?.answeredAt ?? "") || a.difficulty - b.difficulty || a.id.localeCompare(b.id);
  const domainOfTopic = domains(workspace);
  const noteById = new Map(workspace.notes.map(note => [note.id, note]));
  const domain = noteId ? domainOfTopic(noteById.get(noteId)?.topicId ?? null) : null;
  const direct = noteId ? questions.filter(question => question.noteIds?.includes(noteId)) : [];
  const sameField = domain ? questions.filter(question => question.noteIds?.some(id => domainOfTopic(noteById.get(id)?.topicId ?? null) === domain)) : [];
  const pool = direct.length ? direct : sameField.length ? sameField : questions;
  const subject = [...pool].sort(order)[0].subject;
  const direct_ = pool.filter(question => question.subject === subject).sort(order);
  return { subject, questionIds: direct_.slice(0, DAILY_QUESTIONS).map(question => question.id) };
}

export function proposeDailyPackage(workspace: Workspace, short: boolean, now: number): DailyProposal | null {
  const cards = chooseCards(workspace, short, now);
  const questions = linkedQuestions(workspace);
  const reading = short ? null : chooseReading(workspace, questions);
  const quiz = short ? { subject: null, questionIds: [] as string[] } : chooseQuestions(workspace, questions, reading?.noteId ?? null);
  if (!cards.cardIds.length && !reading && !quiz.questionIds.length) return null;
  const note = reading && workspace.notes.find(item => item.id === reading.noteId);
  const words = note ? noteSections(note).find(section => section.key === reading!.section)?.words ?? 0 : 0;
  const minutes = Math.max(1, Math.round(cards.cardIds.length * 0.5 + words / 200 + quiz.questionIds.length * 0.7));
  return { short, ...cards, reading, ...quiz, minutes };
}

function remainingCards(workspace: Workspace, item: DailyPackage) {
  const session = flashcardSessionForCollection(workspace, DAILY_PACKAGE_DECK);
  if (session?.id !== item.id) return 0;
  const cards = new Map(workspace.cards.map(card => [card.id, card]));
  return session.queue.slice(session.index).filter(entry => { const card = cards.get(entry.id); return card && card.reviews === entry.reviews && card.dueAt === entry.dueAt; }).length;
}

function dailyRun(workspace: Workspace, item: DailyPackage): QuizRun | undefined {
  return workspace.quizRuns.find(run => run.dailyPackageId === item.id);
}

function questionsAvailable(workspace: Workspace, item: DailyPackage) {
  return item.questionIds.length > 0 && item.questionIds.every(id => workspace.quizQuestions.some(question => question.id === id && question.subject === item.subject));
}

function readingNote(workspace: Workspace, item: DailyPackage) {
  const note = item.reading ? workspace.notes.find(entry => entry.id === item.reading!.noteId) : undefined;
  return note && !note.archived && noteSections(note).length ? note : null;
}

function stageOf(workspace: Workspace, item: DailyPackage): Exclude<DailyStage, "ready"> {
  if (remainingCards(workspace, item) > 0) return "cards";
  if (readingNote(workspace, item) && !item.readAt) return "read";
  const run = dailyRun(workspace, item);
  if (run ? !run.finishedAt : questionsAvailable(workspace, item) && hasRoomForRun(workspace)) return "quiz";
  return "done";
}

// Consecutive learning days, where one missed day in a row is forgiven. Today
// only counts once a package is finished, so it never interrupts the series.
export function dailySeries(workspace: Workspace, today: string): number {
  const active = new Set((workspace.dailyPackageDays ?? []).filter(day => day.completed > 0).map(day => ordinal(day.date)));
  let day = ordinal(today), count = 0, missed = 0;
  if (!active.has(day)) day--;
  while (missed < 2) {
    if (active.has(day)) { count++; missed = 0; } else missed++;
    day--;
  }
  return count;
}

export function dailyPackageStatus(workspace: Workspace, now = Date.now()): DailyStatus {
  const today = tutorDate(now);
  const item = workspace.dailyPackage?.date === today ? workspace.dailyPackage : null;
  const stage = item ? stageOf(workspace, item) : "ready";
  const open = stage !== "ready" && stage !== "done" ? item : null;
  const openRun = workspace.quizRuns.find(run => !run.finishedAt);
  const ownRun = open && dailyRun(workspace, open);
  const blockedByQuiz = stage === "quiz" && !!openRun && openRun.id !== ownRun?.id;
  let action: LearningAction | null = null;
  if (stage === "cards") action = { kind: "resume-cards", collectionId: DAILY_PACKAGE_DECK, sessionId: open!.id, remaining: remainingCards(workspace, open!) };
  else if (stage === "quiz" && openRun) action = { kind: "resume-quiz", collectionId: openRun.collectionId ?? null, runId: openRun.id };
  else if (stage === "quiz") action = { kind: "checkpoint", collectionId: null, subject: open!.subject!, questionCount: open!.questionIds.length, questionIds: open!.questionIds, dailyPackageId: open!.id };
  const note = open ? readingNote(workspace, open) : null;
  return {
    today, stage, package: item, action, blockedByQuiz, note,
    proposal: open ? null : proposeDailyPackage(workspace, false, now),
    completedToday: dayEntry(workspace, today).completed, series: dailySeries(workspace, today),
    remainingCards: open ? remainingCards(workspace, open) : 0,
    section: note ? noteSections(note).find(section => section.key === open!.reading!.section) ?? noteSections(note)[0] ?? null : null,
  };
}

export function startDailyPackage(workspace: Workspace, id: string, short = false, now = Date.now()): Workspace {
  const today = tutorDate(now);
  const previous = workspace.dailyPackage;
  if (previous?.date === today && stageOf(workspace, previous) !== "done") throw new Error("Setze zuerst dein offenes Paket fort.");
  const proposal = proposeDailyPackage(workspace, short, now);
  if (!proposal) throw new Error("Für ein Paket fehlen gerade Karten, Notizen und Testaufgaben.");
  const startedAt = new Date(now).toISOString();
  const entry = dayEntry(workspace, today);
  const item = dailyPackageSchema.parse({
    id, date: today, number: entry.completed + 1, short, cardIds: proposal.cardIds, newCards: proposal.newCards, reading: proposal.reading,
    subject: proposal.subject, questionIds: proposal.questionIds, startedAt, readAt: null, completedAt: null,
  });
  const days = [...(workspace.dailyPackageDays ?? []).filter(day => day.date !== today), { ...entry, newCards: entry.newCards + proposal.newCards }]
    .sort((a, b) => a.date.localeCompare(b.date)).slice(-800);
  const cards = new Map(workspace.cards.map(card => [card.id, card]));
  const updated = item.cardIds.length
    ? activateFlashcardSession(workspace, { id, collectionId: DAILY_PACKAGE_DECK, mode: "all", index: 0, startedAt, updatedAt: startedAt,
      queue: item.cardIds.map(cardId => ({ id: cardId, reviews: cards.get(cardId)!.reviews, dueAt: cards.get(cardId)!.dueAt })) })
    : { ...workspace,
      ...(workspace.flashcardSession?.collectionId === DAILY_PACKAGE_DECK ? { flashcardSession: null } : {}),
      ...(workspace.pausedFlashcardSessions ? { pausedFlashcardSessions: workspace.pausedFlashcardSessions.filter(session => session.collectionId !== DAILY_PACKAGE_DECK) } : {}) };
  return { ...updated, dailyPackage: item, dailyPackageDays: days };
}

// Called in the same save as the step that may finish the package.
export function settleDailyPackage(workspace: Workspace, now = new Date()): Workspace {
  const item = workspace.dailyPackage;
  if (!item || item.completedAt || stageOf(workspace, item) !== "done") return workspace;
  const date = tutorDate(now);
  const entry = dayEntry(workspace, date);
  return { ...workspace, dailyPackage: { ...item, completedAt: now.toISOString() },
    dailyPackageDays: [...(workspace.dailyPackageDays ?? []).filter(day => day.date !== date), { ...entry, completed: entry.completed + 1 }]
      .sort((a, b) => a.date.localeCompare(b.date)).slice(-800) };
}

export function markDailyReading(workspace: Workspace, packageId: string, now = new Date()): Workspace {
  const item = workspace.dailyPackage;
  if (item?.id !== packageId || !item.reading || item.readAt) return workspace;
  const readAt = now.toISOString();
  return settleDailyPackage({ ...workspace, dailyPackage: { ...item, readAt },
    noteReads: [...(workspace.noteReads ?? []), { noteId: item.reading.noteId, section: item.reading.section, readAt }].slice(-1000) }, now);
}

export function validateDailyPackageQuiz(workspace: Workspace, run: QuizRun): void {
  const item = workspace.dailyPackage;
  if (!item || item.id !== run.dailyPackageId || run.subject !== item.subject || dailyRun(workspace, item) ||
    JSON.stringify(run.questions.map(question => question.id)) !== JSON.stringify(item.questionIds)) {
    throw new Error("Dein Tagespaket hat sich geändert. Öffne es erneut unter „Heute“.");
  }
}
