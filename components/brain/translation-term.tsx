"use client";

import { createContext, useContext, useId, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const TranslationContext = createContext<{ active: string | null; setActive: Dispatch<SetStateAction<string | null>> } | null>(null);

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<string | null>(null);
  const value = useMemo(() => ({ active, setActive }), [active]);
  return <TranslationContext.Provider value={value}><TooltipProvider>{children}</TooltipProvider></TranslationContext.Provider>;
}

export function TranslationTerm({ node, children, translation, lang, ...props }: {
  node?: { properties?: Record<string, unknown> };
  children?: ReactNode;
  translation?: string;
  lang?: string;
  "data-translation"?: string;
}) {
  const id = useId();
  const context = useContext(TranslationContext);
  const [localOpen, setLocalOpen] = useState(false);
  const open = context ? context.active === id : localOpen;
  const setOpen = (next: boolean) => {
    if (context) context.setActive(current => next ? id : current === id ? null : current);
    else setLocalOpen(next);
  };
  const pointerWasOpen = useRef(false);
  const meaning = translation ?? String(props["data-translation"] ?? node?.properties?.dataTranslation ?? "");
  if (!meaning.trim()) return <>{children}</>;
  return <Tooltip open={open} onOpenChange={setOpen}>
    <TooltipTrigger asChild>
      <button type="button" className="translation-term" lang={lang}
        onPointerEnter={event => { if (event.pointerType !== "touch") setOpen(true); }}
        onPointerDown={() => { pointerWasOpen.current = open; }}
        onClick={event => {
          // Tooltip normally closes on click. Keep touch lookups open until a
          // second tap or an outside tap, while retaining native hover/focus.
          event.preventDefault();
          event.stopPropagation();
          setOpen(event.detail === 0 ? !open : !pointerWasOpen.current);
        }}>{children}</button>
    </TooltipTrigger>
    <TooltipContent className="translation-tooltip" sideOffset={7} collisionPadding={12} lang="de"
      onEscapeKeyDown={event => event.stopPropagation()}>
      <span className="translation-caption">{lang === "id" ? "Indonesisch → Deutsch" : "Übersetzung"}</span>
      <span>{meaning}</span>
    </TooltipContent>
  </Tooltip>;
}
