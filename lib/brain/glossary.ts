import type { Note } from "./model.ts";

// Notes are titled "Begriff: Untertitel". The part before the colon names the
// concept a learning card can point back to. A note can add further terms
// (abbreviations, synonyms, concepts it explains in a section) in `terms`.

// Terms of one group ("Story Mapping", "Story Map") name the same concept and are linked once.
export type GlossaryEntry = { term: string; noteId: string; caseSensitive: boolean; group: string };
export type Glossary = { entries: GlossaryEntry[]; byKey: Map<string, GlossaryEntry>; pattern: RegExp | null };
export type GlossaryMatch = { start: number; end: number; text: string; term: string; noteId: string; group: string };
export type NoteVisual =
  | { kind: "image"; src: string; alt: string; caption: string; heading: string }
  | { kind: "diagram"; source: string; heading: string }
  | { kind: "table"; markdown: string; heading: string };
export type NoteSection = { heading: string; text: string };

// Words that name a whole field rather than one concept. They are only skipped
// when a title lists several parts ("Produkt und Projekt"), never as a title's
// sole concept.
const GENERIC_PARTS = new Set([
  "anwendung", "ausblick", "begriffe", "beispiele", "betrieb", "daten", "doing", "einordnung", "führung", "grundlagen",
  "management", "menschen", "methoden", "planung", "praxis", "produkt", "produkte", "projekt", "projekte", "quellen", "team", "teams", "werkzeuge", "ziele", "zusammenarbeit",
]);
const GENERIC_TERMS = new Set(["ausblick", "einführung", "einleitung", "grundlagen", "quellen", "überblick", "zusammenfassung"]);
const MIN_TERM_LENGTH = 3;
const MAX_TERM_LENGTH = 60;
const MAX_EXCERPT = 480;
const SUFFIX = "(?:e|en|er|ern|es|n|s)?";
// Spaces, hyphens and dashes are interchangeable: "Vision-Board" names the
// "Vision Board", "Build – Measure – Learn" the "Build-Measure-Learn" loop.
const GAP = "[\\s\\u00a0\\u2010-\\u2014-]+";

const isCapitalized = (word: string) => /^[\p{Lu}\d]/u.test(word);
const isAcronym = (word: string) => (word.match(/\p{Lu}/gu)?.length ?? 0) >= 2 && !/\s/.test(word);
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const tidy = (value: string) => value.replace(/\s+/g, " ").trim();
const normalize = (value: string) => value.replace(new RegExp(GAP, "g"), " ").trim();
const keyOf = (value: string) => normalize(value).toLocaleLowerCase("de");
const termSource = (term: string) => normalize(term).split(" ").map(escapeRegExp).join(GAP);

export function splitNoteTitle(title: string): { head: string; subtitle: string } {
  const colon = title.indexOf(":");
  return colon > 0 ? { head: title.slice(0, colon).trim(), subtitle: title.slice(colon + 1).trim() } : { head: title.trim(), subtitle: "" };
}

/** Terms derived from a title alone. Each group holds one concept with its short forms ("Product Vision Board", "Vision Board"). */
export function titleTermGroups(title: string): string[][] {
  const { head } = splitNoteTitle(title);
  const groups: string[][] = [];
  const acronyms = [...head.matchAll(/\(([^()]+)\)/g)].map(match => match[1].trim()).filter(isAcronym);
  const base = head.replace(/\s*\([^()]*\)/g, "").trim();
  const parts = base.split(/\s*,\s*|\s+(?:und|&)\s+/).map(part => part.trim()).filter(Boolean);
  // A map is what the mapping technique produces: "Impact Mapping" → "Impact Map".
  const withMaps = (terms: string[]) => [...terms, ...terms.filter(term => /\S\s+Mapping$/i.test(term)).map(term => term.replace(/ping$/i, ""))];
  if (parts.length === 1) {
    const group = GENERIC_TERMS.has(base.toLocaleLowerCase("de")) ? [] : [base];
    const words = base.split(/\s+/);
    if (words.length >= 3) {
      const last = words[words.length - 1];
      // "User Stories prüfen" → "User Stories"; "Product Vision Board" → "Vision Board"
      if (!isCapitalized(last)) group.push(words.slice(0, -1).join(" "));
      else if (isCapitalized(words[words.length - 2])) group.push(words.slice(-2).join(" "));
    }
    groups.push(withMaps(group));
  } else {
    for (const part of parts) {
      if (part.includes(" ") || isAcronym(part) || !GENERIC_PARTS.has(part.toLocaleLowerCase("de"))) groups.push(withMaps([part]));
    }
  }
  groups.push(...acronyms.map(acronym => [acronym]));
  return groups.map(group => [...new Set(group.map(tidy))].filter(term => term.length >= MIN_TERM_LENGTH && term.length <= MAX_TERM_LENGTH))
    .filter(group => group.length);
}

export function noteTerms(title: string): string[] {
  return [...new Set(titleTermGroups(title).flat())];
}

/** Terms a note was given explicitly, in the order they were entered. */
export function parseTerms(value: string): string[] {
  const seen = new Set<string>();
  return value.split(/[,;\n]/).map(tidy).filter(term => {
    const key = keyOf(term);
    if (term.length < 2 || term.length > MAX_TERM_LENGTH || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildGlossary(notes: (Pick<Note, "id" | "title" | "archived"> & { terms?: string[] })[]): Glossary {
  const claims = new Map<string, { term: string; explicit: Set<string>; derived: Map<string, string> }>();
  const claim = (term: string, noteId: string, group: string | null) => {
    const key = keyOf(term);
    if (!key) return;
    const current = claims.get(key) ?? { term, explicit: new Set<string>(), derived: new Map<string, string>() };
    if (group === null) {
      if (!current.explicit.size) current.term = term;
      current.explicit.add(noteId);
    } else current.derived.set(noteId, group);
    claims.set(key, current);
  };
  for (const note of notes) {
    if (note.archived) continue;
    for (const term of note.terms ?? []) claim(tidy(term), note.id, null);
    for (const group of titleTermGroups(note.title)) for (const term of group) claim(term, note.id, note.id + "\u0000" + keyOf(group[0]));
  }
  // A term chosen for a note wins over one read from another title. A term
  // several notes claim equally ("Projektmanagement") would open an arbitrary one.
  const entries = [...claims.values()].flatMap(({ term, explicit, derived }) => {
    if (explicit.size) return explicit.size === 1 ? [{ term, noteId: [...explicit][0], caseSensitive: isAcronym(term), group: keyOf(term) }] : [];
    return derived.size === 1 ? [...derived].map(([noteId, group]) => ({ term, noteId, caseSensitive: isAcronym(term), group })) : [];
  }).sort((a, b) => b.term.length - a.term.length || a.term.localeCompare(b.term, "de"));
  const byKey = new Map(entries.map(entry => [keyOf(entry.term), entry]));
  const pattern = entries.length ? new RegExp(`(?<![\\p{L}\\p{N}])(${entries.map(entry => termSource(entry.term)).join("|")})${SUFFIX}(?![\\p{L}\\p{N}])`, "giu") : null;
  return { entries, byKey, pattern };
}

export function findGlossaryTerms(text: string, glossary: Glossary): GlossaryMatch[] {
  if (!glossary.pattern) return [];
  const pattern = new RegExp(glossary.pattern.source, glossary.pattern.flags);
  const matches: GlossaryMatch[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const entry = glossary.byKey.get(keyOf(match[1]));
    if (!entry || entry.caseSensitive && normalize(match[1]) !== normalize(entry.term)) {
      pattern.lastIndex = match.index + 1;
      continue;
    }
    matches.push({ start: match.index, end: match.index + match[0].length, text: match[0], term: entry.term, noteId: entry.noteId, group: entry.group });
  }
  return matches;
}

export type TreeNode = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: TreeNode[] };
const UNLINKED_TAGS = new Set(["a", "button", "code", "pre", "svg", "glossary-term"]);
export const GLOSSARY_TAG = "glossary-term";

/** Marks the first mention of each glossary term in a rendered Markdown tree. "Scrum" and "Product Owner" open different parts of one note, so both stay links. */
export function linkGlossaryTerms(tree: TreeNode, glossary: Glossary, skipNoteId?: string | null) {
  const linked = new Set<string>();
  const visit = (node: TreeNode) => {
    if (!node.children || node.type === "element" && UNLINKED_TAGS.has(node.tagName ?? "")) return;
    node.children = node.children.flatMap(child => {
      if (child.type !== "text" || !child.value) { visit(child); return [child]; }
      const value = child.value;
      const parts: TreeNode[] = [];
      let cursor = 0;
      for (const match of findGlossaryTerms(value, glossary)) {
        if (match.noteId === skipNoteId || linked.has(match.group)) continue;
        linked.add(match.group);
        if (match.start > cursor) parts.push({ type: "text", value: value.slice(cursor, match.start) });
        parts.push({ type: "element", tagName: GLOSSARY_TAG, properties: { dataNoteId: match.noteId, dataTerm: match.term }, children: [{ type: "text", value: match.text }] });
        cursor = match.end;
      }
      if (!parts.length) return [child];
      if (cursor < value.length) parts.push({ type: "text", value: value.slice(cursor) });
      return parts;
    });
  };
  visit(tree);
}

export function sameTerm(a: string, b: string) {
  return keyOf(a) === keyOf(b);
}

function mentionsTerm(text: string, term: string) {
  return !!normalize(term) && new RegExp(`(?<![\\p{L}\\p{N}])${termSource(term)}${SUFFIX}(?![\\p{L}\\p{N}])`, "iu").test(text);
}

// "OKR" stands for "Objectives and Key Results", "MbO" for "Management by Objectives".
function spellsAcronym(heading: string, term: string) {
  if (!isAcronym(term) || term.length > 6) return false;
  const wanted = term.toLocaleLowerCase("de");
  const words = heading.replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/[\s-]+/).filter(Boolean);
  return [words, words.filter(isCapitalized)].some(list => list.some((_, start) =>
    list.slice(start, start + wanted.length).map(word => word[0]).join("").toLocaleLowerCase("de") === wanted));
}

function clip(text: string) {
  if (text.length <= MAX_EXCERPT) return text;
  const cut = text.slice(0, MAX_EXCERPT);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  const result = end > MAX_EXCERPT / 3 ? cut.slice(0, end + 1) : cut.slice(0, cut.lastIndexOf(" ")) + " …";
  // Never leave a bold marker open.
  return (result.match(/\*\*/g)?.length ?? 0) % 2 ? result.replace(/\*\*(?![\s\S]*\*\*)/, "") : result;
}

/** The first section whose heading names the term, with its opening prose (empty when the section only holds a table or figure). */
export function noteSection(content: string, term: string): NoteSection | null {
  const lines = content.split(/\r?\n/);
  let fence = "";
  for (let i = 0; i < lines.length; i++) {
    const marker = lines[i].match(/^\s*(`{3,}|~{3,})/);
    if (marker) { fence = !fence ? marker[1] : lines[i].trim().startsWith(fence) ? "" : fence; continue; }
    if (fence) continue;
    const heading = lines[i].match(/^#{2,6}\s+(.+?)\s*#*\s*$/)?.[1].replace(/[`*_]/g, "");
    if (!heading || !mentionsTerm(heading, term) && !spellsAcronym(heading, term)) continue;
    const paragraphs: string[] = [];
    let current: string[] = [];
    let inner = "";
    const flush = () => {
      const text = current.join("\n");
      // Source notes are references, not explanations.
      if (text && !/^[*_]*(Quelle|Quellen|Grundlage|Literatur)\b/i.test(text)) paragraphs.push(text);
      current = [];
    };
    // A sentence announcing a table or figure ("… diese fünf Prüffragen:") makes no sense without it.
    const skipBlock = () => { flush(); if (paragraphs.at(-1)?.trimEnd().endsWith(":")) paragraphs.pop(); };
    for (let j = i + 1; j < lines.length && paragraphs.join("").length < 200; j++) {
      const line = lines[j];
      const innerMarker = line.match(/^\s*(`{3,}|~{3,})/);
      if (innerMarker) { if (!inner) skipBlock(); inner = !inner ? innerMarker[1] : line.trim().startsWith(inner) ? "" : inner; continue; }
      if (inner) continue;
      if (/^#{1,6}\s/.test(line)) break;
      if (!line.trim()) { flush(); continue; }
      // Tables, images and quotes are illustrations or tasks, not the explanation.
      if (/^\s*(\||!\[|>)/.test(line)) { skipBlock(); continue; }
      current.push(line.trim());
    }
    flush();
    if (paragraphs.at(-1)?.trimEnd().endsWith(":")) paragraphs.pop();
    return { heading, text: paragraphs.length ? clip(paragraphs.join("\n\n")) : "" };
  }
  return null;
}

export function noteVisuals(content: string): NoteVisual[] {
  const visuals: NoteVisual[] = [];
  const lines = content.split(/\r?\n/);
  let heading = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*(`{3,}|~{3,})\s*([\w-]*)/);
    if (fence) {
      const body: string[] = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith(fence[1]); i++) body.push(lines[i]);
      if (fence[2] === "mermaid" && body.join("").trim()) visuals.push({ kind: "diagram", source: body.join("\n").trim(), heading });
      continue;
    }
    const title = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (title) { heading = title[1].replace(/[`*_]/g, ""); continue; }
    // Tables are drawn as comparison graphics, so they count as illustrations.
    if (/^\s*\|/.test(line) && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? "")) {
      const rows = [line];
      for (i++; i < lines.length && /^\s*\|/.test(lines[i]); i++) rows.push(lines[i]);
      i--;
      visuals.push({ kind: "table", markdown: rows.join("\n"), heading });
      continue;
    }
    for (const image of line.matchAll(/!\[([^\]]*)\]\((\/api\/media\/[0-9a-f-]{36})(?:\s+"([^"]*)")?\)/gi)) {
      visuals.push({ kind: "image", src: image[2], alt: image[1].trim(), caption: image[3]?.trim() ?? "", heading });
    }
  }
  return visuals;
}

/** Prefers a visual of the term's section, then one that names the term, then an uploaded graphic, then the first diagram or table. */
export function preferredVisual(visuals: NoteVisual[], term = "", section = ""): number {
  if (!visuals.length) return -1;
  const mentions = (visual: NoteVisual) => !!normalize(term) && mentionsTerm([visual.heading, visual.kind === "image" ? visual.alt + " " + visual.caption : ""].join(" "), term);
  const ranked = visuals.map((visual, index) => ({ index,
    score: (section && visual.heading === section ? 4 : 0) + (mentions(visual) ? 2 : 0) + (visual.kind === "image" ? 1 : 0) }));
  return ranked.reduce((best, item) => item.score > best.score ? item : best).index;
}
