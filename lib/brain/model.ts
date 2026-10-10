import { z } from "zod";
import { getTopicAncestors } from "./topics.ts";

const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const title = z.string().trim().min(1, "Bitte einen Titel eingeben.").max(160);
export const topicSchema = z.object({ id, title, description: z.string().max(600), color: z.enum(["blue", "purple", "orange", "green"]), parentId: id.nullable().optional() });
export const noteSchema = z.object({
  id, title, summary: z.string().max(600), content: z.string().max(80000),
  topicId: id.nullable(), tags: z.array(z.string().trim().min(1).max(40)).max(20),
  relatedIds: z.array(id).max(100), favorite: z.boolean(), archived: z.boolean(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
export const pathSchema = z.object({
  id, title, description: z.string().max(600),
  steps: z.array(z.object({ id, noteId: id, objective: z.string().max(300) })).max(100),
});
export const flashcardSchema = z.object({
  id, question: z.string().trim().min(1, "Bitte eine Frage eingeben.").max(12000),
  answer: z.string().trim().min(1, "Bitte eine Antwort eingeben.").max(20000),
  noteId: id.nullable(), dueAt: z.string().datetime(),
  intervalDays: z.number().int().min(0).max(30), reviews: z.number().int().min(0),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable().optional(),
});
export const quizQuestionSchema = z.object({
  id, subject: title, concept: title, difficulty: z.number().int().min(1).max(3),
  noteIds: z.array(id).max(4).optional(),
  prompt: z.string().trim().min(1).max(3000),
  options: z.array(z.object({ id, text: z.string().trim().min(1).max(1000), feedback: z.string().max(2000) })).min(2).max(6),
  correctOptionIds: z.array(id).min(1).max(6), explanation: z.string().trim().min(1).max(4000),
  source: z.string().max(1000).refine(value => !value || /^https?:\/\//i.test(value), "Bitte eine HTTP- oder HTTPS-Quelle angeben."),
}).superRefine((question, ctx) => {
  if (question.noteIds && new Set(question.noteIds).size !== question.noteIds.length) {
    ctx.addIssue({ code: "custom", message: "Verknüpfte Lernnotizen müssen eindeutig sein." });
  }
  const ids = new Set(question.options.map(option => option.id));
  if (ids.size !== question.options.length || new Set(question.correctOptionIds).size !== question.correctOptionIds.length || question.correctOptionIds.some(option => !ids.has(option))) {
    ctx.addIssue({ code: "custom", message: "Antwortmöglichkeiten und richtige Antworten müssen eindeutig und gültig sein." });
  }
});
export const quizRunSchema = z.object({
  id, subject: title, mode: z.enum(["practice", "exam"]), startedAt: z.string().datetime(),
  preparationConcept: title.optional(),
  collectionId: id.optional(),
  deadlineAt: z.string().datetime().nullable(), finishedAt: z.string().datetime().nullable(),
  questions: z.array(quizQuestionSchema).min(1).max(30),
  answers: z.array(z.object({ questionId: id, selectedOptionIds: z.array(id).min(1).max(6), answeredAt: z.string().datetime(), reflection: z.string().max(1500) })).max(30),
}).superRefine((run, ctx) => {
  if (run.preparationConcept && (run.mode !== "practice" || run.questions.some(question => question.subject !== run.subject || question.concept !== run.preparationConcept))) {
    ctx.addIssue({ code: "custom", message: "Eine Vorbereitungseinheit muss zu ihrem Fachthema und Lernbereich gehören." });
  }
  if (new Set(run.questions.map(q => q.id)).size !== run.questions.length || new Set(run.answers.map(a => a.questionId)).size !== run.answers.length || run.answers.some(a => {
    const q = run.questions.find(q => q.id === a.questionId);
    return !q || new Set(a.selectedOptionIds).size !== a.selectedOptionIds.length || a.selectedOptionIds.some(id => !q.options.some(o => o.id === id));
  }) || (run.mode === "practice" && run.deadlineAt !== null) || (run.deadlineAt !== null && Date.parse(run.deadlineAt) <= Date.parse(run.startedAt))) {
    ctx.addIssue({ code: "custom", message: "Die Testrunde enthält ungültige Antworten oder Zeiten." });
  }
});
export const learningReminderSchema = z.object({ id, subject: title, dueAt: z.string().datetime(), completed: z.boolean() });
export const learningFocusSchema = z.object({
  collectionId: id.nullable(), subject: title.nullable(), updatedAt: z.string().datetime(),
});
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const timestamp = Date.parse(value + "T00:00:00.000Z");
  return value.slice(0, 4) !== "0000" && Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}, "Bitte ein gültiges Kalenderdatum angeben.");
export const tutorPlanSchema = z.object({
  goal: z.string().trim().max(300), targetDate: calendarDate.nullable(),
  weeklyDays: z.number().int().min(1).max(7), updatedAt: z.string().datetime(),
});
export const cardReviewDaySchema = z.object({
  date: calendarDate, collectionId: id.nullable(),
  reviewed: z.number().int().min(0), known: z.number().int().min(0),
}).superRefine((day, ctx) => {
  if (day.known > day.reviewed) ctx.addIssue({ code: "custom", path: ["known"], message: "Die sicheren Selbsteinschätzungen dürfen die Wiederholungen nicht übersteigen." });
});
export const flashcardSessionSchema = z.object({
  id, collectionId: id.nullable(), mode: z.enum(["due", "all"]),
  queue: z.array(z.object({ id, reviews: z.number().int().min(0), dueAt: z.string().datetime() })).max(3000),
  index: z.number().int().min(0), startedAt: z.string().datetime(), updatedAt: z.string().datetime(),
}).superRefine((session, ctx) => {
  if (new Set(session.queue.map(card => card.id)).size !== session.queue.length) {
    ctx.addIssue({ code: "custom", path: ["queue"], message: "Die Karten einer Lernrunde müssen eindeutig sein." });
  }
  if (session.index > session.queue.length) {
    ctx.addIssue({ code: "custom", path: ["index"], message: "Die Position muss innerhalb der Lernrunde liegen." });
  }
});
export const learningCollectionSchema = z.object({
  id, title, description: z.string().max(600),
  noteIds: z.array(id).max(1000), questionIds: z.array(id).max(1000),
  cardIds: z.array(id).max(3000), pathIds: z.array(id).max(100),
}).superRefine((collection, ctx) => {
  for (const key of ["noteIds", "questionIds", "cardIds", "pathIds"] as const) {
    if (new Set(collection[key]).size !== collection[key].length) {
      ctx.addIssue({ code: "custom", path: [key], message: "Die Verknüpfungen einer Lernsammlung müssen eindeutig sein." });
    }
  }
});
export const workspaceSchema = z.object({
  schemaVersion: z.literal(1), topics: z.array(topicSchema).max(100),
  notes: z.array(noteSchema).max(1000), paths: z.array(pathSchema).max(100),
  completedStepIds: z.array(id).max(10000),
  cards: z.array(flashcardSchema).max(3000).default([]),
  quizQuestions: z.array(quizQuestionSchema).max(1000).default([]),
  quizRuns: z.array(quizRunSchema).max(200).default([]),
  learningReminders: z.array(learningReminderSchema).max(100).default([]),
  learningCollections: z.array(learningCollectionSchema).max(100).default([]),
  learningFocus: learningFocusSchema.nullable().optional(),
  flashcardSession: flashcardSessionSchema.nullable().optional(),
  tutorPlan: tutorPlanSchema.optional(),
  cardReviewDays: z.array(cardReviewDaySchema).max(3000).optional(),
}).superRefine((data, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  for (const list of [data.notes, data.topics, data.paths, data.cards, data.quizQuestions, data.quizRuns, data.learningReminders, data.learningCollections]) {
    if (new Set(list.map(item => item.id)).size !== list.length) issue("IDs müssen eindeutig sein.");
  }
  if (data.quizRuns.filter(run => !run.finishedAt).length > 1) issue("Bitte die laufende Testrunde zuerst beenden.");
  const reviewKeys = (data.cardReviewDays ?? []).map(day => JSON.stringify([day.date, day.collectionId]));
  if (new Set(reviewKeys).size !== reviewKeys.length) issue("Kartenwiederholungen pro Tag und Lernsammlung müssen eindeutig sein.");
  const notes = new Set(data.notes.map(n => n.id));
  const topics = new Set(data.topics.map(t => t.id));
  const topicsById = new Map(data.topics.map(topic => [topic.id, topic]));
  for (const [index, topic] of data.topics.entries()) {
    const topicIssue = (message: string) => ctx.addIssue({ code: "custom", path: ["topics", index, "parentId"], message });
    if (!topic.parentId) continue;
    if (!topics.has(topic.parentId)) {
      topicIssue("Das übergeordnete Thema fehlt.");
      continue;
    }
    if (topic.parentId === topic.id) {
      topicIssue("Ein Thema kann nicht sich selbst untergeordnet sein.");
      continue;
    }
    const visited = new Set([topic.id]);
    let parentId: string | null | undefined = topic.parentId;
    while (parentId) {
      if (visited.has(parentId)) {
        topicIssue("Die Themenhierarchie darf keine Kreisverknüpfungen enthalten.");
        break;
      }
      visited.add(parentId);
      parentId = topicsById.get(parentId)?.parentId;
    }
  }
  const questions = new Set(data.quizQuestions.map(question => question.id));
  const cards = new Set(data.cards.map(card => card.id));
  const paths = new Set(data.paths.map(path => path.id));
  const steps = data.paths.flatMap(p => p.steps);
  const stepIds = new Set(steps.map(s => s.id));
  if (data.cards.some(card => card.noteId && !notes.has(card.noteId))) issue("Eine Lernkarte verweist auf eine fehlende Notiz.");
  if (data.quizQuestions.some(question => question.noteIds?.some(noteId => !notes.has(noteId)))) issue("Eine Testaufgabe verweist auf eine fehlende Lernnotiz.");
  for (const collection of data.learningCollections) {
    if (collection.noteIds.some(id => !notes.has(id))) issue("Eine Lernsammlung verweist auf eine fehlende Notiz.");
    if (collection.questionIds.some(id => !questions.has(id))) issue("Eine Lernsammlung verweist auf eine fehlende Testaufgabe.");
    if (collection.cardIds.some(id => !cards.has(id))) issue("Eine Lernsammlung verweist auf eine fehlende Lernkarte.");
    if (collection.pathIds.some(id => !paths.has(id))) issue("Eine Lernsammlung verweist auf einen fehlenden Lernpfad.");
  }
  if (stepIds.size !== steps.length) issue("Lernschritte müssen eindeutige IDs haben.");
  for (const n of data.notes) {
    if (n.topicId && !topics.has(n.topicId)) issue("Eine Notiz verweist auf ein fehlendes Thema.");
    if (n.relatedIds.some(related => !notes.has(related) || related === n.id)) issue("Ungültige Notizverknüpfung.");
  }
  if (steps.some(s => !notes.has(s.noteId))) issue("Ein Lernschritt verweist auf eine fehlende Notiz.");
  if (data.completedStepIds.some(step => !stepIds.has(step))) issue("Der Lernfortschritt enthält fehlende Schritte.");
});
export type Topic = z.infer<typeof topicSchema>;
export type Note = z.infer<typeof noteSchema>;
export type LearningPath = z.infer<typeof pathSchema>;
export type Flashcard = z.infer<typeof flashcardSchema>;
export type FlashcardPriority = NonNullable<Flashcard["priority"]>;
export type LearningCollection = z.infer<typeof learningCollectionSchema>;
export type LearningFocus = z.infer<typeof learningFocusSchema>;
export type FlashcardSession = z.infer<typeof flashcardSessionSchema>;
export type TutorPlan = z.infer<typeof tutorPlanSchema>;
export type CardReviewDay = z.infer<typeof cardReviewDaySchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type QuizRun = z.infer<typeof quizRunSchema>;
export type LearningReminder = z.infer<typeof learningReminderSchema>;
export type Snapshot = { workspace: Workspace; revision: number };
export const emptyWorkspace: Workspace = { schemaVersion: 1, notes: [], topics: [], paths: [], completedStepIds: [], cards: [], quizQuestions: [], quizRuns: [], learningReminders: [], learningCollections: [] };

export function reviewCard(card: Flashcard, known: boolean, now = new Date()): Flashcard {
  const intervalDays = known ? [1, 3, 7, 14, 30].find(days => days > card.intervalDays) ?? 30 : 0;
  return { ...card, intervalDays, reviews: card.reviews + 1, dueAt: new Date(now.getTime() + (known ? intervalDays * 86400000 : 600000)).toISOString() };
}

export function normalizeTags(value: string): string[] {
  return [...new Set(value.split(",").map(s => s.trim().toLocaleLowerCase("de")).filter(Boolean))];
}
export const MAX_WORKSPACE_BYTES = 4_000_000;
export function searchNotes(notes: Note[], query: string, topics: Topic[] = []): Note[] {
  const terms = query.toLocaleLowerCase("de").trim().split(/\s+/).filter(Boolean);
  return notes.filter(n => {
    const topicNames = n.topicId ? [...getTopicAncestors(topics, n.topicId).map(topic => topic.title), topics.find(t => t.id === n.topicId)?.title ?? ""] : [];
    const text = [n.title, n.summary, n.content, ...n.tags, ...topicNames].join(" ").toLocaleLowerCase("de");
    return terms.every(term => text.includes(term));
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function pathProgress(path: LearningPath, completed: string[]) {
  const done = path.steps.filter(step => completed.includes(step.id)).length;
  return { done, total: path.steps.length, percent: path.steps.length ? Math.round(done / path.steps.length * 100) : 0 };
}
