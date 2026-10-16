"use client";
import { Children, createContext, useContext, type ReactNode } from "react";
import { linkGlossaryTerms, type Glossary, type TreeNode } from "@/lib/brain/glossary";

export type GlossaryApi = { glossary: Glossary; open: (noteId: string, term: string, origin?: HTMLElement) => void };
export const GlossaryContext = createContext<GlossaryApi | null>(null);
export const useGlossary = () => useContext(GlossaryContext);

export function rehypeGlossary({ glossary, skipNoteId }: { glossary: Glossary; skipNoteId: string | null }) {
  return (tree: unknown) => linkGlossaryTerms(tree as TreeNode, glossary, skipNoteId);
}

export function GlossaryTerm({ node, children, ...props }: { node?: { properties?: Record<string, unknown> }; children?: ReactNode; "data-note-id"?: string; "data-term"?: string }) {
  const glossary = useGlossary();
  const noteId = String(props["data-note-id"] ?? node?.properties?.dataNoteId ?? "");
  if (!glossary || !noteId) return <>{children}</>;
  const term = String(props["data-term"] ?? node?.properties?.dataTerm ?? Children.toArray(children).filter(child => typeof child === "string").join(""));
  return <button type="button" className="glossary-term" aria-haspopup="dialog" title="Abbildung und Kurzbeschreibung ansehen"
    onClick={event => { event.stopPropagation(); glossary.open(noteId, term, event.currentTarget); }}>{children}</button>;
}
