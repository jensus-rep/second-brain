import type { TreeNode } from "./glossary.ts";

// A small, local starter vocabulary. An explicit Markdown translation can add
// any word or phrase without sending reading content to an external service.
const INDONESIAN: Record<string, string> = {
  "terima kasih": "danke",
  "bahasa indonesia": "Indonesisch",
  nama: "Name",
  saya: "ich / mein",
  belajar: "lernen",
  mengerti: "verstehen",
  baru: "gerade erst / neu",
  mulai: "anfangen",
  bahasa: "Sprache",
  belum: "noch nicht",
  bisa: "können",
  diulangi: "wiederholt werden",
  tolong: "bitte / helfen",
  apa: "was",
  arti: "Bedeutung",
  kata: "Wort",
  ini: "dies / dieses",
};

export const TRANSLATION_TAG = "translation-term";
export const TRANSLATION_LINK = "#translation";
const SKIP_TAGS = new Set(["a", "button", "code", "pre", "svg", "script", "style", "glossary-term", TRANSLATION_TAG]);
const vocabulary = Object.keys(INDONESIAN).sort((a, b) => b.length - a.length).map(term => term.replace(/ /g, "\\s+"));
const pattern = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])(${vocabulary.join("|")})(?![\\p{L}\\p{M}\\p{N}_])`, "giu");
const indonesianContext = /(?<![\p{L}\p{N}_])(?:indonesisch\w*|indonesian|bahasa\s+indonesia|saya|belajar|mengerti|terima\s+kasih)(?![\p{L}\p{N}_])/iu;

function readableText(node: TreeNode): string {
  if (node.type === "element" && SKIP_TAGS.has(node.tagName ?? "")) return "";
  return node.type === "text" ? node.value ?? "" : (node.children ?? []).map(readableText).join(" ");
}

/** Adds lookups only in recognizably Indonesian prose, preserving links and code. */
export function annotateTranslations(tree: TreeNode) {
  if (!indonesianContext.test(readableText(tree))) return;
  const visit = (node: TreeNode) => {
    if (!node.children || node.type === "element" && SKIP_TAGS.has(node.tagName ?? "")) return;
    node.children = node.children.flatMap(child => {
      if (child.type !== "text" || !child.value) { visit(child); return [child]; }
      const parts: TreeNode[] = [];
      let cursor = 0;
      for (const match of child.value.matchAll(pattern)) {
        if (match.index > cursor) parts.push({ type: "text", value: child.value.slice(cursor, match.index) });
        parts.push({ type: "element", tagName: TRANSLATION_TAG,
          properties: { dataTranslation: INDONESIAN[match[0].toLocaleLowerCase("id").replace(/\s+/g, " ")], lang: "id" },
          children: [{ type: "text", value: match[0] }] });
        cursor = match.index + match[0].length;
      }
      if (!parts.length) return [child];
      if (cursor < child.value.length) parts.push({ type: "text", value: child.value.slice(cursor) });
      return parts;
    });
  };
  visit(tree);
}

export function rehypeTranslations() {
  return (tree: unknown) => annotateTranslations(tree as TreeNode);
}
