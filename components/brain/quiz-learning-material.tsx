"use client";

import { useMemo } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Note, QuizQuestion } from "@/lib/brain/model";
import { questionLearningMaterial } from "@/lib/brain/quiz-content";
import { Markdown } from "./markdown";

export function QuizLearningMaterial({ question, notes, onOpenNote }: {
  question: QuizQuestion;
  notes: Note[];
  onOpenNote?: (id: string) => void;
}) {
  const material = useMemo(() => questionLearningMaterial(question, notes), [question, notes]);
  if (!material.length) return null;
  const selectedVisuals = material.flatMap(item => item.visuals).slice(0, 2);
  return <section className="quiz-learning-material" aria-label="Passender Lerninhalt">
    <div className="quiz-learning-material-heading"><BookOpen size={18} aria-hidden="true" /><h4>Den Zusammenhang verstehen</h4></div>
    {material.map(({ note, visuals }) => {
      const selected = visuals.filter(visual => selectedVisuals.includes(visual));
      return <article className="quiz-learning-note" key={note.id}>
        <h5>{note.title}</h5>
        {selected.map(visual => <Markdown key={visual.id} content={visual.markdown} />)}
        {onOpenNote && <Button type="button" variant="outline" size="sm" onClick={() => onOpenNote(note.id)}>Lerninhalt öffnen</Button>}
      </article>;
    })}
  </section>;
}
