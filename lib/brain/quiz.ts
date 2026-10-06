import type { LearningReminder, QuizQuestion, QuizRun } from "./model.ts";

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
