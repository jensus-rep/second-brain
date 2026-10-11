"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Bell, Check, ClipboardCheck, Download, Pencil, Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FULL_RUNS_PER_SUBJECT, difficultyLabels, isCorrect, learningProfile, reminderCalendar, restoreQuestion, selectQuestions } from "@/lib/brain/quiz";
import { quizExamples } from "@/lib/brain/quiz-examples";
import { quizQuestionSchema, type LearningReminder, type QuizQuestion, type QuizRun, type Workspace } from "@/lib/brain/model";
import type { SaveWorkspace } from "@/lib/brain/use-brain";
import { withLearningNotes } from "@/lib/brain/quiz-content";
import { preparationAreas, selectPreparationQuestions } from "@/lib/brain/quiz-preparation";
import { recommendLearning, recommendLearningAfterRun, runMatchesLearningCollection, selectCheckpointQuestions, type LearningAction } from "@/lib/brain/learning-resume";
import { tutorSessionInsights, validateTutorSessionQuiz } from "@/lib/brain/tutor-session";
import { recordTutorCheckpoint, tutorCardCheckpoint } from "@/lib/brain/learning-tutor";
import { addToLearningCollection, collectionItems, learningCollections } from "@/lib/brain/learning-collections";
import { QuizResultSummary } from "./quiz-result";
import { QuizPreparation } from "./quiz-preparation";
import { QuizLearningMaterial } from "./quiz-learning-material";

type Props = { workspace: Workspace; save: SaveWorkspace; saving: boolean; onOpenNote?: (id: string) => void; onLearningAction?: (action: LearningAction) => void };
export type QuizLaunchRequest = { id: string; subject: string; concept?: string; mode: "preparation" | "checkpoint" | "practice"; collectionId?: string; questionCount?: number; questionIds?: string[]; cardCheckpoint?: QuizRun["cardCheckpoint"]; tutorWeekCheckpoint?: QuizRun["tutorWeekCheckpoint"]; tutorWeekStartedOn?: string; tutorSessionId?: string };

function withQuizFocus(workspace: Workspace, run: QuizRun, updatedAt = new Date().toISOString(), collectionId?: string): Workspace {
  const collection = collectionId ? learningCollections(workspace).find(item => item.id === collectionId && runMatchesLearningCollection(run, item)) : undefined;
  return { ...workspace, learningFocus: { collectionId: run.collectionId ?? collection?.id ?? null, subject: run.subject, updatedAt } };
}

function matchingQuizCollection(workspace: Workspace, run: QuizRun, preferredCollectionId?: string) {
  const collections = learningCollections(workspace);
  const preferred = collections.find(item => item.id === preferredCollectionId && runMatchesLearningCollection(run, item));
  return preferred ?? collections.find(item => runMatchesLearningCollection(run, item));
}

function runsForCollection(workspace: Workspace, collectionId?: string) {
  const collection = learningCollections(workspace).find(item => item.id === collectionId);
  if (!collection) return workspace.quizRuns;
  return workspace.quizRuns.filter(run => runMatchesLearningCollection(run, collection));
}
const dateLabel = (date: string) => new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(date));
function exportReminder(reminder: LearningReminder) {
  const url = URL.createObjectURL(new Blob([reminderCalendar(reminder)], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "lernerinnerung.ics"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LearningReminders({ workspace, save, saving, onOpen }: Props & { onOpen?: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const reminders = workspace.learningReminders.filter(r => !r.completed).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  if (!reminders.length) return null;
  return <section className="quiz-panel reminder-panel" aria-label="Lernerinnerungen"><div className="section-heading"><h2><Bell size={18} /> Lernerinnerungen</h2>{onOpen && <Button variant="ghost" size="sm" onClick={onOpen}>Zu den Tests</Button>}</div><ul className="reminder-list">{reminders.map(reminder => <li key={reminder.id}><div><strong>{reminder.subject}</strong><p>{Date.parse(reminder.dueAt) <= now ? "Jetzt fällig · " : "Geplant · "}{dateLabel(reminder.dueAt)} (Berlin)</p></div><div className="quiz-actions"><Button variant="outline" size="sm" onClick={() => exportReminder(reminder)} aria-label={"Kalenderexport für " + reminder.subject}><Download size={15} />Kalender</Button><Button variant="ghost" size="sm" disabled={saving} onClick={() => void save(w => ({ ...w, learningReminders: w.learningReminders.map(r => r.id === reminder.id ? { ...r, completed: true } : r) }), "Erinnerung erledigt")}><Check size={15} />Erledigt</Button></div></li>)}</ul></section>;
}

function ReminderForm({ subject, workspace, save, saving }: Props & { subject: string }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  return <form className="quiz-panel reminder-form" onSubmit={async event => {
    event.preventDefault(); setError("");
    const due = new Date(value);
    if (!Number.isFinite(due.getTime()) || due.getTime() <= Date.now()) { setError("Bitte einen zukünftigen Termin wählen."); return; }
    if (await save(w => ({ ...w, learningReminders: [...w.learningReminders.filter(r => !r.completed), { id: crypto.randomUUID(), subject, dueAt: due.toISOString(), completed: false }] }), "Lernerinnerung gespeichert")) setValue("");
  }}><h3><Bell size={18} /> Nächste Lernrunde planen</h3><p>Für {subject}. Fällige Termine erscheinen im Überblick. Für eine Benachrichtigung außerhalb der App importiere den Kalendertermin mit Alarm.</p><label className="field"><span>Termin (Zeitzone deines Geräts)</span><Input type="datetime-local" aria-label="Erinnerungstermin" required value={value} onChange={event => setValue(event.target.value)} /></label>{error && <p role="alert">{error}</p>}<Button type="submit" disabled={saving || !value || workspace.learningReminders.filter(r => !r.completed).length >= 100}>Erinnerung speichern</Button></form>;
}

function newQuestion(subject: string): QuizQuestion {
  return { id: crypto.randomUUID(), subject: subject || "Projektmanagement", concept: "", difficulty: 1, prompt: "", options: Array.from({ length: 4 }, (_, i) => ({ id: "option-" + i, text: "", feedback: "" })), correctOptionIds: ["option-0"], explanation: "", source: "" };
}

function QuestionEditor({ question, workspace, save, saving, onClose, collectionId }: Props & { question: QuizQuestion; onClose: () => void; collectionId?: string }) {
  const [draft, setDraft] = useState(question);
  const [error, setError] = useState("");
  const exists = workspace.quizQuestions.some(q => q.id === question.id);
  const collection = !exists && collectionId ? learningCollections(workspace).find(item => item.id === collectionId) : undefined;
  const dirty = JSON.stringify(draft) !== JSON.stringify(question);
  useEffect(() => { const guard = (e: BeforeUnloadEvent) => { if (dirty || saving) e.preventDefault(); }; window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard); }, [dirty, saving]);
  function close() { if (!saving && (!dirty || window.confirm("Nicht gespeicherte Änderungen verwerfen?"))) onClose(); }
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="editor-dialog" onInteractOutside={e => e.preventDefault()}><DialogHeader><DialogTitle>{exists ? "Testaufgabe bearbeiten" : "Neue Testaufgabe"}</DialogTitle><DialogDescription>Markiere alle richtigen Antworten. Fehlerhinweise erklären die jeweilige Verwechslung.</DialogDescription></DialogHeader><form className="editor-form" aria-busy={saving} inert={saving} onSubmit={async event => {
    event.preventDefault();
    const result = quizQuestionSchema.safeParse(draft);
    if (!result.success) { setError(result.error.issues[0]?.message ?? "Bitte die Aufgabe prüfen."); return; }
    if (await save(w => {
      const updated = { ...w, quizQuestions: exists ? w.quizQuestions.map(q => q.id === draft.id ? result.data : q) : [...w.quizQuestions, result.data] };
      return !exists && collectionId ? addToLearningCollection(updated, collectionId, "questionIds", draft.id) : updated;
    }, "Testaufgabe gespeichert")) onClose();
  }}>{collection && <p className="small-note">Die neue Aufgabe gehört zur Lernsammlung „{collection.title}“.</p>}<div className="form-columns"><label className="field"><span>Fachthema</span><Input required maxLength={160} value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })} /></label><label className="field"><span>Lernbereich</span><Input required maxLength={160} value={draft.concept} onChange={e => setDraft({ ...draft, concept: e.target.value })} placeholder="z. B. Nutzen und Bedienbarkeit" /></label></div><label className="field"><span>Schwierigkeit</span><select aria-label="Schwierigkeit" value={draft.difficulty} onChange={e => setDraft({ ...draft, difficulty: Number(e.target.value) })}>{[1, 2, 3].map(level => <option key={level} value={level}>{difficultyLabels[level]}</option>)}</select></label><label className="field"><span>Fragestellung</span><Textarea required maxLength={3000} value={draft.prompt} onChange={e => setDraft({ ...draft, prompt: e.target.value })} /></label><fieldset className="quiz-editor-options"><legend>Antwortmöglichkeiten</legend>{draft.options.map((option, index) => <div key={option.id}><label className="field"><span>Antwort {index + 1}</span><Input required maxLength={1000} value={option.text} onChange={e => setDraft({ ...draft, options: draft.options.map(o => o.id === option.id ? { ...o, text: e.target.value } : o) })} /></label><label className="quiz-correct-toggle"><Checkbox checked={draft.correctOptionIds.includes(option.id)} onCheckedChange={checked => setDraft({ ...draft, correctOptionIds: checked ? [...draft.correctOptionIds, option.id] : draft.correctOptionIds.filter(id => id !== option.id) })} />Richtige Antwort {index + 1}</label><label className="field"><span>Fehlerhinweis / Rückmeldung {index + 1}</span><Textarea maxLength={2000} value={option.feedback} onChange={e => setDraft({ ...draft, options: draft.options.map(o => o.id === option.id ? { ...o, feedback: e.target.value } : o) })} rows={2} /></label><Button type="button" size="sm" variant="ghost" disabled={draft.options.length <= 2} onClick={() => setDraft({ ...draft, options: draft.options.filter(o => o.id !== option.id), correctOptionIds: draft.correctOptionIds.filter(id => id !== option.id) })}>Antwort {index + 1} entfernen</Button></div>)}<Button type="button" variant="outline" disabled={draft.options.length >= 6} onClick={() => setDraft({ ...draft, options: [...draft.options, { id: crypto.randomUUID(), text: "", feedback: "" }] })}>Antwort hinzufügen</Button></fieldset><label className="field"><span>Erklärung und Lerntipp</span><Textarea required maxLength={4000} value={draft.explanation} onChange={e => setDraft({ ...draft, explanation: e.target.value })} /></label><label className="field"><span>Lernnotizen (optional)</span><select multiple size={5} className="quiz-learning-notes-select" aria-label="Verknüpfte Lernnotizen" value={draft.noteIds ?? []} onChange={event => setDraft({ ...draft, noteIds: Array.from(event.target.selectedOptions, option => option.value) })}>{workspace.notes.filter(note => !note.archived || draft.noteIds?.includes(note.id)).map(note => <option key={note.id} value={note.id}>{note.title}</option>)}</select></label><p className="small-note">Verknüpfe bis zu vier passende Notizen. Vorhandene Abbildungen erscheinen bei der Antworterklärung.</p><label className="field"><span>Quelle (optional)</span><Input type="url" maxLength={1000} value={draft.source} onChange={e => setDraft({ ...draft, source: e.target.value })} /></label>{error && <p role="alert">{error}</p>}<div className="dialog-actions"><Button type="button" variant="outline" onClick={close}>Abbrechen</Button><Button type="submit">Aufgabe speichern</Button></div></form></DialogContent></Dialog>;
}

type QuizAnswer = QuizRun["answers"][number];
const optionTags = { hit: "Deine Wahl · richtig", missed: "Richtige Antwort · nicht gewählt", wrong: "Deine Wahl · falsch" } as const;

function OptionReview({ question, selected }: { question: QuizQuestion; selected: string[] }) {
  return <ul className="quiz-option-review" aria-label="Antwortmöglichkeiten mit Lösung">{question.options.map(option => {
    const chosen = selected.includes(option.id), right = question.correctOptionIds.includes(option.id);
    const state = right ? (chosen ? "hit" : "missed") : chosen ? "wrong" : "neutral";
    return <li key={option.id} className={"quiz-option is-" + state}><span className="quiz-mark" aria-hidden="true">{right ? <Check size={14} strokeWidth={3} /> : chosen ? <X size={14} strokeWidth={3} /> : null}</span><div><span>{option.text}</span>{state !== "neutral" && <small className="quiz-tag">{optionTags[state]}</small>}{state === "wrong" && <p className="quiz-option-feedback">{option.feedback || "Diese Antwort passt nicht zur Fragestellung. Vergleiche sie mit der Erklärung."}</p>}</div></li>;
  })}</ul>;
}

function Feedback({ question, answer, run, workspace, save, saving, actions, onOpenNote }: Props & { question: QuizQuestion; answer?: QuizAnswer; run: QuizRun; actions?: ReactNode }) {
  const [reflection, setReflection] = useState(answer?.reflection ?? "");
  const selected = answer?.selectedOptionIds ?? [];
  const correct = isCorrect(question, selected);
  const hits = question.correctOptionIds.filter(id => selected.includes(id)).length;
  if (run.mode === "exam" && !run.finishedAt) return null;
  return <section className={"quiz-feedback " + (correct ? "correct" : "incorrect")} aria-label="Auswertung"><h3 className="quiz-verdict">{correct ? <Check size={18} /> : <X size={18} />}{correct ? "Richtig beantwortet" : answer ? "Nicht ganz richtig" : "Nicht beantwortet"}</h3>{answer && !correct && <p className="quiz-verdict-note">{hits} von {question.correctOptionIds.length} richtigen Antworten gewählt{selected.length > hits ? ` · ${selected.length - hits} falsch gewählt` : ""}. Ohne Teilpunkte zählt die Aufgabe als falsch.</p>}<OptionReview question={question} selected={selected} />{actions}<div className="quiz-explanation"><p>{question.explanation}</p>{question.source && <a href={question.source} target="_blank" rel="noopener noreferrer">Fachliche Quelle öffnen</a>}</div><QuizLearningMaterial question={question} notes={workspace.notes} onOpenNote={onOpenNote} />{answer && !correct && <div className="quiz-reflection"><label className="field"><span>Mein Denkfehler / Merksatz</span><Textarea value={reflection} maxLength={1500} rows={2} onChange={e => setReflection(e.target.value)} placeholder="Was habe ich verwechselt? Woran erkenne ich es beim nächsten Mal?" /></label><Button variant="outline" size="sm" disabled={saving || reflection === answer.reflection} onClick={() => void save(w => ({ ...w, quizRuns: w.quizRuns.map(r => r.id === run.id ? { ...r, answers: r.answers.map(a => a.questionId === question.id ? { ...a, reflection } : a) } : r) }), "Denkfehler gespeichert")}>Merksatz speichern</Button></div>}</section>;
}

function QuizSession({ run, workspace, save, saving, onOpenNote, onBackToOverview, collectionId, onPendingChange }: Props & { run: QuizRun; onBackToOverview?: () => void; collectionId?: string; onPendingChange?: (pending: boolean) => void }) {
  const collectionName = learningCollections(workspace).find(collection => collection.id === (run.collectionId ?? collectionId) && runMatchesLearningCollection(run, collection))?.title;
  const initialIndex = Math.max(0, run.questions.findIndex(q => !run.answers.some(a => a.questionId === q.id)));
  const [index, setIndex] = useState(initialIndex);
  const [selected, setSelected] = useState<string[]>(() => run.answers.find(a => a.questionId === run.questions[initialIndex].id)?.selectedOptionIds ?? []);
  const [reviewId, setReviewId] = useState<string | null>(() => run.mode === "practice" ? run.answers.at(-1)?.questionId ?? null : null);
  // Keep every unconfirmed answer while revision-bound writes run in order.
  const [pendingAnswers, setPendingAnswers] = useState<QuizAnswer[]>([]);
  const pendingAnswersRef = useRef<QuizAnswer[]>([]);
  const answerWrites = useRef(new Set<Promise<boolean>>());
  const [saveFailed, setSaveFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  const autoAttempt = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const focusHeading = useRef(false);
  const question = run.questions[index];
  const expired = !!run.deadlineAt && Date.parse(run.deadlineAt) <= now;
  const answered = run.answers.find(a => a.questionId === question.id);
  const review = run.mode === "practice" ? run.questions.find(q => q.id === reviewId) : undefined;
  const reviewAnswer = review && (pendingAnswers.find(answer => answer.questionId === review.id) ?? run.answers.find(a => a.questionId === review.id));
  const answeredCount = run.answers.length + pendingAnswers.filter(answer => !run.answers.some(a => a.questionId === answer.questionId)).length;
  const backgroundSaving = run.mode === "practice" && pendingAnswers.length > 0 && !saveFailed;
  const interactionBlocked = finishing || saveFailed || (saving && !backgroundSaving);
  const reviewKey = review?.id;
  const hasPending = pendingAnswers.length > 0;
  useEffect(() => { onPendingChange?.(hasPending); return () => onPendingChange?.(false); }, [hasPending, onPendingChange]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (pendingAnswersRef.current.length) event.preventDefault(); };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (reviewKey) nextButton.current?.focus({ preventScroll: true }); }, [reviewKey]);
  useEffect(() => { if (focusHeading.current && !reviewKey) { focusHeading.current = false; heading.current?.focus(); } });
  async function finish() {
    if (finishingRef.current || saveFailed) return false;
    finishingRef.current = true; setFinishing(true);
    try {
      await Promise.all([...answerWrites.current]);
      if (pendingAnswersRef.current.length) return false;
      return await save(w => {
        const finishedAt = new Date().toISOString();
        return { ...withQuizFocus(w, run, finishedAt, collectionId), quizRuns: w.quizRuns.map(r => r.id === run.id && !r.finishedAt ? { ...r, finishedAt } : r) };
      }, "Test beendet und Auswertung gespeichert", { queue: true });
    } finally { finishingRef.current = false; setFinishing(false); }
  }
  useEffect(() => {
    if (!expired || saving || run.finishedAt || now - autoAttempt.current < 30000) return;
    autoAttempt.current = now;
    void save(w => {
      const finishedAt = new Date().toISOString();
      return { ...withQuizFocus(w, run, finishedAt, collectionId), quizRuns: w.quizRuns.map(r => r.id === run.id && !r.finishedAt ? { ...r, finishedAt } : r) };
    }, "Zeit abgelaufen. Auswertung gespeichert.");
  }, [expired, now, saving, run, save, collectionId]);
  function move(next: number) { focusHeading.current = true; setIndex(next); setSelected((pendingAnswersRef.current.find(a => a.questionId === run.questions[next].id) ?? run.answers.find(a => a.questionId === run.questions[next].id))?.selectedOptionIds ?? []); }
  function next() {
    if (interactionBlocked) return;
    const open = run.questions.findIndex(q => !run.answers.some(a => a.questionId === q.id) && !pendingAnswersRef.current.some(a => a.questionId === q.id));
    if (open < 0) void finish(); else { move(open); setReviewId(null); }
  }
  function toggle(id: string, checked: boolean) { setSelected(current => checked ? [...current.filter(x => x !== id), id] : current.filter(x => x !== id)); }
  function finishEarly() {
    void finish();
  }
  function persistAnswer(answer: QuizAnswer) {
    const write = save(w => {
      if (!w.quizRuns.some(item => item.id === run.id)) throw new Error("Diese Lernrunde ist nicht mehr verfügbar. Deine offenen Antworten bleiben hier erhalten.");
      return { ...withQuizFocus(w, run, answer.answeredAt, collectionId), quizRuns: w.quizRuns.map(r => {
        if (r.id !== run.id) return r;
        if (r.finishedAt || (r.deadlineAt && Date.parse(r.deadlineAt) <= Date.now())) throw new Error("Die Testrunde ist bereits beendet.");
        const existing = r.answers.find(item => item.questionId === answer.questionId);
        if (run.mode === "practice" && existing && existing.answeredAt !== answer.answeredAt) throw new Error("Diese Aufgabe wurde inzwischen in einem anderen Fenster beantwortet. Deine offene Antwort bleibt hier erhalten.");
        return { ...r, answers: [...r.answers.filter(a => a.questionId !== answer.questionId), answer] };
      }) };
    }, "", { queue: true }).then(ok => {
      if (ok) {
        pendingAnswersRef.current = pendingAnswersRef.current.filter(item => item !== answer);
        setPendingAnswers(pendingAnswersRef.current);
      } else if (run.mode === "practice") setSaveFailed(true);
      return ok;
    });
    answerWrites.current.add(write);
    void write.finally(() => answerWrites.current.delete(write));
    return write;
  }
  async function retryAnswers() {
    if (retrying || saving) return;
    setRetrying(true);
    try {
      for (const answer of [...pendingAnswersRef.current]) if (!await persistAnswer(answer)) return;
      setSaveFailed(false);
    } finally { setRetrying(false); }
  }
  function discardPendingAnswers() {
    if (saving || retrying || !window.confirm("Die noch nicht gespeicherten Antworten dieser Runde verwerfen und den zuletzt gespeicherten Stand übernehmen?")) return;
    pendingAnswersRef.current = []; setPendingAnswers([]); setSaveFailed(false);
  }
  async function submit() {
    if (expired || !selected.length || interactionBlocked || review) return;
    const answer = { questionId: question.id, selectedOptionIds: selected, answeredAt: new Date().toISOString(), reflection: answered?.reflection ?? "" };
    if (run.mode === "practice") {
      if (pendingAnswersRef.current.some(item => item.questionId === answer.questionId)) return;
      pendingAnswersRef.current = [...pendingAnswersRef.current, answer];
      setPendingAnswers(pendingAnswersRef.current); setReviewId(question.id);
      void persistAnswer(answer);
    } else if (await persistAnswer(answer) && index < run.questions.length - 1) move(index + 1);
  }
  // Keyboard: digits toggle answers, Enter confirms or moves on. Typing in fields and open dialogs stay untouched.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing || interactionBlocked || expired) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      const onButton = !!target?.closest("button:not([role='checkbox']), a");
      if (review) { if (event.key === "Enter" && !onButton) { event.preventDefault(); next(); } return; }
      const option = /^[1-9]$/.test(event.key) ? question.options[Number(event.key) - 1] : undefined;
      if (option) { event.preventDefault(); toggle(option.id, !selected.includes(option.id)); }
      else if (event.key === "Enter" && !onButton) { event.preventDefault(); void submit(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const reviewNumber = review ? run.questions.findIndex(q => q.id === review.id) + 1 : 0;
  const mobileEnd = <Button className="quiz-mobile-end" type="button" variant="outline" disabled={interactionBlocked} onClick={finishEarly} aria-label={run.mode === "exam" ? "Test abgeben" : "Runde vorzeitig beenden"}>{run.mode === "exam" ? "Test abgeben" : "Beenden"}</Button>;
  return <section className="quiz-session">
    <div className="quiz-session-top"><strong>{run.tutorSessionId ? "Tutor-Kurztest" : run.preparationConcept ? "Vorbereitung" : run.mode === "exam" ? "Prüfungssimulation" : "Adaptiv üben"} · {run.subject}</strong><span>{answeredCount} von {run.questions.length} beantwortet{run.deadlineAt && " · " + (expired ? "Zeit abgelaufen" : Math.ceil((Date.parse(run.deadlineAt) - now) / 60000) + " Min. übrig")}</span></div>
    {collectionName && <p className="small-note quiz-session-collection">Sammlung: {collectionName}</p>}
    <Progress value={answeredCount / run.questions.length * 100} aria-label="Testfortschritt" />
    {pendingAnswers.length > 0 && <div className="quiz-save-notice" role={saveFailed ? "alert" : "status"}>{saveFailed ? <><p>Deine Antworten konnten noch nicht gespeichert werden. Sie bleiben hier erhalten. Prüfe den Speicherhinweis und versuche es erneut.</p><div className="quiz-actions"><Button variant="outline" disabled={saving || retrying} onClick={() => void retryAnswers()}>{retrying ? "Antworten werden gespeichert …" : "Antworten erneut speichern"}</Button><Button variant="ghost" disabled={saving || retrying} onClick={discardPendingAnswers}>Offene Antworten verwerfen</Button></div></> : <p>{finishing ? "Deine letzten Antworten werden gespeichert. Danach erscheint die Auswertung." : "Antworten werden gespeichert. Du kannst direkt weiterüben."}</p>}</div>}
    {run.mode === "exam" && <nav className="quiz-question-nav" aria-label="Aufgaben im Test">{run.questions.map((q, i) => <Button key={q.id} variant={i === index ? "default" : "outline"} size="sm" onClick={() => move(i)} disabled={saving || expired} aria-label={"Aufgabe " + (i + 1) + (run.answers.some(a => a.questionId === q.id) ? ", beantwortet" : "")}>{i + 1}{run.answers.some(a => a.questionId === q.id) ? " ✓" : ""}</Button>)}</nav>}
    {review ? <article className="quiz-panel quiz-question">
      <div className="eyebrow">{review.concept} · {difficultyLabels[review.difficulty]}</div><h2 tabIndex={-1}>Aufgabe {reviewNumber}: {review.prompt}</h2>
      <Feedback key={review.id} question={review} answer={reviewAnswer} run={run} workspace={workspace} save={save} saving={saving || pendingAnswers.length > 0} onOpenNote={onOpenNote} actions={<div className="quiz-actions quiz-session-controls" role="group" aria-label="Aktionen für die Testaufgabe"><Button ref={nextButton} disabled={interactionBlocked} onClick={next}>{finishing ? "Runde wird abgeschlossen …" : answeredCount === run.questions.length ? "Runde abschließen" : "Nächste Aufgabe"}<ArrowRight size={16} /></Button>{mobileEnd}<small className="quiz-keys">Enter: weiter</small></div>} />
    </article> : <form className="quiz-panel quiz-question" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <div className="eyebrow">{question.concept} · {difficultyLabels[question.difficulty]}</div><h2 ref={heading} tabIndex={-1}>Aufgabe {index + 1}: {question.prompt}</h2><p>Wähle alle passenden Antworten. Die Auswahl muss vollständig stimmen; es gibt keine Teilpunkte.</p>
      <fieldset disabled={interactionBlocked || expired}><legend className="sr-only">Antwortmöglichkeiten</legend>{question.options.map((option, i) => <label className="quiz-option" key={option.id}><Checkbox checked={selected.includes(option.id)} onCheckedChange={checked => toggle(option.id, checked === true)} /><span>{option.text}</span>{i < 9 && <kbd className="quiz-key" aria-hidden="true">{i + 1}</kbd>}</label>)}</fieldset>
      <div className="quiz-actions quiz-session-controls" role="group" aria-label="Aktionen für die Testaufgabe"><Button type="submit" disabled={interactionBlocked || expired || !selected.length}>{run.mode === "practice" ? "Bestätigen" : "Antwort speichern"}</Button>{mobileEnd}{answered && run.mode === "exam" && <span>Gespeicherte Auswahl: {question.options.filter(o => answered.selectedOptionIds.includes(o.id)).map(o => o.text).join(" · ")}</span>}<small className="quiz-keys">Tasten 1–{Math.min(question.options.length, 9)} wählen · Enter {run.mode === "practice" ? "bestätigt" : "speichert"}</small></div>
    </form>}
    <div className="quiz-session-end"><p>{run.mode === "exam" ? "Lösungen und Fehlerhinweise erscheinen nach der Abgabe. Unbeantwortete Aufgaben zählen als falsch." : pendingAnswers.length ? "Deine Antworten werden noch gespeichert. Lass die App dafür geöffnet." : "Deine bestätigten Antworten sind gespeichert. Du kannst die Runde später fortsetzen oder jetzt auswerten."}{onBackToOverview && run.deadlineAt && " Bei einer Pause läuft das Zeitlimit weiter."}</p>{onBackToOverview && <div className="quiz-actions"><Button variant="outline" disabled={saving || pendingAnswers.length > 0 || finishing} onClick={onBackToOverview}>Zum Lernüberblick</Button></div>}<Button variant="outline" disabled={interactionBlocked} onClick={finishEarly}>{run.mode === "exam" ? "Test abgeben" : "Runde vorzeitig beenden"}</Button></div>
  </section>;
}

export function Quizzes({ workspace, save, saving, onStudyChange, onOpenNote, collectionId = "", onCollectionChange, launchRequest, onLaunchConsumed, resultRequest, onResultRequestConsumed, onBackToOverview, onPendingChange, onLearningAction }: Props & { onStudyChange?: (studying: boolean) => void; collectionId?: string; onCollectionChange?: (id: string) => void; launchRequest?: QuizLaunchRequest; onLaunchConsumed?: () => void; resultRequest?: { id: string; runId: string; collectionId?: string }; onResultRequestConsumed?: () => void; onBackToOverview?: () => void; onPendingChange?: (pending: boolean) => void }) {
  const requestedResult = resultRequest ? workspace.quizRuns.find(run => run.id === resultRequest.runId && run.finishedAt) : undefined;
  const requestedResultCollectionId = requestedResult ? matchingQuizCollection(workspace, requestedResult, resultRequest?.collectionId ?? collectionId)?.id ?? "" : "";
  const [subjectChoice, setSubject] = useState(() => requestedResult?.subject ?? launchRequest?.subject ?? workspace.learningFocus?.subject ?? workspace.quizQuestions[0]?.subject ?? "Projektmanagement");
  const collections = learningCollections(workspace);
  const collection = collections.find(item => item.id === collectionId);
  const contents = collection ? collectionItems(workspace, collection) : null;
  const scopedQuestions = contents?.questions ?? workspace.quizQuestions;
  const subject = scopedQuestions.some(question => question.subject === subjectChoice) ? subjectChoice : scopedQuestions[0]?.subject ?? subjectChoice;
  const scopedRuns = runsForCollection(workspace, collection?.id);
  const preparationWorkspace = contents ? { ...workspace, quizQuestions: scopedQuestions, notes: contents.notes, quizRuns: scopedRuns } : workspace;
  const [mode, setMode] = useState<QuizRun["mode"]>("practice");
  const [count, setCount] = useState(6);
  const [minutes, setMinutes] = useState(10);
  const [editing, setEditing] = useState<QuizQuestion | null>(null);
  const [resultId, setResultId] = useState<string | null>(() => requestedResult?.id ?? null);
  const [selectedResultRequest, setSelectedResultRequest] = useState<string | null>(resultRequest?.id ?? null);
  const [journal, setJournal] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const continuingRequest = useRef(false);
  const [launchError, setLaunchError] = useState<{ id: string; message: string } | null>(null);
  const [heldRun, setHeldRun] = useState<QuizRun | null>(null);
  const attemptedRequest = useRef<string | null>(null);
  const launchingRequest = useRef(false);
  const consumedResultRequest = useRef<string | null>(null);
  const active = heldRun
    ? workspace.quizRuns.find(run => run.id === heldRun.id && !run.finishedAt) ?? heldRun
    : workspace.quizRuns.find(r => !r.finishedAt);
  const onSessionPendingChange = useCallback((pending: boolean) => {
    setHeldRun(pending ? active ?? null : null);
    onPendingChange?.(pending);
  }, [active, onPendingChange]);
  const studying = !!active;
  useEffect(() => { onStudyChange?.(studying); return () => onStudyChange?.(false); }, [studying, onStudyChange]);
  const result = workspace.quizRuns.find(r => r.id === resultId && r.finishedAt);
  const previousActive = useRef(active?.id);
  useEffect(() => { if (previousActive.current && !active) setResultId(previousActive.current); previousActive.current = active?.id; }, [active]);
  // Synchronize a new result request during rendering; the effect below only
  // acknowledges it and updates the parent's collection selection.
  if (resultRequest && selectedResultRequest !== resultRequest.id) {
    setSelectedResultRequest(resultRequest.id);
    if (requestedResult) { setResultId(requestedResult.id); setSubject(requestedResult.subject); }
  }
  useEffect(() => {
    if (!resultRequest || consumedResultRequest.current === resultRequest.id) return;
    consumedResultRequest.current = resultRequest.id;
    if (requestedResult) onCollectionChange?.(requestedResultCollectionId);
    onResultRequestConsumed?.();
  }, [resultRequest, requestedResult, requestedResultCollectionId, onCollectionChange, onResultRequestConsumed]);
  const subjects = [...new Set([...scopedQuestions.map(question => question.subject), ...(collection ? [] : ["Projektmanagement", "Produktmanagement"])])];
  if (!subjects.length) subjects.push(subject);
  const pool = scopedQuestions.filter(question => question.subject === subject);
  const scopedQuestionIds = new Set(scopedQuestions.map(question => question.id));
  const profile = learningProfile(pool, workspace.quizRuns);
  const mistakes = scopedRuns.flatMap(run => run.mode === "exam" && !run.finishedAt ? [] : run.answers.flatMap(answer => {
    const question = run.questions.find(q => q.id === answer.questionId);
    return question && question.subject === subject && scopedQuestionIds.has(question.id) && !isCorrect(question, answer.selectedOptionIds) ? [{ run, question: restoreQuestion(question, workspace.quizQuestions), answer }] : [];
  })).sort((a, b) => b.answer.answeredAt.localeCompare(a.answer.answeredAt));
  async function persistRun(run: QuizRun, message: string) {
    return save(current => {
      if (current.quizRuns.some(item => !item.finishedAt)) throw new Error("Bitte die laufende Testrunde zuerst beenden.");
      if (current.quizRuns.length >= 200) throw new Error("Die Grenze von 200 gespeicherten Runden ist erreicht.");
      let updated = current;
      if (run.tutorSessionId) updated = validateTutorSessionQuiz(current, run);
      if (run.tutorWeekStartedOn && (current.tutorWeek?.startedOn !== run.tutorWeekStartedOn || current.tutorWeek.subject !== run.subject || current.tutorWeek.collectionId !== (run.collectionId ?? null))) throw new Error("Die Lernwoche wurde inzwischen geändert. Öffne den aktuellen Tutor.");
      if (run.tutorWeekCheckpoint) {
        const week = current.tutorWeek;
        if (!week || week.startedOn !== run.tutorWeekCheckpoint.startedOn || week.subject !== run.subject || week.collectionId !== (run.collectionId ?? null)) throw new Error("Die Lernwoche wurde inzwischen geändert. Öffne den aktuellen Tutor.");
        if (run.tutorWeekCheckpoint.stage !== "midpoint" && JSON.stringify(week.checkpointQuestionIds) !== JSON.stringify(run.questions.map(question => question.id))) throw new Error("Die Aufgaben für den Wochentest wurden inzwischen geändert.");
        const collection = week.collectionId ? learningCollections(current).find(item => item.id === week.collectionId) : null;
        if (week.collectionId && !collection) throw new Error("Die Lernsammlung ist nicht mehr verfügbar.");
        const bank = collection ? collectionItems(current, collection).questions : current.quizQuestions;
        if (run.questions.some(question => !bank.some(item => item.subject === run.subject && JSON.stringify(withLearningNotes(item)) === JSON.stringify(question)))) throw new Error("Die Testaufgaben haben sich geändert. Starte den Test im Tutor erneut.");
      }
      if (run.cardCheckpoint) {
        const fresh = tutorCardCheckpoint(current, run.cardCheckpoint.sessionId);
        if (!fresh || fresh.reviewedAt !== run.cardCheckpoint.reviewedAt || fresh.action.subject !== run.subject || fresh.action.collectionId !== (run.collectionId ?? null) || JSON.stringify(fresh.action.questionIds) !== JSON.stringify(run.questions.map(question => question.id))) {
          throw new Error("Der Lernimpuls hat sich geändert. Öffne deinen aktuellen Lernstand und wähle ihn erneut.");
        }
        const currentQuestions = new Map(current.quizQuestions.map(question => [question.id, withLearningNotes(question)]));
        if (run.questions.some(question => JSON.stringify(currentQuestions.get(question.id)) !== JSON.stringify(question))) throw new Error("Die Testaufgaben haben sich geändert. Bitte starte den Lernimpuls erneut.");
        updated = recordTutorCheckpoint(current, run.cardCheckpoint, "started");
      }
      return { ...withQuizFocus(updated, run, run.startedAt), quizRuns: [...updated.quizRuns, run] };
    }, message);
  }
  async function attemptLaunch(request: QuizLaunchRequest) {
    if (launchingRequest.current) return;
    attemptedRequest.current = request.id;
    launchingRequest.current = true;
    setLaunching(true);
    setLaunchError(null);
    setSubject(request.subject);
    try {
      if (active) throw new Error("Du hast noch eine laufende Runde. Setze sie fort oder beende sie, bevor du eine neue Einheit startest.");
      const requestedCollectionId = request.collectionId ?? collectionId;
      const requestedCollection = collections.find(item => item.id === requestedCollectionId);
      if (requestedCollectionId && !requestedCollection) throw new Error("Die gewählte Lernsammlung ist nicht mehr verfügbar. Wähle im Lernüberblick eine andere Sammlung.");
      const questionsInScope = requestedCollection ? collectionItems(workspace, requestedCollection).questions : workspace.quizQuestions;
      const requestedIds = request.questionIds;
      if (requestedIds && (!(request.cardCheckpoint || request.tutorWeekCheckpoint || request.tutorSessionId) || request.mode !== "checkpoint" || !requestedIds.length || requestedIds.length > (request.cardCheckpoint || request.tutorSessionId ? 3 : 6) || new Set(requestedIds).size !== requestedIds.length || requestedIds.some(id => !questionsInScope.some(question => question.id === id && question.subject === request.subject)))) throw new Error("Die Aufgaben für diesen Lernimpuls sind nicht mehr verfügbar.");
      const questions = request.mode === "preparation"
        ? request.concept ? selectPreparationQuestions(questionsInScope, runsForCollection(workspace, requestedCollection?.id), request.subject, request.concept) : []
        : request.mode === "checkpoint"
          ? (requestedIds ? requestedIds.map(id => questionsInScope.find(question => question.id === id)!) : selectCheckpointQuestions(questionsInScope, workspace.quizRuns, request.subject, request.questionCount)).map(question => withLearningNotes(question, request.tutorSessionId ? workspace.notes : undefined))
          : selectQuestions(questionsInScope, workspace.quizRuns, request.subject, "practice", 6).map(question => withLearningNotes(question));
      if (!questions.length) throw new Error("Für diese Einheit sind keine passenden Testaufgaben verfügbar. Wähle im Lernüberblick einen anderen Lernschritt.");
      const run: QuizRun = {
        id: crypto.randomUUID(), subject: request.subject, mode: request.mode === "checkpoint" ? "exam" : "practice",
        ...(request.mode === "preparation" ? { preparationConcept: request.concept } : {}),
        ...(requestedCollection ? { collectionId: requestedCollection.id } : {}),
        ...(request.cardCheckpoint ? { cardCheckpoint: request.cardCheckpoint } : {}),
        ...(request.tutorWeekStartedOn ? { tutorWeekStartedOn: request.tutorWeekStartedOn } : {}),
        ...(request.tutorWeekCheckpoint ? { tutorWeekCheckpoint: request.tutorWeekCheckpoint } : {}),
        ...(request.tutorSessionId ? { tutorSessionId: request.tutorSessionId } : {}),
        startedAt: new Date().toISOString(), deadlineAt: null, finishedAt: null, questions, answers: [],
      };
      if (await persistRun(run, request.mode === "checkpoint" ? "Abschlusstest gestartet" : "Lerneinheit gestartet")) {
        setResultId(null);
        onLaunchConsumed?.();
      } else setLaunchError({ id: request.id, message: "Die Einheit konnte nicht gespeichert werden. Prüfe den Speicherhinweis und versuche den Start erneut." });
    } catch (error) {
      setLaunchError({ id: request.id, message: error instanceof Error ? error.message : "Die Einheit konnte nicht gestartet werden." });
    } finally {
      launchingRequest.current = false;
      setLaunching(false);
    }
  }
  useEffect(() => {
    if (!launchRequest || saving || launchingRequest.current || attemptedRequest.current === launchRequest.id) return;
    void attemptLaunch(launchRequest);
  });
  const launchNotice = launchRequest && (launching || launchError?.id === launchRequest.id) ? <section className="quiz-panel" aria-label="Lerneinheit starten">{launching ? <p role="status">Deine Lerneinheit wird gestartet …</p> : <><p role="alert">{launchError?.message}</p><div className="quiz-actions"><Button disabled={saving || !!active} onClick={() => void attemptLaunch(launchRequest)}>Start erneut versuchen</Button>{onBackToOverview && <Button variant="outline" disabled={saving} onClick={onBackToOverview}>Zum Lernüberblick</Button>}</div></>}</section> : null;
  if (active) return <>{launchNotice}<QuizSession key={active.id} run={active} workspace={workspace} save={save} saving={saving} onOpenNote={onOpenNote} onBackToOverview={onBackToOverview} collectionId={collectionId} onPendingChange={onSessionPendingChange} /></>;
  async function startPreparation(concept: string, allQuestions = false, startSubject = subject, startCollectionId = collection?.id) {
    const startCollection = collections.find(item => item.id === startCollectionId);
    if (startCollectionId && !startCollection) return false;
    const questionsInScope = startCollection ? collectionItems(workspace, startCollection).questions : workspace.quizQuestions;
    const questions = selectPreparationQuestions(questionsInScope, runsForCollection(workspace, startCollection?.id), startSubject, concept, allQuestions);
    if (!questions.length) return false;
    const run: QuizRun = { id: crypto.randomUUID(), subject: startSubject, mode: "practice", preparationConcept: concept, ...(startCollection ? { collectionId: startCollection.id } : {}), startedAt: new Date().toISOString(), deadlineAt: null, finishedAt: null, questions, answers: [] };
    const saved = await persistRun(run, "Vorbereitungseinheit gestartet");
    if (saved) { setSubject(startSubject); setResultId(null); onCollectionChange?.(startCollectionId ?? ""); }
    return saved;
  }
  if (result) {
    const shown = result.questions.map(question => restoreQuestion(question, workspace.quizQuestions));
    const resultCollection = resultRequest?.runId === result.id
      ? matchingQuizCollection(workspace, result, resultRequest.collectionId ?? collectionId)
      : collections.find(item => item.id === (result.collectionId ?? collectionId) && runMatchesLearningCollection(result, item));
    const continuation = recommendLearningAfterRun(workspace, result, resultCollection?.id);
    const guidedResult = result.tutorSessionId ? tutorSessionInsights(workspace, recommendLearning(workspace)) : null;
    const cardSession = workspace.flashcardSession;
    const resumeCards: LearningAction | null = onLearningAction && cardSession && result.cardCheckpoint?.sessionId === cardSession.id && cardSession.index < cardSession.queue.length
      ? { kind: "resume-cards", collectionId: cardSession.collectionId, sessionId: cardSession.id, remaining: cardSession.queue.length - cardSession.index } : null;
    const continueLabel = continuation?.reason === "repair" ? "Unsicheren Bereich festigen"
      : continuation?.reason === "coverage" ? "Nächsten Lernbereich starten"
      : continuation?.reason === "application" ? continuation.questions.some(question => question.difficulty > 1) ? "Anwendung weiter üben" : "Wissen weiter festigen" : "Wissen im Kurztest prüfen";
    async function continueLearning() {
      if (!continuation?.action || !continuation.questions.length || continuingRequest.current) return;
      continuingRequest.current = true;
      setContinuing(true);
      try {
        const run: QuizRun = {
          id: crypto.randomUUID(), subject: continuation.subject,
          mode: continuation.action.kind === "checkpoint" ? "exam" : "practice",
          ...(continuation.concept ? { preparationConcept: continuation.concept } : {}),
          ...(continuation.collectionId ? { collectionId: continuation.collectionId } : {}),
          startedAt: new Date().toISOString(), deadlineAt: null, finishedAt: null,
          questions: continuation.questions.map(question => withLearningNotes(question)), answers: [],
        };
        if (await persistRun(run, "Nächster Lernschritt gestartet")) {
          setSubject(run.subject); setResultId(null); onCollectionChange?.(continuation.collectionId ?? "");
        }
      } finally { continuingRequest.current = false; setContinuing(false); }
    }
    function openTestOverview() { setSubject(result!.subject); onCollectionChange?.(resultCollection?.id ?? ""); setResultId(null); }
    return <div className="quizzes">
      {launchNotice}
      <QuizResultSummary key={result.id} run={result} questions={shown} nextStep={result.tutorSessionId ? <>
        <h3>Deine Lernrunde ist abgeschlossen</h3>
        <p>{guidedResult?.session?.id === result.tutorSessionId ? guidedResult.description : "Kartenbewertungen und Testergebnis sind gespeichert. Der Tutor bereitet daraus deinen nächsten Schritt vor."}</p>
        {onBackToOverview && <Button disabled={saving} onClick={onBackToOverview}>Rückmeldung im Tutor ansehen<ArrowRight size={16} /></Button>}
      </> : resumeCards ? <>
        <h3>Weiter mit deinen Karten</h3><p>Dein Kurztest ist ausgewertet. Deine Kartenrunde wartet an der gespeicherten Stelle auf dich.</p>
        <Button disabled={saving || continuing} onClick={() => onLearningAction?.(resumeCards)}>Mit deinen Karten weiterlernen<ArrowRight size={16} /></Button>
      </> : continuation && <>
        <h3>{continuation.reason === "repair" ? "Dein nächster Lernschritt" : "Wissen weiter festigen"}</h3>
        <p>{continuation.description}</p>
        {continuation.progress.total > 0 && <p className="quiz-result-path-progress">{continuation.title}: {continuation.progress.covered} von {continuation.progress.total} Lernbereichen bearbeitet · {continuation.progress.secure} in allen vorhandenen Aufgaben richtig beantwortet.</p>}
        {continuation.action && <Button disabled={saving || launching || continuing || workspace.quizRuns.length >= 200} onClick={() => void continueLearning()}>{continuing ? "Lernschritt wird gestartet …" : continueLabel}<ArrowRight size={16} /></Button>}
        {workspace.quizRuns.length >= 200 && <p>Die Grenze von 200 gespeicherten Runden ist erreicht.</p>}
      </>} />
      {!result.tutorSessionId && <div className="quiz-actions quiz-result-navigation">{onBackToOverview && <Button variant="ghost" onClick={onBackToOverview} disabled={saving || continuing}>Zum Lernüberblick</Button>}<Button variant="ghost" onClick={openTestOverview} disabled={saving || continuing}>Zur Testübersicht</Button></div>}
      {shown.map((question, index) => <article key={question.id} className="quiz-panel"><h3>Aufgabe {index + 1}: {question.prompt}</h3><Feedback question={question} answer={result.answers.find(answer => answer.questionId === question.id)} run={result} workspace={workspace} save={save} saving={saving} onOpenNote={onOpenNote} /></article>)}
      {!result.tutorSessionId && <ReminderForm subject={result.subject} workspace={workspace} save={save} saving={saving} />}
    </div>;
  }

  return <div className="quizzes">{launchNotice}<div className="quiz-actions"><Button onClick={() => setEditing(newQuestion(subject))} disabled={saving}><Plus size={16} />Neue Testaufgabe</Button><Button variant="outline" disabled={saving || quizExamples.every(q => workspace.quizQuestions.some(existing => existing.id === q.id))} onClick={() => void save(w => ({ ...w, quizQuestions: [...w.quizQuestions, ...quizExamples.filter(q => !w.quizQuestions.some(existing => existing.id === q.id))] }), "Beispielaufgaben hinzugefügt")}><ClipboardCheck size={16} />Beispiele hinzufügen</Button></div><p className="small-note">12 Beispielaufgaben in drei Stufen: Projektmanagement am Scrum-Beispiel und Produktmanagement mit Discovery-Risiken. Eigene Aufgaben kannst du für jedes Fachthema anlegen.</p><section className="quiz-panel quiz-collection-scope"><label className="field"><span>Lernsammlung für den Test</span><select aria-label="Lernsammlung für Tests" value={collection?.id ?? ""} onChange={event => { onCollectionChange?.(event.target.value); setJournal(false); }}><option value="">Alle Testaufgaben ({workspace.quizQuestions.length})</option>{collections.map(item => <option key={item.id} value={item.id}>{item.title} ({collectionItems(workspace, item).questions.length} Aufgaben)</option>)}</select></label><p className="small-note">{collection && contents ? `${collection.title}: insgesamt ${contents.questions.length} Testaufgaben, ${contents.notes.length} Notizen und ${contents.cards.length} Lernkarten. Die folgende Vorbereitung und neue Testrunden verwenden diese Auswahl.` : `Gesamter Bestand: ${workspace.quizQuestions.length} Testaufgaben. Wähle eine Lernsammlung, um zusammengehörende Inhalte zu üben.`}</p></section><QuizPreparation subject={subject} areas={preparationAreas(preparationWorkspace, subject)} workspace={workspace} saving={saving || launching || workspace.quizRuns.length >= 200} onStart={(concept, allQuestions) => void startPreparation(concept, allQuestions)} onOpenNote={onOpenNote} /><section className="quiz-panel"><div className="quiz-config"><label className="field"><span>Fachthema für den Test</span><select aria-label="Fachthema für den Test" value={subject} onChange={e => { setSubject(e.target.value); setJournal(false); }}>{subjects.map(s => <option key={s}>{s}</option>)}</select></label><label className="field"><span>Modus</span><select aria-label="Modus" value={mode} onChange={e => setMode(e.target.value as QuizRun["mode"])}><option value="practice">Adaptiv üben</option><option value="exam">Prüfungssimulation</option></select></label><label className="field"><span>Aufgabenanzahl</span><select aria-label="Aufgabenanzahl" value={count} onChange={e => setCount(Number(e.target.value))}>{[2, 3, 6, 10, 20].map(n => <option key={n} value={n}>{n}</option>)}</select></label>{mode === "exam" && <label className="field"><span>Zeitlimit</span><select aria-label="Zeitlimit" value={minutes} onChange={e => setMinutes(Number(e.target.value))}><option value={0}>Ohne Zeitlimit</option>{[5, 10, 20, 30].map(n => <option key={n} value={n}>{n} Minuten</option>)}</select></label>}</div><p>{mode === "practice" ? "Direkte Erklärungen nach jeder Antwort. Schwächere Bereiche kommen zuerst. Nach zwei richtigen Antworten auf der aktuellen Stufe steigt das Niveau; bei einem Fehler geht es eine Stufe zurück. Die nächste Runde berücksichtigt deinen gespeicherten Lernstand." : "Zufällige Aufgaben aus dem gewählten Fachthema. Bis zur Abgabe bleiben die Lösungen verborgen; gespeicherte Antworten kannst du über die Aufgabennummern ändern."}</p><p>{pool.length ? `${selectQuestions(scopedQuestions, workspace.quizRuns, subject, mode, count).length} unterschiedliche Aufgaben aus ${pool.length} verfügbaren Aufgaben.` : "Füge Beispiele oder eigene Testaufgaben hinzu, um zu starten."} {workspace.quizRuns.length >= 200 && "Die Grenze von 200 gespeicherten Runden ist erreicht."}</p><Button disabled={saving || launching || !pool.length || workspace.quizRuns.length >= 200} onClick={async () => {
    const startedAt = new Date().toISOString();
    const run: QuizRun = { id: crypto.randomUUID(), subject, mode, ...(collection ? { collectionId: collection.id } : {}), startedAt, deadlineAt: mode === "exam" && minutes ? new Date(Date.parse(startedAt) + minutes * 60000).toISOString() : null, finishedAt: null, questions: selectQuestions(scopedQuestions, workspace.quizRuns, subject, mode, count).map(question => withLearningNotes(question)), answers: [] };
    await persistRun(run, "Testrunde gestartet");
  }}><RotateCcw size={16} />{mode === "exam" ? "Simulation starten" : "Übungsrunde starten"}</Button></section>{profile.length > 0 && <section className="quiz-panel"><h2>Deine Lernbereiche</h2><p className="small-note">Dein Lernstand gilt für denselben Lernbereich in allen Sammlungen.</p><div className="quiz-profile">{profile.map(p => <article key={p.concept}><h3>{p.concept}</h3><p>Nächste Stufe: {difficultyLabels[p.level]}</p><small>{p.correct} richtig · {p.wrong} falsch{p.lastWrong ? " · Wiederholung empfohlen" : ""}</small></article>)}</div><Button variant="outline" onClick={() => setJournal(!journal)}>{journal ? "Fehlerjournal schließen" : `Fehlerjournal öffnen (${mistakes.length})`}</Button></section>}{journal && <section aria-label="Fehlerjournal"><h2 className="quiz-journal-title">Was ich verwechselt habe</h2>{!mistakes.length && <p>Noch keine falsch beantworteten Aufgaben in diesem Fachthema.</p>}{mistakes.map(({ run, question, answer }) => <article className="quiz-panel" key={run.id + question.id}><p className="small-note">{dateLabel(answer.answeredAt)} · {question.concept}</p><h3>{question.prompt}</h3><Feedback question={question} answer={answer} run={run} workspace={workspace} save={save} saving={saving} onOpenNote={onOpenNote} /></article>)}</section>}<LearningReminders workspace={workspace} save={save} saving={saving} /><ReminderForm subject={subject} workspace={workspace} save={save} saving={saving} />{scopedRuns.some(r => r.finishedAt) && <section className="quiz-panel"><h2>Bisherige Testrunden</h2><ul className="quiz-history">{[...scopedRuns].filter(r => r.finishedAt).reverse().map(r => <li key={r.id}><button onClick={() => setResultId(r.id)}><span>{r.subject} · {r.mode === "exam" ? "Simulation" : "Übung"}</span><small>{dateLabel(r.finishedAt!)} · {r.questions.filter(q => isCorrect(q, r.answers.find(a => a.questionId === q.id)?.selectedOptionIds ?? [])).length}/{r.questions.length} richtig</small></button></li>)}</ul></section>}{pool.length > 0 && <section className="quiz-panel"><h2>Aufgaben verwalten</h2><ul className="quiz-history">{pool.map(q => <li key={q.id}><div><span>{q.prompt}</span><small>{q.concept} · {difficultyLabels[q.difficulty]}</small></div><Button variant="ghost" size="icon" onClick={() => setEditing(withLearningNotes(q, workspace.notes))} aria-label={"Aufgabe bearbeiten: " + q.prompt}><Pencil size={16} /></Button></li>)}</ul><p className="small-note">Die letzten {FULL_RUNS_PER_SUBJECT} Runden je Fachthema behalten die damaligen Aufgaben und Erklärungen, auch wenn du eine Aufgabe bearbeitest. Ältere Runden behalten Antworten und Ergebnis; Wortlaut und Erklärungen zeigen sie aus der aktuellen Aufgabe.</p></section>}{editing && <QuestionEditor key={editing.id} question={editing} collectionId={collection?.id} workspace={workspace} save={save} saving={saving} onClose={() => setEditing(null)} />}</div>;
}
