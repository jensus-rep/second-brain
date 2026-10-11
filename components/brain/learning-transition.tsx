"use client";

import type { ReactNode } from "react";
import { CircleAlert, Sparkles } from "lucide-react";

export function LearningTransition({ title, description, error = false, children }: {
  title: string;
  description: string;
  error?: boolean;
  children?: ReactNode;
}) {
  return <section className={`learning-transition${error ? " is-error" : ""}`} aria-busy={!error} aria-label={title}>
    <span className="learning-transition-icon" aria-hidden="true">{error ? <CircleAlert size={25} /> : <Sparkles size={25} />}</span>
    <div role={error ? "alert" : "status"} aria-live="polite"><h2>{title}</h2><p>{description}</p></div>
    {!error && <div className="learning-transition-track" aria-hidden="true"><span /></div>}
    {children && <div className="learning-transition-actions">{children}</div>}
  </section>;
}
