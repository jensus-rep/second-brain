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
export const workspaceSchema = z.object({
  schemaVersion: z.literal(1), topics: z.array(topicSchema).max(100),
  notes: z.array(noteSchema).max(1000), paths: z.array(pathSchema).max(100),
  completedStepIds: z.array(id).max(10000),
}).superRefine((data, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  for (const list of [data.notes, data.topics, data.paths]) {
    if (new Set(list.map(item => item.id)).size !== list.length) issue("IDs müssen eindeutig sein.");
  }
  const notes = new Set(data.notes.map(n => n.id));
  const topics = new Set(data.topics.map(t => t.id));
  const steps = data.paths.flatMap(p => p.steps);
  const stepIds = new Set(steps.map(s => s.id));
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
export type Workspace = z.infer<typeof workspaceSchema>;
export type Snapshot = { workspace: Workspace; revision: number };
export const emptyWorkspace: Workspace = { schemaVersion: 1, notes: [], topics: [], paths: [], completedStepIds: [] };

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
