import { z } from "zod";

const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const title = z.string().trim().min(1, "Bitte einen Titel eingeben.").max(160);
export const topicSchema = z.object({ id, title, description: z.string().max(600), color: z.enum(["blue", "purple", "orange", "green"]) });
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
});
export const quizQuestionSchema = z.object({
  id, subject: title, concept: title, difficulty: z.number().int().min(1).max(3),
  prompt: z.string().trim().min(1).max(3000),
  options: z.array(z.object({ id, text: z.string().trim().min(1).max(1000), feedback: z.string().max(2000) })).min(2).max(6),
  correctOptionIds: z.array(id).min(1).max(6), explanation: z.string().trim().min(1).max(4000),
  source: z.string().max(1000).refine(value => !value || /^https?:\/\//i.test(value), "Bitte eine HTTP- oder HTTPS-Quelle angeben."),
}).superRefine((question, ctx) => {
  const ids = new Set(question.options.map(option => option.id));
  if (ids.size !== question.options.length || new Set(question.correctOptionIds).size !== question.correctOptionIds.length || question.correctOptionIds.some(option => !ids.has(option))) {
    ctx.addIssue({ code: "custom", message: "Antwortmöglichkeiten und richtige Antworten müssen eindeutig und gültig sein." });
  }
});
export const quizRunSchema = z.object({
  id, subject: title, mode: z.enum(["practice", "exam"]), startedAt: z.string().datetime(),
  deadlineAt: z.string().datetime().nullable(), finishedAt: z.string().datetime().nullable(),
  questions: z.array(quizQuestionSchema).min(1).max(30),
  answers: z.array(z.object({ questionId: id, selectedOptionIds: z.array(id).min(1).max(6), answeredAt: z.string().datetime(), reflection: z.string().max(1500) })).max(30),
}).superRefine((run, ctx) => {
  if (new Set(run.questions.map(q => q.id)).size !== run.questions.length || new Set(run.answers.map(a => a.questionId)).size !== run.answers.length || run.answers.some(a => {
    const q = run.questions.find(q => q.id === a.questionId);
    return !q || new Set(a.selectedOptionIds).size !== a.selectedOptionIds.length || a.selectedOptionIds.some(id => !q.options.some(o => o.id === id));
  }) || (run.mode === "practice" && run.deadlineAt !== null) || (run.deadlineAt !== null && Date.parse(run.deadlineAt) <= Date.parse(run.startedAt))) {
    ctx.addIssue({ code: "custom", message: "Die Testrunde enthält ungültige Antworten oder Zeiten." });
  }
});
export const learningReminderSchema = z.object({ id, subject: title, dueAt: z.string().datetime(), completed: z.boolean() });
export const workspaceSchema = z.object({
  schemaVersion: z.literal(1), topics: z.array(topicSchema).max(100),
  notes: z.array(noteSchema).max(1000), paths: z.array(pathSchema).max(100),
  completedStepIds: z.array(id).max(10000),
  cards: z.array(flashcardSchema).max(3000).default([]),
  quizQuestions: z.array(quizQuestionSchema).max(1000).default([]),
  quizRuns: z.array(quizRunSchema).max(200).default([]),
  learningReminders: z.array(learningReminderSchema).max(100).default([]),
}).superRefine((data, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  for (const list of [data.notes, data.topics, data.paths, data.cards, data.quizQuestions, data.quizRuns, data.learningReminders]) {
    if (new Set(list.map(item => item.id)).size !== list.length) issue("IDs müssen eindeutig sein.");
  }
  if (data.quizRuns.filter(run => !run.finishedAt).length > 1) issue("Bitte die laufende Testrunde zuerst beenden.");
  const notes = new Set(data.notes.map(n => n.id));
  const topics = new Set(data.topics.map(t => t.id));
  const steps = data.paths.flatMap(p => p.steps);
  const stepIds = new Set(steps.map(s => s.id));
  if (data.cards.some(card => card.noteId && !notes.has(card.noteId))) issue("Eine Lernkarte verweist auf eine fehlende Notiz.");
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
export type Workspace = z.infer<typeof workspaceSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type QuizRun = z.infer<typeof quizRunSchema>;
export type LearningReminder = z.infer<typeof learningReminderSchema>;
export type Snapshot = { workspace: Workspace; revision: number };
export const emptyWorkspace: Workspace = { schemaVersion: 1, notes: [], topics: [], paths: [], completedStepIds: [], cards: [], quizQuestions: [], quizRuns: [], learningReminders: [] };

export function reviewCard(card: Flashcard, known: boolean, now = new Date()): Flashcard {
  const intervalDays = known ? [1, 3, 7, 14, 30].find(days => days > card.intervalDays) ?? 30 : 0;
  return { ...card, intervalDays, reviews: card.reviews + 1, dueAt: new Date(now.getTime() + (known ? intervalDays * 86400000 : 600000)).toISOString() };
}

export function normalizeTags(value: string): string[] {
  return [...new Set(value.split(",").map(s => s.trim().toLocaleLowerCase("de")).filter(Boolean))];
}
export const MAX_WORKSPACE_BYTES = 1_800_000;
export function searchNotes(notes: Note[], query: string, topics: Topic[] = []): Note[] {
  const terms = query.toLocaleLowerCase("de").trim().split(/\s+/).filter(Boolean);
  return notes.filter(n => {
    const text = [n.title, n.summary, n.content, ...n.tags, topics.find(t => t.id === n.topicId)?.title ?? ""].join(" ").toLocaleLowerCase("de");
    return terms.every(term => text.includes(term));
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function pathProgress(path: LearningPath, completed: string[]) {
  const done = path.steps.filter(step => completed.includes(step.id)).length;
  return { done, total: path.steps.length, percent: path.steps.length ? Math.round(done / path.steps.length * 100) : 0 };
}
