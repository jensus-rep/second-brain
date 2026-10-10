import test from "node:test";
import assert from "node:assert/strict";
import { noteLearningVisuals, quizLearningNotes } from "../lib/brain/quiz-learning.ts";

const src = "/api/media/12345678-1234-1234-1234-123456789abc";
const image = `![Qualität und Umfang](${src} "Fertig heißt: vereinbarte Qualität erfüllt.")`;
const question = { id: "quality-1", concept: "Qualität" };
const excerpts = content => noteLearningVisuals(content).map(({ kind, markdown }) => ({ kind, markdown }));

test("quiz learning resolves only explicit existing note IDs in their chosen order", () => {
  const notes = [
    { id: "unrelated", title: "Qualität", content: image },
    { id: "definition", title: "Umbenannte Notiz", archived: true },
    { id: "acceptance", title: "Akzeptanzkriterien" },
  ];
  assert.deepEqual(quizLearningNotes(question, notes), []);
  assert.deepEqual(quizLearningNotes({ ...question, noteIds: ["acceptance", "missing", "definition", "acceptance"] }, notes), [notes[2], notes[1]]);
  assert.deepEqual(notes.map(note => note.id), ["unrelated", "definition", "acceptance"]);
});

test("learning figures preserve private image source, alt text and caption", () => {
  const escaped = `![Anforderung \\[A\\]](<${src}> 'Qualität (Beispiel)')`;
  assert.deepEqual(excerpts(`## Bildlich erklärt\n\n${image}\n\n${escaped}`), [
    { kind: "image", markdown: image },
    { kind: "image", markdown: escaped },
  ]);
});

test("external, local, querystring and HTML images never become learning figures", () => {
  const invalid = [
    "![Extern](https://example.org/image.png)",
    "![Lokal](file:///C:/image.png)",
    "![Inline](data:image/png;base64,abc)",
    `![Query](${src}?private=true)`,
    `<img src="${src}" alt="HTML">`,
  ].join("\n\n");
  assert.deepEqual(noteLearningVisuals(invalid), []);
});

test("visual syntax inside fences, inline code, indented code and HTML examples is ignored", () => {
  const examples = [
    `\`\`\`markdown\n${image}\n\`\`\``,
    `\`\`\`markdown\n| Rolle | Aufgabe |\n| --- | --- |\n| PO | Wert |\n\`\`\``,
    `\`${image}\``,
    `    ${image}`,
    `<!--\n\n${image}\n\n-->`,
    `<script>\n\n${image}\n\n</script>`,
    `<div>\n${image}\n</div>`,
    `\\${image}`,
  ];
  for (const content of examples) assert.deepEqual(noteLearningVisuals(content), [], content);
});

test("allowed Mermaid blocks retain their adjacent explanation and section heading", () => {
  const diagram = "```mermaid\nflowchart TD\n  A[Planen] --> B[Prüfen]\n```";
  const explanation = "Die Schleife verbindet Planung und Prüfung; die Richtung zeigt den nächsten Schritt.";
  const content = `Ein langer Artikel.\n\n## Steuerung\n\n${diagram}\n\n${explanation}\n\n## Quellen\n\nQuelle: Handbuch.`;
  assert.deepEqual(excerpts(content), [{ kind: "diagram", markdown: `## Steuerung\n\n${diagram}\n\n${explanation}` }]);
  assert.equal(noteLearningVisuals(content)[0].markdown.includes("Handbuch"), false);
});

test("unsupported or unsafe Mermaid is skipped while later safe visuals remain available", () => {
  const rejected = [
    "pie\n  title Kosten\n  A : 10",
    'flowchart TD\nA@{img: "https://example.org/image"}',
    "flowchart TD\nA[<b>HTML</b>] --> B",
    '%%{init: {"securityLevel":"loose"}}%%\nflowchart TD\nA-->B',
    "flowchart TD\n" + "A".repeat(12000),
  ].map(source => `\`\`\`mermaid\n${source}\n\`\`\``).join("\n\n");
  assert.deepEqual(excerpts(`${rejected}\n\n${image}`), [{ kind: "image", markdown: image }]);
  assert.deepEqual(noteLearningVisuals("```mermaid\nflowchart TD\nA-->B"), []);
});

test("comparison tables keep complete cells, headings and short explanatory captions", () => {
  const table = "| Begriff | Aussage |\n| :--- | ---: |\n| **DoD** | Qualität \\| Mindeststandard |\n| Abschluss | Abnahme und Übergabe |";
  const before = "Dieser Vergleich trennt die unterschiedlichen Bezugsebenen.";
  const after = "Eine erfüllte DoD ersetzt die Übergabe des Projekts nicht.";
  const content = `## Fertig und abgeschlossen\n\n${before}\n\n${table}\n\n${after}\n\nWeitere lange Quellen und Details.\n\n${"Lang ".repeat(1000)}`;
  assert.deepEqual(excerpts(content), [{ kind: "comparison", markdown: `## Fertig und abgeschlossen\n\n${before}\n\n${table}\n\n${after}` }]);
  assert.deepEqual(excerpts("Name | Aufgabe\n--- | ---\nPO | Produktwert"), [
    { kind: "comparison", markdown: "Name | Aufgabe\n--- | ---\nPO | Produktwert" },
  ]);
});

test("table extraction does not invent a comparison from ordinary pipes or incomplete delimiters", () => {
  const invalid = ["A | B", "A | B\n---", "A | B\n--- | --- | ---", `| Bild |\n| --- |\n| ![Extern](https://example.org/x.png) |`];
  for (const content of invalid) assert.deepEqual(noteLearningVisuals(content), []);
});

test("visual excerpts stay bounded without cutting definitions or long articles", () => {
  const long = "Eine lange Erklärung. ".repeat(100);
  const diagram = "~~~mermaid\nmindmap\n  root((Wissen))\n    Verstehen\n~~~";
  const content = `${long}\n\n${diagram}\n\n${long}\n\n${image}`;
  const visuals = noteLearningVisuals(content);
  assert.equal(visuals.length, 2);
  assert.deepEqual(visuals.map(visual => visual.kind), ["diagram", "image"]);
  assert.equal(visuals[0].markdown, diagram);
  const largeTable = "| A | B |\n| --- | --- |\n" + Array.from({ length: 30 }, () => "| L | R |").join("\n");
  assert.deepEqual(excerpts(`${largeTable}\n\n${image}`), [{ kind: "image", markdown: image }]);
  const manyFigures = Array.from({ length: 40 }, (_, index) => `![Aussage ${index}](${src} "Beispiel ${index}")`).join("\n\n");
  assert.equal(noteLearningVisuals(manyFigures).length, 32);
});

test("later course-specific comparisons remain selectable beyond the first three visuals", () => {
  const figures = Array.from({ length: 4 }, (_, index) => `![Überblick ${index + 1}](${src} "Aussage ${index + 1}")`).join("\n\n");
  const courseTable = "| Phase | Zweck |\n| --- | --- |\n| Abschluss | Übergabe |";
  const content = `${figures}\n\n### Vier Phasen laut Unterlagen\n\n${courseTable}`;
  const visuals = noteLearningVisuals(content);
  assert.equal(visuals.length, 5);
  assert.equal(visuals[4].kind, "comparison");
  assert.equal(visuals[4].heading, "Vier Phasen laut Unterlagen");
  assert.equal(visuals[4].markdown.includes(courseTable), true);
});

test("visual identity stays stable when surrounding explanation changes", () => {
  const diagram = "```mermaid\nflowchart TD\nA --> B\n```";
  const original = noteLearningVisuals(`## Ablauf\n\n${diagram}\n\nEine erste Erläuterung.`)[0];
  const changed = noteLearningVisuals(`## Neuer Abschnitt\n\n${diagram}\n\nEine präzisere Erläuterung.`)[0];
  const other = noteLearningVisuals("```mermaid\nflowchart TD\nA --> C\n```")[0];
  assert.match(original.id, /^diagram-[a-z0-9]+$/);
  assert.equal(original.id, changed.id);
  assert.notEqual(original.id, other.id);
  assert.notEqual(original.markdown, changed.markdown);
  assert.equal(original.heading, "Ablauf");
  assert.equal(changed.heading, "Neuer Abschnitt");
});
