import type { Note, QuizQuestion } from "./model.ts";
import { projectManagementLearning } from "./project-management-learning.ts";
import { noteLearningVisuals, quizLearningNotes } from "./quiz-learning.ts";

export function learningQuestionFingerprint(question: Pick<QuizQuestion, "subject" | "concept" | "prompt">): string {
  const value = [question.subject, question.concept, question.prompt].join("\n");
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function curatedQuestion(question: QuizQuestion) {
  if (question.subject !== projectManagementLearning.subject) return undefined;
  const mapping = projectManagementLearning.questions[question.id];
  return mapping?.fingerprint === learningQuestionFingerprint(question) ? mapping : undefined;
}

export function withLearningNotes(question: QuizQuestion, notes?: Note[]): QuizQuestion {
  if (question.noteIds !== undefined) return question;
  const mapping = curatedQuestion(question);
  if (!mapping) return question;
  const available = notes && new Set(notes.map(note => note.id));
  return { ...question, noteIds: available ? mapping.noteIds.filter(id => available.has(id)) : mapping.noteIds };
}

// ZIP imports replace private media UUIDs. Keep every other part of a validated,
// standalone image unchanged so captions, alt text and syntax must still agree.
// This is matching metadata only and is never passed to the Markdown renderer.
export function imageLearningSignature(markdown: string): string {
  const visuals = noteLearningVisuals(markdown);
  if (visuals.length !== 1 || visuals[0].kind !== "image" || visuals[0].markdown !== markdown.trim()) return "";
  return visuals[0].markdown.replace(/^(!\[(?:\\.|[^\]\\])*\]\(\s*<?\/api\/media\/)[0-9a-f-]{36}/i, "$1<image>");
}

export function questionLearningMaterial(question: QuizQuestion, notes: Note[]) {
  const linked = quizLearningNotes(withLearningNotes(question), notes);
  const curated = curatedQuestion(question);
  return linked.map(note => {
    const available = noteLearningVisuals(note.content);
    // Audited source questions use exact excerpts, including course-specific
    // variants. Changed/missing excerpts stay absent rather than showing a
    // different model as the explanation of the answer.
    // Removing another linked note does not make an originally audited note a
    // custom note: its first overview can differ from the question's course model.
    const hints = curated?.noteIds.includes(note.id) ? curated.visualHints.filter(hint => hint.noteId === note.id) : undefined;
    const visuals = hints !== undefined
      ? hints.flatMap(hint => {
        const exact = hint.contains ? available.filter(visual => visual.kind === hint.kind && visual.markdown.includes(hint.contains)) : [];
        if (exact.length || hint.kind !== "image" || !hint.imageSignature) return exact;
        const relocated = available.filter(visual => visual.kind === "image" && imageLearningSignature(visual.markdown) === hint.imageSignature);
        // The same caption can describe two distinct figures. Never choose one
        // arbitrarily after an import or silently replace an audited diagram.
        return relocated.length === 1 ? relocated : [];
      }).slice(0, 2)
      : available.slice(0, 1);
    return { note, visuals };
  });
}
