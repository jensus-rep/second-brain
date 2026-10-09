import type { LearningReminder, QuizQuestion, QuizRun, Workspace } from "./model.ts";

export const difficultyLabels = ["", "Grundlagen", "Anwendung", "Transfer"];
export function isCorrect(question: QuizQuestion, selected: string[]) {
  return selected.length === question.correctOptionIds.length && question.correctOptionIds.every(id => selected.includes(id));
}
const key = (subject: string, concept: string) => `${subject.trim().toLocaleLowerCase("de")}::${concept.trim().toLocaleLowerCase("de")}`;

export function learningProfile(questions: QuizQuestion[], runs: QuizRun[]) {
  const concepts = new Map<string, { subject: string; concept: string; level: number; streak: number; correct: number; wrong: number; lastWrong: boolean }>();
  for (const q of questions) concepts.set(key(q.subject, q.concept), { subject: q.subject, concept: q.concept, level: 1, streak: 0, correct: 0, wrong: 0, lastWrong: false });
  for (const run of [...runs].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    // Exam results influence training only after the simulation has ended.
    if (run.mode === "exam" && !run.finishedAt) continue;
    for (const answer of run.answers) {
      const q = run.questions.find(q => q.id === answer.questionId);
      const state = q && concepts.get(key(q.subject, q.concept));
      if (!q || !state) continue;
      if (isCorrect(q, answer.selectedOptionIds)) {
        state.correct++; state.lastWrong = false;
        if (q.difficulty >= state.level) {
          state.streak++;
          if (state.streak >= 2) { state.level = Math.min(3, state.level + 1); state.streak = 0; }
        }
      } else {
        state.wrong++; state.lastWrong = true; state.streak = 0; state.level = Math.max(1, state.level - 1);
      }
    }
  }
  return [...concepts.values()];
}

// Older finished runs keep only what grading and the learning profile need: IDs,
// subject, concept, difficulty, option IDs, correct options and the answers.
// Feedback, explanation and source are dropped. Prompt and option texts are dropped
// only while the bank holds the same wording, so restoreQuestion can show them again.
export const FULL_RUNS_PER_SUBJECT = 5;
export const ARCHIVED_EXPLANATION = "(gekürzt)";
export const ARCHIVED_TEXT = "-";
const archived = (q: QuizQuestion) => q.explanation === ARCHIVED_EXPLANATION;
const wordingArchived = (q: QuizQuestion) => archived(q) && q.prompt === ARCHIVED_TEXT;
const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every(id => b.includes(id));
// Same solution and option IDs: answers of the old run still fit this bank question.
const fits = (q: QuizQuestion, current: QuizQuestion | undefined): current is QuizQuestion =>
  !!current && sameIds(q.correctOptionIds, current.correctOptionIds) && sameIds(q.options.map(o => o.id), current.options.map(o => o.id));
const sameWording = (q: QuizQuestion, current: QuizQuestion | undefined): current is QuizQuestion =>
  fits(q, current) && q.prompt === current.prompt && q.options.every(o => current.options.find(c => c.id === o.id)?.text === o.text);
const withWording = (q: QuizQuestion, source: QuizQuestion) => ({ ...q, prompt: source.prompt, options: q.options.map(o => ({ ...o, text: source.options.find(c => c.id === o.id)!.text })) });

// `previous` is the workspace before this save. If its bank held the wording of an
// archived question and the new bank no longer does (edit, removal, import), the
// wording is written back into the run first, so nothing is lost.
export function compactQuizRuns(workspace: Workspace, previous?: Workspace, keep = FULL_RUNS_PER_SUBJECT): Workspace {
  const bank = new Map(workspace.quizQuestions.map(q => [q.id, q]));
  const oldBank = previous && previous.quizQuestions !== workspace.quizQuestions ? new Map(previous.quizQuestions.map(q => [q.id, q])) : null;
  const oldRuns = new Map(previous?.quizRuns.map(run => [run.id, run]));
  const finished = new Map<string, QuizRun[]>();
  for (const run of workspace.quizRuns) if (run.finishedAt) {
    const subject = run.subject.trim().toLocaleLowerCase("de");
    finished.set(subject, [...finished.get(subject) ?? [], run]);
  }
  const older = new Set<QuizRun>();
  for (const runs of finished.values()) {
    // Stable sort keeps the stored order for equal start times.
    for (const run of [...runs].sort((a, b) => a.startedAt.localeCompare(b.startedAt)).slice(0, Math.max(0, runs.length - keep))) older.add(run);
  }
  let changed = false;
  const quizRuns = workspace.quizRuns.map(run => {
    let runChanged = false;
    const questions = run.questions.map(original => {
      let q = original;
      if (oldBank && wordingArchived(q)) {
        const before = oldBank.get(q.id), now = bank.get(q.id);
        const archivedBefore = oldRuns.get(run.id)?.questions.find(old => old.id === q.id);
        if (archivedBefore && wordingArchived(archivedBefore) && fits(q, before) && !(sameWording(withWording(q, before), now))) q = withWording(q, before);
      }
      if (older.has(run)) {
        if (!archived(q)) q = { ...q, options: q.options.map(o => ({ ...o, feedback: "" })), explanation: ARCHIVED_EXPLANATION, source: "" };
        if (!wordingArchived(q) && sameWording(q, bank.get(q.id))) q = { ...q, prompt: ARCHIVED_TEXT, options: q.options.map(o => ({ ...o, text: ARCHIVED_TEXT })) };
      }
      if (q !== original) runChanged = true;
      return q;
    });
    if (!runChanged) return run;
    changed = true;
    return { ...run, questions };
  });
  return changed ? { ...workspace, quizRuns } : workspace;
}

// Display only: the restored question is never saved back into a run.
export function restoreQuestion(question: QuizQuestion, bank: QuizQuestion[]): QuizQuestion {
  if (!archived(question)) return question;
  const current = bank.find(q => q.id === question.id);
  if (!fits(question, current)) {
    const missing = `Die ausführliche Erklärung wird nur für die letzten ${FULL_RUNS_PER_SUBJECT} Runden je Fachthema gespeichert, und diese Aufgabe gibt es in deiner Aufgabensammlung nicht mehr in dieser Form.`;
    if (!wordingArchived(question)) return { ...question, explanation: missing };
    return { ...question, prompt: "Wortlaut nicht mehr verfügbar", options: question.options.map((o, i) => ({ ...o, text: `Antwort ${i + 1} (Wortlaut nicht mehr verfügbar)` })), explanation: missing };
  }
  const shown = wordingArchived(question) ? withWording(question, current) : question;
  return {
    ...shown, explanation: current.explanation, source: current.source,
    options: shown.options.map(o => ({ ...o, feedback: current.options.find(c => c.id === o.id && c.text === o.text)?.feedback ?? "" })),
  };
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}

export function selectQuestions(questions: QuizQuestion[], runs: QuizRun[], subject: string, mode: QuizRun["mode"], count: number, random = Math.random) {
  const pool = questions.filter(q => q.subject === subject);
  if (mode === "exam") return shuffled(pool, random).slice(0, count).map(q => ({ ...q, options: shuffled(q.options, random) }));
  const profile = learningProfile(pool, runs);
  const used = new Map<string, { count: number; last: string }>();
  for (const run of runs) for (const answer of run.answers) {
    const old = used.get(answer.questionId);
    used.set(answer.questionId, { count: (old?.count ?? 0) + 1, last: old && old.last > answer.answeredAt ? old.last : answer.answeredAt });
  }
  const groups = profile.sort((a, b) => Number(b.lastWrong) - Number(a.lastWrong) || a.correct - b.correct).map(state => {
    const candidates = pool.filter(q => key(q.subject, q.concept) === key(state.subject, state.concept));
    const distance = Math.min(...candidates.map(q => Math.abs(q.difficulty - state.level)));
    return candidates.filter(q => Math.abs(q.difficulty - state.level) === distance).sort((a, b) =>
      a.difficulty - b.difficulty || (used.get(a.id)?.count ?? 0) - (used.get(b.id)?.count ?? 0) || (used.get(a.id)?.last ?? "").localeCompare(used.get(b.id)?.last ?? "") || a.id.localeCompare(b.id));
  });
  const selected: QuizQuestion[] = [];
  // Prefer weaknesses while keeping other concepts in every round. Each concept gets
  // its closest available difficulty; a large count must not force harder tasks.
  while (selected.length < count && groups.some(group => group.length)) {
    for (const group of groups) { const q = group.shift(); if (q) selected.push(q); if (selected.length >= count) break; }
  }
  return selected.map(q => ({ ...q, options: shuffled(q.options, random) }));
}

export function reminderCalendar(reminder: LearningReminder, now = new Date()) {
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escape = (text: string) => text.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
  // RFC 5545 limits content lines to 75 octets, including the continuation space.
  const fold = (line: string) => {
    let result = "", bytes = 0;
    for (const character of line) {
      const size = new TextEncoder().encode(character).length;
      if (bytes + size > 75) { result += "\r\n "; bytes = 1; }
      result += character; bytes += size;
    }
    return result;
  };
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Second Brain//Lernerinnerung//DE", "BEGIN:VEVENT", `UID:${reminder.id}@second-brain`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(new Date(reminder.dueAt))}`, `DTEND:${stamp(new Date(Date.parse(reminder.dueAt) + 15 * 60000))}`, `SUMMARY:${escape("Lernrunde: " + reminder.subject)}`, "DESCRIPTION:Multiple-Choice-Aufgaben und Denkfehler in Second Brain wiederholen.", "BEGIN:VALARM", "TRIGGER:-PT10M", "ACTION:DISPLAY", "DESCRIPTION:Lernrunde beginnt in zehn Minuten", "END:VALARM", "END:VEVENT", "END:VCALENDAR", ""].map(fold).join("\r\n");
}
