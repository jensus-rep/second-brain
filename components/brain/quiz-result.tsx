"use client";

import { useEffect, useId, useRef, type CSSProperties } from "react";
import { Check, CircleHelp, Compass, X } from "lucide-react";
import type { QuizQuestion, QuizRun } from "@/lib/brain/model";
import { isCorrect } from "@/lib/brain/quiz";

type Props = { run: QuizRun; questions?: QuizQuestion[] };

const finishedDate = (date: string) => new Intl.DateTimeFormat("de-DE", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin",
}).format(new Date(date));

export function QuizResultSummary({ run, questions = run.questions }: Props) {
  const headingId = useId();
  const summaryRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!run.finishedAt) return;
    summaryRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    headingRef.current?.focus({ preventScroll: true });
  }, [run.id, run.finishedAt]);
  // Grade the saved snapshot, even when restored wording is supplied for display.
  const answers = new Map(run.answers.map(answer => [answer.questionId, answer]));
  const shownQuestions = new Map(questions.map(question => [question.id, question]));
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  const reviewConcepts = new Map<string, number>();

  for (const question of run.questions) {
    const selected = answers.get(question.id)?.selectedOptionIds ?? [];
    if (isCorrect(question, selected)) correct++;
    else {
      if (selected.length) incorrect++;
      else unanswered++;
      const concept = shownQuestions.get(question.id)?.concept ?? question.concept;
      reviewConcepts.set(concept, (reviewConcepts.get(concept) ?? 0) + 1);
    }
  }

  const total = run.questions.length;
  const percent = total ? Math.round(correct / total * 100) : 0;
  const review = [...reviewConcepts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([concept]) => concept);
  const title = correct === total && total > 0 ? "Alle Aufgaben richtig beantwortet."
    : percent >= 80 ? "Viele Antworten sitzen bereits."
    : correct > 0 ? "Darauf kannst du aufbauen."
    : "Deine nächste Lernrunde hat einen klaren Fokus.";
  const ringStyle = { "--quiz-result-offset": 100 - percent } as CSSProperties;

  // An unfinished simulation must never reveal grading, including when used elsewhere.
  if (!run.finishedAt) return null;

  return <section ref={summaryRef} key={run.id} className="quiz-panel quiz-result-summary" aria-labelledby={headingId}>
    <div className="quiz-result-overline"><span className="eyebrow">DEINE AUSWERTUNG</span><span className="quiz-result-completed"><Check size={14} aria-hidden="true" />Runde abgeschlossen</span></div>
    <div className="quiz-result-hero">
      <div className="quiz-result-ring" style={ringStyle} aria-hidden="true">
        <svg viewBox="0 0 128 128" focusable="false">
          <circle className="quiz-result-ring-track" cx="64" cy="64" r="52" />
          <circle className="quiz-result-ring-value" cx="64" cy="64" r="52" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - percent} />
        </svg>
        <div className="quiz-result-ring-label"><strong>{percent}<span>%</span></strong><small>richtig</small></div>
      </div>
      <div className="quiz-result-copy">
        <p className="quiz-result-encouragement">{title}</p>
        <h2 ref={headingRef} id={headingId} tabIndex={-1}>{correct} von {total} richtig · {percent} %</h2>
        <p className="quiz-result-meta">{run.subject} · {run.mode === "exam" ? "Prüfungssimulation" : "Übungsrunde"}<br />{finishedDate(run.finishedAt)} (Berlin)</p>
      </div>
    </div>
    <dl className="quiz-result-stats" aria-label="Ergebnis nach Antwortstatus">
      <div className="quiz-result-stat is-correct"><dt><Check size={16} aria-hidden="true" />Richtig</dt><dd>{correct}</dd></div>
      <div className="quiz-result-stat is-incorrect"><dt><X size={16} aria-hidden="true" />Falsch</dt><dd>{incorrect}</dd></div>
      <div className="quiz-result-stat is-unanswered"><dt><CircleHelp size={16} aria-hidden="true" />Offen</dt><dd>{unanswered}</dd></div>
    </dl>
    <div className="quiz-result-next"><Compass size={20} aria-hidden="true" /><div><h3>{review.length ? "Dein nächster Lernschritt" : "Wissen weiter festigen"}</h3><p>{review.length ? <>Sieh dir unten die Erklärungen an und erkläre die Zusammenhänge anschließend mit eigenen Worten. Besonders hilfreich: <strong>{review.join(", ")}</strong>.</> : "Alle Aufgaben dieser Runde stimmen. Erkläre die Antworten auch mit eigenen Worten und prüfe dein Wissen später mit weiteren Aufgaben."}</p>{unanswered > 0 && <p className="quiz-result-open-note">{unanswered === 1 ? "Eine Aufgabe blieb unbeantwortet." : `${unanswered} Aufgaben blieben unbeantwortet.`} Auch dort lohnt sich ein Blick auf die Erklärung.</p>}</div></div>
    <p className="quiz-result-grading">Nur vollständig richtige Aufgaben zählen. Offene Aufgaben zählen nicht als richtig.</p>
  </section>;
}
