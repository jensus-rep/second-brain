"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Check, ClipboardCheck, Download, Pencil, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { difficultyLabels, isCorrect, learningProfile, reminderCalendar, selectQuestions } from "@/lib/brain/quiz";
import { quizExamples } from "@/lib/brain/quiz-examples";
import { quizQuestionSchema, type LearningReminder, type QuizQuestion, type QuizRun, type Workspace } from "@/lib/brain/model";
import type { SaveWorkspace } from "@/lib/brain/use-brain";

type Props = { workspace: Workspace; save: SaveWorkspace; saving: boolean };
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

function QuestionEditor({ question, workspace, save, saving, onClose }: Props & { question: QuizQuestion; onClose: () => void }) {
  const [draft, setDraft] = useState(question);
  const [error, setError] = useState("");
  const exists = workspace.quizQuestions.some(q => q.id === question.id);
  const dirty = JSON.stringify(draft) !== JSON.stringify(question);
  useEffect(() => { const guard = (e: BeforeUnloadEvent) => { if (dirty || saving) e.preventDefault(); }; window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard); }, [dirty, saving]);
  function close() { if (!saving && (!dirty || window.confirm("Nicht gespeicherte Änderungen verwerfen?"))) onClose(); }
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="editor-dialog" onInteractOutside={e => e.preventDefault()}><DialogHeader><DialogTitle>{exists ? "Testaufgabe bearbeiten" : "Neue Testaufgabe"}</DialogTitle><DialogDescription>Markiere alle richtigen Antworten. Fehlerhinweise erklären die jeweilige Verwechslung.</DialogDescription></DialogHeader><form className="editor-form" aria-busy={saving} inert={saving} onSubmit={async event => {
    event.preventDefault();
    const result = quizQuestionSchema.safeParse(draft);
    if (!result.success) { setError(result.error.issues[0]?.message ?? "Bitte die Aufgabe prüfen."); return; }
    if (await save(w => ({ ...w, quizQuestions: exists ? w.quizQuestions.map(q => q.id === draft.id ? result.data : q) : [...w.quizQuestions, result.data] }), "Testaufgabe gespeichert")) onClose();
  }}><div className="form-columns"><label className="field"><span>Fachthema</span><Input required maxLength={160} value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })} /></label><label className="field"><span>Lernbereich</span><Input required maxLength={160} value={draft.concept} onChange={e => setDraft({ ...draft, concept: e.target.value })} placeholder="z. B. Nutzen und Bedienbarkeit" /></label></div><label className="field"><span>Schwierigkeit</span><select aria-label="Schwierigkeit" value={draft.difficulty} onChange={e => setDraft({ ...draft, difficulty: Number(e.target.value) })}>{[1, 2, 3].map(level => <option key={level} value={level}>{difficultyLabels[level]}</option>)}</select></label><label className="field"><span>Fragestellung</span><Textarea required maxLength={3000} value={draft.prompt} onChange={e => setDraft({ ...draft, prompt: e.target.value })} /></label><fieldset className="quiz-editor-options"><legend>Antwortmöglichkeiten</legend>{draft.options.map((option, index) => <div key={option.id}><label className="field"><span>Antwort {index + 1}</span><Input required maxLength={1000} value={option.text} onChange={e => setDraft({ ...draft, options: draft.options.map(o => o.id === option.id ? { ...o, text: e.target.value } : o) })} /></label><label className="quiz-correct-toggle"><Checkbox checked={draft.correctOptionIds.includes(option.id)} onCheckedChange={checked => setDraft({ ...draft, correctOptionIds: checked ? [...draft.correctOptionIds, option.id] : draft.correctOptionIds.filter(id => id !== option.id) })} />Richtige Antwort {index + 1}</label><label className="field"><span>Fehlerhinweis / Rückmeldung {index + 1}</span><Textarea maxLength={2000} value={option.feedback} onChange={e => setDraft({ ...draft, options: draft.options.map(o => o.id === option.id ? { ...o, feedback: e.target.value } : o) })} rows={2} /></label><Button type="button" size="sm" variant="ghost" disabled={draft.options.length <= 2} onClick={() => setDraft({ ...draft, options: draft.options.filter(o => o.id !== option.id), correctOptionIds: draft.correctOptionIds.filter(id => id !== option.id) })}>Antwort {index + 1} entfernen</Button></div>)}<Button type="button" variant="outline" disabled={draft.options.length >= 6} onClick={() => setDraft({ ...draft, options: [...draft.options, { id: crypto.randomUUID(), text: "", feedback: "" }] })}>Antwort hinzufügen</Button></fieldset><label className="field"><span>Erklärung und Lerntipp</span><Textarea required maxLength={4000} value={draft.explanation} onChange={e => setDraft({ ...draft, explanation: e.target.value })} /></label><label className="field"><span>Quelle (optional)</span><Input type="url" maxLength={1000} value={draft.source} onChange={e => setDraft({ ...draft, source: e.target.value })} /></label>{error && <p role="alert">{error}</p>}<div className="dialog-actions"><Button type="button" variant="outline" onClick={close}>Abbrechen</Button><Button type="submit">Aufgabe speichern</Button></div></form></DialogContent></Dialog>;
}

function Feedback({ question, answer, run, save, saving }: { question: QuizQuestion; answer?: QuizRun["answers"][number]; run: QuizRun; save: SaveWorkspace; saving: boolean }) {
  const [reflection, setReflection] = useState(answer?.reflection ?? "");
  const correct = isCorrect(question, answer?.selectedOptionIds ?? []);
  return <section className={"quiz-feedback " + (correct ? "correct" : "incorrect")} aria-label="Auswertung"><h3>{correct ? "Richtig beantwortet" : answer ? "Hier kannst du ansetzen" : "Nicht beantwortet"}</h3><p><strong>Richtige Antwort{question.correctOptionIds.length > 1 ? "en" : ""}: </strong>{question.options.filter(o => question.correctOptionIds.includes(o.id)).map(o => o.text).join(" · ")}</p>{answer && <p><strong>Deine Auswahl: </strong>{question.options.filter(o => answer.selectedOptionIds.includes(o.id)).map(o => o.text).join(" · ")}</p>}{!correct && answer && <ul>{question.options.filter(o => answer.selectedOptionIds.includes(o.id) && !question.correctOptionIds.includes(o.id)).map(o => <li key={o.id}>{o.feedback || "Diese Antwort passt nicht zur Fragestellung. Vergleiche sie mit der Erklärung."}</li>)}{question.correctOptionIds.some(id => !answer.selectedOptionIds.includes(id)) && <li>Dir fehlt mindestens eine richtige Antwort. Prüfe jede Möglichkeit einzeln.</li>}</ul>}<p>{question.explanation}</p>{question.source && <a href={question.source} target="_blank" rel="noopener noreferrer">Fachliche Quelle öffnen</a>}{answer && !correct && <div className="quiz-reflection"><label className="field"><span>Mein Denkfehler / Merksatz</span><Textarea value={reflection} maxLength={1500} rows={2} onChange={e => setReflection(e.target.value)} placeholder="Was habe ich verwechselt? Woran erkenne ich es beim nächsten Mal?" /></label><Button variant="outline" size="sm" disabled={saving || reflection === answer.reflection} onClick={() => void save(w => ({ ...w, quizRuns: w.quizRuns.map(r => r.id === run.id ? { ...r, answers: r.answers.map(a => a.questionId === question.id ? { ...a, reflection } : a) } : r) }), "Denkfehler gespeichert")}>Merksatz speichern</Button></div>}</section>;
}

function QuizSession({ run, save, saving }: { run: QuizRun; save: SaveWorkspace; saving: boolean }) {
  const initialIndex = Math.max(0, run.questions.findIndex(q => !run.answers.some(a => a.questionId === q.id)));
  const [index, setIndex] = useState(initialIndex);
  const [selected, setSelected] = useState<string[]>(() => run.answers.find(a => a.questionId === run.questions[initialIndex].id)?.selectedOptionIds ?? []);
  const [reviewId, setReviewId] = useState<string | null>(() => run.mode === "practice" ? run.answers.at(-1)?.questionId ?? null : null);
  const [now, setNow] = useState(() => Date.now());
  const autoAttempt = useRef(0);
  const question = run.questions[index];
  const expired = !!run.deadlineAt && Date.parse(run.deadlineAt) <= now;
  const answered = run.answers.find(a => a.questionId === question.id);
  const review = run.questions.find(q => q.id === reviewId);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  async function finish() {
    return save(w => ({ ...w, quizRuns: w.quizRuns.map(r => r.id === run.id && !r.finishedAt ? { ...r, finishedAt: new Date().toISOString() } : r) }), "Test beendet und Auswertung gespeichert");
  }
  useEffect(() => {
    if (!expired || saving || run.finishedAt || now - autoAttempt.current < 30000) return;
    autoAttempt.current = now;
    void save(w => ({ ...w, quizRuns: w.quizRuns.map(r => r.id === run.id && !r.finishedAt ? { ...r, finishedAt: new Date().toISOString() } : r) }), "Zeit abgelaufen. Auswertung gespeichert.");
  }, [expired, now, saving, run.id, run.finishedAt, save]);
  function move(next: number) { setIndex(next); setSelected(run.answers.find(a => a.questionId === run.questions[next].id)?.selectedOptionIds ?? []); }
  return <section className="quiz-session"><div className="quiz-session-top"><strong>{run.mode === "exam" ? "Prüfungssimulation" : "Adaptiv üben"} · {run.subject}</strong><span>{run.answers.length} von {run.questions.length} beantwortet{run.deadlineAt && " · " + (expired ? "Zeit abgelaufen" : Math.ceil((Date.parse(run.deadlineAt) - now) / 60000) + " Min. übrig")}</span></div><Progress value={run.answers.length / run.questions.length * 100} aria-label="Testfortschritt" />{run.mode === "exam" && <nav className="quiz-question-nav" aria-label="Aufgaben im Test">{run.questions.map((q, i) => <Button key={q.id} variant={i === index ? "default" : "outline"} size="sm" onClick={() => move(i)} disabled={saving || expired} aria-label={"Aufgabe " + (i + 1) + (run.answers.some(a => a.questionId === q.id) ? ", beantwortet" : "")}>{i + 1}{run.answers.some(a => a.questionId === q.id) ? " ✓" : ""}</Button>)}</nav>}{review && run.mode === "practice" ? <article className="quiz-panel"><h2>{review.prompt}</h2><Feedback key={review.id} question={review} answer={run.answers.find(a => a.questionId === review.id)} run={run} save={save} saving={saving} /><Button disabled={saving} onClick={() => { const next = run.questions.findIndex(q => !run.answers.some(a => a.questionId === q.id)); if (next < 0) void finish(); else { move(next); setReviewId(null); } }}>{run.answers.length === run.questions.length ? "Runde abschließen" : "Nächste Aufgabe"}</Button></article> : <form className="quiz-panel quiz-question" onSubmit={async event => {
    event.preventDefault(); if (expired || !selected.length || saving) return;
    const answer = { questionId: question.id, selectedOptionIds: selected, answeredAt: new Date().toISOString(), reflection: answered?.reflection ?? "" };
    const ok = await save(w => ({ ...w, quizRuns: w.quizRuns.map(r => {
      if (r.id !== run.id) return r;
      if (r.finishedAt || (r.deadlineAt && Date.parse(r.deadlineAt) <= Date.now())) throw new Error("Die Testrunde ist bereits beendet.");
      return { ...r, answers: [...r.answers.filter(a => a.questionId !== question.id), answer] };
    }) }), "Antwort gespeichert");
    if (ok) { if (run.mode === "practice") setReviewId(question.id); else if (index < run.questions.length - 1) move(index + 1); }
  }}><div className="eyebrow">{question.concept} · {difficultyLabels[question.difficulty]}</div><h2 tabIndex={-1}>Aufgabe {index + 1}: {question.prompt}</h2><p>Wähle alle passenden Antworten. Die Auswahl muss vollständig stimmen; es gibt keine Teilpunkte.</p><fieldset disabled={saving || expired}><legend className="sr-only">Antwortmöglichkeiten</legend>{question.options.map(option => <label className="quiz-option" key={option.id}><Checkbox checked={selected.includes(option.id)} onCheckedChange={checked => setSelected(current => checked ? [...current, option.id] : current.filter(id => id !== option.id))} /><span>{option.text}</span></label>)}</fieldset><div className="quiz-actions"><Button type="submit" disabled={saving || expired || !selected.length}>Antwort speichern</Button>{answered && run.mode === "exam" && <span>Gespeicherte Auswahl: {question.options.filter(o => answered.selectedOptionIds.includes(o.id)).map(o => o.text).join(" · ")}</span>}</div></form>}<div className="quiz-session-end"><p>{run.mode === "exam" ? "Lösungen und Fehlerhinweise erscheinen nach der Abgabe. Unbeantwortete Aufgaben zählen als falsch." : "Deine Antworten sind gespeichert. Du kannst die Runde später fortsetzen oder jetzt auswerten."}</p><Button variant="outline" disabled={saving} onClick={() => { if (run.answers.length === run.questions.length || window.confirm("Runde jetzt beenden? Unbeantwortete Aufgaben bleiben offen und zählen im Ergebnis als falsch.")) void finish(); }}>{run.mode === "exam" ? "Test abgeben" : "Runde vorzeitig beenden"}</Button></div></section>;
}

export function Quizzes({ workspace, save, saving }: Props) {
  const [subject, setSubject] = useState(() => workspace.quizQuestions[0]?.subject ?? "Projektmanagement");
  const [mode, setMode] = useState<QuizRun["mode"]>("practice");
  const [count, setCount] = useState(6);
  const [minutes, setMinutes] = useState(10);
  const [editing, setEditing] = useState<QuizQuestion | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [journal, setJournal] = useState(false);
  const active = workspace.quizRuns.find(r => !r.finishedAt);
  const result = workspace.quizRuns.find(r => r.id === resultId && r.finishedAt);
  const previousActive = useRef(active?.id);
  useEffect(() => { if (previousActive.current && !active) setResultId(previousActive.current); previousActive.current = active?.id; }, [active]);
  const subjects = [...new Set([...workspace.quizQuestions.map(q => q.subject), "Projektmanagement", "Produktmanagement"])];
  const pool = workspace.quizQuestions.filter(q => q.subject === subject);
  const profile = learningProfile(pool, workspace.quizRuns);
  const mistakes = workspace.quizRuns.flatMap(run => run.mode === "exam" && !run.finishedAt ? [] : run.answers.flatMap(answer => {
    const question = run.questions.find(q => q.id === answer.questionId);
    return question && question.subject === subject && !isCorrect(question, answer.selectedOptionIds) ? [{ run, question, answer }] : [];
  })).sort((a, b) => b.answer.answeredAt.localeCompare(a.answer.answeredAt));
  if (active) return <QuizSession key={active.id} run={active} save={save} saving={saving} />;
  if (result) {
    const correct = result.questions.filter(q => isCorrect(q, result.answers.find(a => a.questionId === q.id)?.selectedOptionIds ?? [])).length;
    return <div className="quizzes"><section className="quiz-panel quiz-result"><span className="eyebrow">DEINE AUSWERTUNG</span><h2>{correct} von {result.questions.length} richtig · {Math.round(correct / result.questions.length * 100)} %</h2><p>{result.subject} · {result.mode === "exam" ? "Prüfungssimulation" : "Übungsrunde"} · {dateLabel(result.finishedAt!)}. Das Ergebnis ist eine Lernhilfe und verwendet keine offizielle Prüfungsbewertung.</p><Button onClick={() => { setSubject(result.subject); setResultId(null); }}>Zur Testübersicht</Button></section>{result.questions.map((q, i) => <article key={q.id} className="quiz-panel"><h3>Aufgabe {i + 1}: {q.prompt}</h3><Feedback question={q} answer={result.answers.find(a => a.questionId === q.id)} run={result} save={save} saving={saving} /></article>)}<ReminderForm subject={result.subject} workspace={workspace} save={save} saving={saving} /></div>;
  }
  return <div className="quizzes"><div className="quiz-actions"><Button onClick={() => setEditing(newQuestion(subject))} disabled={saving}><Plus size={16} />Neue Testaufgabe</Button><Button variant="outline" disabled={saving || quizExamples.every(q => workspace.quizQuestions.some(existing => existing.id === q.id))} onClick={() => void save(w => ({ ...w, quizQuestions: [...w.quizQuestions, ...quizExamples.filter(q => !w.quizQuestions.some(existing => existing.id === q.id))] }), "Beispielaufgaben hinzugefügt")}><ClipboardCheck size={16} />Beispiele hinzufügen</Button></div><p className="small-note">12 Beispielaufgaben in drei Stufen: Projektmanagement am Scrum-Beispiel und Produktmanagement mit Discovery-Risiken. Eigene Aufgaben kannst du für jedes Fachthema anlegen.</p><section className="quiz-panel"><div className="quiz-config"><label className="field"><span>Fachthema für den Test</span><select aria-label="Fachthema für den Test" value={subject} onChange={e => { setSubject(e.target.value); setJournal(false); }}>{subjects.map(s => <option key={s}>{s}</option>)}</select></label><label className="field"><span>Modus</span><select aria-label="Modus" value={mode} onChange={e => setMode(e.target.value as QuizRun["mode"])}><option value="practice">Adaptiv üben</option><option value="exam">Prüfungssimulation</option></select></label><label className="field"><span>Aufgabenanzahl</span><select aria-label="Aufgabenanzahl" value={count} onChange={e => setCount(Number(e.target.value))}>{[2, 3, 6, 10, 20].map(n => <option key={n} value={n}>{n}</option>)}</select></label>{mode === "exam" && <label className="field"><span>Zeitlimit</span><select aria-label="Zeitlimit" value={minutes} onChange={e => setMinutes(Number(e.target.value))}><option value={0}>Ohne Zeitlimit</option>{[5, 10, 20, 30].map(n => <option key={n} value={n}>{n} Minuten</option>)}</select></label>}</div><p>{mode === "practice" ? "Direkte Erklärungen nach jeder Antwort. Schwächere Bereiche kommen zuerst. Nach zwei richtigen Antworten auf der aktuellen Stufe steigt das Niveau; bei einem Fehler geht es eine Stufe zurück. Die nächste Runde berücksichtigt deinen gespeicherten Lernstand." : "Zufällige Aufgaben aus dem gewählten Fachthema. Bis zur Abgabe bleiben die Lösungen verborgen; gespeicherte Antworten kannst du über die Aufgabennummern ändern."}</p><p>{pool.length ? `${selectQuestions(workspace.quizQuestions, workspace.quizRuns, subject, mode, count).length} unterschiedliche Aufgaben aus ${pool.length} verfügbaren Aufgaben.` : "Füge Beispiele oder eigene Testaufgaben hinzu, um zu starten."} {workspace.quizRuns.length >= 200 && "Die Grenze von 200 gespeicherten Runden ist erreicht."}</p><Button disabled={saving || !pool.length || workspace.quizRuns.length >= 200} onClick={async () => {
    const startedAt = new Date().toISOString();
    const run: QuizRun = { id: crypto.randomUUID(), subject, mode, startedAt, deadlineAt: mode === "exam" && minutes ? new Date(Date.parse(startedAt) + minutes * 60000).toISOString() : null, finishedAt: null, questions: selectQuestions(workspace.quizQuestions, workspace.quizRuns, subject, mode, count), answers: [] };
    await save(w => { if (w.quizRuns.some(r => !r.finishedAt)) throw new Error("Eine andere Testrunde läuft bereits. Lade den aktuellen Stand."); return { ...w, quizRuns: [...w.quizRuns, run] }; }, "Testrunde gestartet");
  }}><RotateCcw size={16} />{mode === "exam" ? "Simulation starten" : "Übungsrunde starten"}</Button></section>{profile.length > 0 && <section className="quiz-panel"><h2>Deine Lernbereiche</h2><div className="quiz-profile">{profile.map(p => <article key={p.concept}><h3>{p.concept}</h3><p>Nächste Stufe: {difficultyLabels[p.level]}</p><small>{p.correct} richtig · {p.wrong} falsch{p.lastWrong ? " · Wiederholung empfohlen" : ""}</small></article>)}</div><Button variant="outline" onClick={() => setJournal(!journal)}>{journal ? "Fehlerjournal schließen" : `Fehlerjournal öffnen (${mistakes.length})`}</Button></section>}{journal && <section aria-label="Fehlerjournal"><h2 className="quiz-journal-title">Was ich verwechselt habe</h2>{!mistakes.length && <p>Noch keine falsch beantworteten Aufgaben in diesem Fachthema.</p>}{mistakes.map(({ run, question, answer }) => <article className="quiz-panel" key={run.id + question.id}><p className="small-note">{dateLabel(answer.answeredAt)} · {question.concept}</p><h3>{question.prompt}</h3><Feedback question={question} answer={answer} run={run} save={save} saving={saving} /></article>)}</section>}<LearningReminders workspace={workspace} save={save} saving={saving} /><ReminderForm subject={subject} workspace={workspace} save={save} saving={saving} />{workspace.quizRuns.some(r => r.finishedAt) && <section className="quiz-panel"><h2>Bisherige Testrunden</h2><ul className="quiz-history">{[...workspace.quizRuns].filter(r => r.finishedAt).reverse().map(r => <li key={r.id}><button onClick={() => setResultId(r.id)}><span>{r.subject} · {r.mode === "exam" ? "Simulation" : "Übung"}</span><small>{dateLabel(r.finishedAt!)} · {r.questions.filter(q => isCorrect(q, r.answers.find(a => a.questionId === q.id)?.selectedOptionIds ?? [])).length}/{r.questions.length} richtig</small></button></li>)}</ul></section>}{pool.length > 0 && <section className="quiz-panel"><h2>Aufgaben verwalten</h2><ul className="quiz-history">{pool.map(q => <li key={q.id}><div><span>{q.prompt}</span><small>{q.concept} · {difficultyLabels[q.difficulty]}</small></div><Button variant="ghost" size="icon" onClick={() => setEditing(q)} aria-label={"Aufgabe bearbeiten: " + q.prompt}><Pencil size={16} /></Button></li>)}</ul><p className="small-note">Bisherige Runden behalten die damaligen Aufgaben und Erklärungen, auch wenn du eine Aufgabe bearbeitest.</p></section>}{editing && <QuestionEditor key={editing.id} question={editing} workspace={workspace} save={save} saving={saving} onClose={() => setEditing(null)} />}</div>;
}
