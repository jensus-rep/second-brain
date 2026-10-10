import type { Note, QuizQuestion } from "./model.ts";
import { isAllowedDiagram } from "./diagram.ts";
import { isPrivateImage } from "./media.ts";

export type LearningVisual = { id: string; markdown: string; kind: "image" | "diagram" | "comparison"; heading?: string };

// Explicit links survive renamed concepts and prevent an unrelated figure from
// becoming feedback merely because its note contains a similar word.
export function quizLearningNotes(question: Pick<QuizQuestion, "id" | "concept"> & { noteIds?: string[] }, notes: Note[]): Note[] {
  const byId = new Map(notes.map(note => [note.id, note]));
  return [...new Set(question.noteIds ?? [])].flatMap(id => {
    const note = byId.get(id);
    return note ? [note] : [];
  });
}

type Block = { kind: "heading" | "text" | "code" | "table" | "ignored"; markdown: string; language?: string; source?: string };
const fenceStart = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/;
const heading = /^ {0,3}#{1,6}\s+\S/;
const indented = /^(?: {4}|\t)/;
// HTML is never interpreted here. Skip its blocks rather than rediscovering
// image/table syntax in an HTML example which the note renderer would ignore.
const htmlStart = /^ {0,3}<(?:!--|\/?(?:script|style|pre|textarea|div|table|figure|section|article|details|summary|svg|iframe|p)(?:\s|>|\/))/i;
const htmlTag = /<\s*\/?[a-z][a-z0-9-]*(?:\s[^>]*|\s*\/?)>/i;

function tableCells(line: string): string[] | null {
  const cells: string[] = [];
  let cell = "";
  let pipes = 0;
  const value = line.trim();
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "\\" && i + 1 < value.length) { cell += value[i] + value[++i]; continue; }
    if (value[i] === "|") { cells.push(cell.trim()); cell = ""; pipes++; }
    else cell += value[i];
  }
  if (!pipes) return null;
  cells.push(cell.trim());
  if (value.startsWith("|")) cells.shift();
  if (value.endsWith("|") && cells.at(-1) === "") cells.pop();
  return cells;
}

function startsTable(lines: string[], index: number): boolean {
  const header = tableCells(lines[index] ?? "");
  const delimiter = tableCells(lines[index + 1] ?? "");
  return !!header && !!delimiter && header.length === delimiter.length
    && delimiter.length > 0 && delimiter.every(cell => /^:?-+:?$/.test(cell));
}

function markdownBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  for (let i = 0; i < lines.length;) {
    if (!lines[i].trim()) { i++; continue; }
    const start = i;
    const fence = lines[i].match(fenceStart);
    if (fence) {
      const marker = fence[1][0];
      const end = new RegExp(`^ {0,3}${marker}{${fence[1].length},}\\s*$`);
      i++;
      while (i < lines.length && !end.test(lines[i])) i++;
      const closed = i < lines.length;
      const source = lines.slice(start + 1, i).join("\n");
      if (closed) i++;
      blocks.push({ kind: "code", markdown: lines.slice(start, i).join("\n"), language: closed ? fence[2].trim() : "", source });
    } else if (htmlStart.test(lines[i])) {
      // Script/style/pre/textarea and comments can contain blank lines.
      const special = lines[i].match(/^ {0,3}<(script|style|pre|textarea)\b/i)?.[1];
      const close = special ? new RegExp(`</${special}\\s*>`, "i") : lines[i].trimStart().startsWith("<!--") ? /-->/ : null;
      do { i++; } while (i < lines.length && (close ? !close.test(lines[i - 1]) : !!lines[i].trim()));
      blocks.push({ kind: "ignored", markdown: "" });
    } else if (indented.test(lines[i])) {
      do { i++; } while (i < lines.length && (indented.test(lines[i]) || !lines[i].trim()));
      blocks.push({ kind: "ignored", markdown: "" });
    } else if (heading.test(lines[i])) {
      blocks.push({ kind: "heading", markdown: lines[i++] });
    } else if (startsTable(lines, i)) {
      i += 2;
      while (i < lines.length && lines[i].trim() && tableCells(lines[i]) && !fenceStart.test(lines[i]) && !heading.test(lines[i])) i++;
      blocks.push({ kind: "table", markdown: lines.slice(start, i).join("\n") });
    } else {
      i++;
      while (i < lines.length && lines[i].trim() && !fenceStart.test(lines[i]) && !heading.test(lines[i]) && !htmlStart.test(lines[i]) && !indented.test(lines[i]) && !startsTable(lines, i)) i++;
      blocks.push({ kind: "text", markdown: lines.slice(start, i).join("\n") });
    }
  }
  return blocks;
}

// Preserve source offsets while masking inline code. A literal Markdown image
// in a code span is an example, not a figure to offer as learning feedback.
function withoutInlineCode(markdown: string): string {
  return markdown.replace(/(`+)([\s\S]*?)\1(?!`)/g, match => " ".repeat(match.length));
}

function privateImages(markdown: string): string[] {
  const searchable = withoutInlineCode(markdown);
  const pattern = /!\[((?:\\.|[^\]\\])*)\]\(\s*(<\/api\/media\/[0-9a-f-]{36}>|\/api\/media\/[0-9a-f-]{36})(?:[ \t]+(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\)))?[ \t]*\)/gi;
  return [...searchable.matchAll(pattern)].flatMap(match => {
    let slashes = 0;
    for (let i = match.index! - 1; i >= 0 && markdown[i] === "\\"; i--) slashes++;
    const src = match[2].replace(/^<|>$/g, "");
    return slashes % 2 || !isPrivateImage(src) ? [] : [markdown.slice(match.index, match.index! + match[0].length)];
  });
}

function shortExplanation(block: Block | undefined): string {
  return block?.kind === "text" && block.markdown.length <= 450 && !htmlTag.test(block.markdown)
    && !/!\[/.test(block.markdown) ? block.markdown : "";
}

function visualContext(blocks: Block[], index: number, visual: string): string {
  const previous = blocks[index - 1];
  const before = shortExplanation(previous);
  const title = previous?.kind === "heading" ? previous.markdown
    : before && blocks[index - 2]?.kind === "heading" ? blocks[index - 2].markdown : "";
  const after = shortExplanation(blocks[index + 1]);
  return [title.length <= 200 ? title : "", before, visual, after].filter(Boolean).join("\n\n");
}

function visualId(kind: LearningVisual["kind"], markdown: string): string {
  // A deterministic display identity, not an authorization or content hash.
  let hash = 2166136261;
  const value = kind + "\n" + markdown;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return kind + "-" + (hash >>> 0).toString(36);
}

// Discover complete figures, diagrams and comparisons for explicit selection by
// the caller. Early overview figures can differ from later course-specific ones.
// The existing Markdown renderer still applies its URL/HTML rules and validates
// Mermaid again before rendering. Do not truncate tables or diagram definitions:
// cutting them could silently change the explanation.
export function noteLearningVisuals(content: string): LearningVisual[] {
  const blocks = markdownBlocks(content);
  const visuals: LearningVisual[] = [];
  let currentHeading: string | undefined;
  const add = (kind: LearningVisual["kind"], original: string, markdown = original) => {
    const id = visualId(kind, original);
    if (!visuals.some(visual => visual.id === id && visual.kind === kind && visual.markdown === markdown)) {
      visuals.push({ id, kind, markdown, ...(currentHeading ? { heading: currentHeading } : {}) });
    }
  };
  for (let index = 0; index < blocks.length && visuals.length < 32; index++) {
    const block = blocks[index];
    if (block.kind === "heading") currentHeading = block.markdown.replace(/^\s*#{1,6}\s+/, "").replace(/\s+#+\s*$/, "");
    else if (block.kind === "text" && !htmlTag.test(block.markdown)) {
      for (const image of privateImages(block.markdown)) {
        if (visuals.length >= 32) break;
        add("image", image);
      }
    } else if (block.kind === "code" && block.language === "mermaid" && isAllowedDiagram(block.source ?? "")) {
      add("diagram", block.markdown, visualContext(blocks, index, block.markdown));
    } else if (block.kind === "table" && block.markdown.length <= 6000 && block.markdown.split("\n").length <= 22
      && !htmlTag.test(block.markdown) && !/!\[/.test(block.markdown)) {
      add("comparison", block.markdown, visualContext(blocks, index, block.markdown));
    }
  }
  return visuals;
}
