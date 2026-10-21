export type FlashcardChoice = { id: string; content: string };

export type FlashcardChoices = {
  prompt: string;
  choices: FlashcardChoice[];
  suffix: string;
  correctIds: string[] | null;
};

type Line = { text: string; start: number; end: number };
type ChoiceLine = { index: number; indent: number; bullet: string; id: string; content: string };

function linesOf(source: string): Line[] {
  return Array.from(source.matchAll(/([^\r\n]*)(?:\r\n|\n|\r|$)/g))
    .filter(match => match[0].length > 0)
    .map(match => ({ text: match[1], start: match.index, end: match.index + match[1].length }));
}

function choiceLine(text: string, index: number): ChoiceLine | null {
  const match = /^( {0,3})(?:([-+*]) +)?(?:\*\*([A-Z])[:.)]\*\*|\*\*([A-Z])\*\*[:.)]|\*\*\(([A-Z])\)\*\*|\(([A-Z])\)|([A-Z])[:.)])[ \t]+(\S.*)$/.exec(text);
  if (!match) return null;
  return { index, indent: match[1].length, bullet: match[2] ?? "", id: match[3] ?? match[4] ?? match[5] ?? match[6] ?? match[7], content: match[8] };
}

// A nested block cannot safely become the inline content of a choice button.
const blockStart = /^(?:[-+*]\s|\d+[.)]\s|#{1,6}\s|>|`{3,}|~{3,}|\||(?:[-*_]\s*){3,}$|<\/?[a-z][\s>]|\(?[A-Z][.):]\s)/i;
const malformedChoice = /^ {0,3}(?:[-+*] +)?(?:\*\*|__)?(?:(?:\([A-Z]+\)|[A-Z]+)(?:[.):* \t]|$)|\(?[a-z][.):](?:\*\*)?[ \t])/;
const explicitHeader = /^(?:Richtig|Richtige Antwort(?:en)?|Lösung)[ \t]*:[ \t]*(.*)$/i;

function letterKey(text: string, choices: FlashcardChoice[]): string[] | null {
  const key = text.trim();
  // Check the complete key before extracting letters; prose never becomes a key.
  if (!/^[A-Z](?:(?:\s*,\s*(?:und\s+)?|\s+und\s+|\s*&\s*|\s*;\s*)[A-Z])*\.?$/.test(key)) return null;
  const labels = key.match(/[A-Z]/g)!;
  if (new Set(labels).size !== labels.length || labels.some(label => !choices.some(choice => choice.id === label))) return null;
  return choices.filter(choice => labels.includes(choice.id)).map(choice => choice.id);
}

function correctKey(answer: string, choices: FlashcardChoice[]): string[] | null {
  let result: string[] | null = null;
  let firstContent = true;
  let fence: string | null = null;
  for (const line of linesOf(answer)) {
    const text = line.text.trim();
    if (!text) continue;
    if (/^(?: {4}|\t)/.test(line.text)) { firstContent = false; continue; }
    const fenceMarker = /^(\x60{3,}|~{3,})/.exec(text)?.[1];
    if (fenceMarker) {
      if (!fence) fence = fenceMarker;
      else if (fenceMarker[0] === fence[0] && fenceMarker.length >= fence.length) fence = null;
      firstContent = false;
      continue;
    }
    if (fence) continue;

    const heading = text.replace(/^#{1,6}[ \t]+/, "");
    const bold = /^\*\*([^*]+)\*\*(.*)$/.exec(heading);
    let candidate: string | undefined;
    if (bold) {
      const header = explicitHeader.exec(bold[1]);
      if (header) candidate = header[1].trim() ? header[1] : bold[2].trim();
      else if (firstContent) {
        const tail = bold[2].trim();
        const bareKey = letterKey(bold[1], choices);
        if (!tail || bareKey && bareKey.length > 1 && bold[1].endsWith(".") && !/^(?:ist|sind|sei|seien|wäre|wären|falsch|richtig|nicht)\b/i.test(tail)) candidate = bold[1];
      }
    } else {
      candidate = explicitHeader.exec(heading)?.[1];
    }
    firstContent = false;
    if (candidate === undefined) continue;
    const unwrapped = /^\*\*([^*]+)\*\*$/.exec(candidate.trim())?.[1] ?? candidate;
    const key = letterKey(unwrapped, choices);
    if (!key || result && result.join(",") !== key.join(",")) return null;
    result = key;
  }
  return result;
}

/**
 * Recognize one simple, contiguous A–L choice list. Uncertain Markdown keeps its
 * normal rendering, and an unknown answer key never produces automatic grading.
 */
export function parseFlashcardChoices(question: string, answer: string): FlashcardChoices | null {
  const lines = linesOf(question);
  // Fenced examples can contain convincing option labels; keep them as Markdown.
  if (lines.some(line => /^\s*(?:`{3,}|~{3,})/.test(line.text))) return null;
  const markers = lines.map((line, index) => choiceLine(line.text, index)).filter((line): line is ChoiceLine => line !== null);
  if (markers.length < 2 || markers.length > 12) return null;
  const first = markers[0];
  if (markers.some((marker, index) => marker.id !== String.fromCharCode(65 + index) || marker.indent !== first.indent || marker.bullet !== first.bullet)) return null;

  const previous = lines.slice(0, first.index).findLast(line => line.text.trim());
  if (first.indent && previous && /^ {0,3}(?:[-+*]|\d+[.)])[ \t]+/.test(previous.text)) return null;

  const choices: FlashcardChoice[] = [];
  let finalEnd = lines[first.index].end;
  for (let index = 0; index < markers.length; index++) {
    const marker = markers[index];
    if (blockStart.test(marker.content)) return null;
    const next = markers[index + 1]?.index ?? lines.length;
    let content = marker.content;
    let previousLine = lines[marker.index];
    let blank = false;
    for (let cursor = marker.index + 1; cursor < next; cursor++) {
      const line = lines[cursor];
      if (!line.text.trim()) { blank = true; continue; }
      const indent = /^ */.exec(line.text)![0].length;
      if (indent >= marker.indent + 2) {
        const continuation = line.text.slice(indent);
        if (blank || blockStart.test(continuation) || /^\t/.test(continuation)) return null;
        content += question.slice(previousLine.end, line.start) + continuation;
        previousLine = line;
        continue;
      }
      if (index < markers.length - 1 || malformedChoice.test(line.text) || /^\t/.test(line.text)) return null;
      break;
    }
    if (/!\[|<img\b/i.test(content)) return null;
    choices.push({ id: marker.id, content });
    finalEnd = previousLine.end;
  }
  return {
    prompt: question.slice(0, lines[first.index].start),
    choices,
    suffix: question.slice(finalEnd),
    correctIds: correctKey(answer, choices),
  };
}
