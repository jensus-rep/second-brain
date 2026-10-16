import test from "node:test";
import assert from "node:assert/strict";
import { buildGlossary, findGlossaryTerms, linkGlossaryTerms, noteSection, noteTerms, noteVisuals, parseTerms, preferredVisual, splitNoteTitle } from "../lib/brain/glossary.ts";

const note = (id, title, archived = false) => ({ id, title, archived });
const glossary = buildGlossary([
  note("vision", "Product Vision Board: Strategie auf einer Seite"),
  note("impact", "Impact Mapping: vom Ziel zur wirksamen Funktion"),
  note("design", "Design Thinking: Bedürfnisse verstehen, Ideen öffnen"),
  note("scrum", "Scrum: Verantwortlichkeiten, Ablauf und Ergebnisse"),
  note("mvp", "MVP: die kleinste sinnvolle Produktversion"),
  note("supervised", "Supervised Learning: aus gelabelten Beispielen lernen"),
  note("self", "Self-Supervised Learning: Trainingssignale aus den Daten selbst"),
  note("pm-a", "Projektmanagement: Ziele, Menschen und Planung"),
  note("pm-b", "Projektmanagement: Grundlagen und Schlüsselbegriffe"),
  note("old", "Kanban: Arbeitsfluss sichtbar machen", true),
]);
const linked = (text, skip) => findGlossaryTerms(text, glossary).filter(match => match.noteId !== skip).map(match => [match.text, match.noteId]);

test("concepts come from the part of a note title before the colon", () => {
  assert.deepEqual(splitNoteTitle("Impact Mapping: vom Ziel zur Funktion"), { head: "Impact Mapping", subtitle: "vom Ziel zur Funktion" });
  assert.deepEqual(noteTerms("Product Vision Board: Strategie auf einer Seite"), ["Product Vision Board", "Vision Board"]);
  assert.deepEqual(noteTerms("Impact Mapping: vom Ziel zur wirksamen Funktion"), ["Impact Mapping", "Impact Map"]);
  assert.deepEqual(noteTerms("User Stories prüfen: INVEST"), ["User Stories prüfen", "User Stories"]);
  assert.deepEqual(noteTerms("Velocity und Burndown: Fortschritt lesen"), ["Velocity", "Burndown"]);
  assert.deepEqual(noteTerms("Design Science und Design Research Methodology (DRM)"), ["Design Science", "Design Research Methodology", "DRM"]);
});

test("generic words in listed titles never become links", () => {
  assert.deepEqual(noteTerms("Produkt und Projekt: Produktteams, DevOps und Betrieb"), []);
  assert.deepEqual(noteTerms("Projekte, Produkte und Zusammenarbeit"), []);
  assert.deepEqual(noteTerms("Ausblick: Next.js und Sicherheit"), []);
});

test("ambiguous and archived concepts are left out", () => {
  const terms = glossary.entries.map(entry => entry.term);
  assert.ok(!terms.includes("Projektmanagement"));
  assert.ok(!terms.includes("Kanban"));
  assert.deepEqual(linked("Projektmanagement mit Kanban"), []);
});

test("mentions match inflections, hyphenated compounds and the longest concept", () => {
  assert.deepEqual(linked("Zwei Impact Maps und ein Vision-Board"), [["Impact Maps", "impact"], ["Vision-Board", "vision"]]);
  assert.deepEqual(linked("Der Design-Thinking-Prozess im Scrum-Team"), [["Design-Thinking", "design"], ["Scrum", "scrum"]]);
  assert.deepEqual(linked("Self-Supervised Learning erweitert Supervised Learning"), [["Self-Supervised Learning", "self"], ["Supervised Learning", "supervised"]]);
  assert.deepEqual(linked("Scrumban ist kein Scrum."), [["Scrum", "scrum"]]);
});

test("acronyms only match in their own spelling", () => {
  assert.deepEqual(linked("Ein MVP, zwei MVPs, aber kein mvp"), [["MVP", "mvp"], ["MVPs", "mvp"]]);
});

test("each concept is linked once, outside code and links, and the card's own concept can stay hidden", () => {
  const tree = { type: "root", children: [
    { type: "element", tagName: "p", children: [{ type: "text", value: "Scrum nutzt ein MVP. Scrum wiederholt sich." }] },
    { type: "element", tagName: "code", children: [{ type: "text", value: "Impact Mapping" }] },
    { type: "element", tagName: "a", children: [{ type: "text", value: "Design Thinking" }] },
    { type: "element", tagName: "p", children: [{ type: "text", value: "Impact Mapping" }] },
  ] };
  linkGlossaryTerms(tree, glossary, "mvp");
  const paragraph = tree.children[0].children;
  assert.deepEqual(paragraph.map(node => node.type === "text" ? node.value : `[${node.children[0].value}→${node.properties.dataNoteId}]`),
    ["[Scrum→scrum]", " nutzt ein MVP. Scrum wiederholt sich."]);
  assert.equal(tree.children[1].children[0].type, "text");
  assert.equal(tree.children[2].children[0].type, "text");
  assert.equal(tree.children[3].children[0].tagName, "glossary-term");
});

test("the preview prefers an illustration that names the concept", () => {
  const content = [
    "## Überblick", "```mermaid", "flowchart TD", "  A --> B", "```",
    "![Gesamtbild](/api/media/00000000-0000-4000-8000-000000000001 \"Alle Felder\")",
    "## Die Impact Map lesen", "![Wirkungskette](/api/media/00000000-0000-4000-8000-000000000002)",
    "```js", "![nicht im Code](/api/media/00000000-0000-4000-8000-000000000003)", "```",
  ].join("\n");
  const visuals = noteVisuals(content);
  assert.deepEqual(visuals.map(visual => [visual.kind, visual.heading]), [["diagram", "Überblick"], ["image", "Überblick"], ["image", "Die Impact Map lesen"]]);
  assert.equal(visuals[1].caption, "Alle Felder");
  assert.equal(preferredVisual(visuals, "Impact Map"), 2);
  assert.equal(preferredVisual(visuals, "Scrum"), 1);
  assert.equal(preferredVisual([], "Scrum"), -1);
});

test("tables count as illustrations because they are drawn as comparison graphics", () => {
  const visuals = noteVisuals(["### Standardfelder", "", "| Feld | Leitfrage |", "|---|---|", "| Vision | Wohin? |", "| Zielgruppe | Für wen? |", "", "Ein Satz | mit Strich", "```mermaid", "flowchart TD", "  A --> B", "```"].join("\n"));
  assert.deepEqual(visuals.map(visual => visual.kind), ["table", "diagram"]);
  assert.equal(visuals[0].markdown, "| Feld | Leitfrage |\n|---|---|\n| Vision | Wohin? |\n| Zielgruppe | Für wen? |");
  assert.equal(preferredVisual(visuals, "Vision Board"), 0);
});

test("terms chosen for a note extend its title and resolve ambiguous titles", () => {
  const chosen = buildGlossary([
    { id: "goals", title: "Führen mit Zielen: MbO, SMART und OKR", archived: false, terms: ["OKR", "Objectives and Key Results", "SMART"] },
    { id: "pm-a", title: "Projektmanagement: Ziele, Menschen und Planung", archived: false },
    { id: "pm-b", title: "Projektmanagement: Grundlagen und Schlüsselbegriffe", archived: false, terms: ["Projektmanagement"] },
    { id: "a", title: "Erste Notiz", archived: false, terms: ["Doppelt"] },
    { id: "b", title: "Zweite Notiz", archived: false, terms: ["doppelt"] },
  ]);
  const found = text => findGlossaryTerms(text, chosen).map(match => [match.text, match.term, match.noteId]);
  assert.deepEqual(found("OKRs ergänzen Projektmanagement"), [["OKRs", "OKR", "goals"], ["Projektmanagement", "Projektmanagement", "pm-b"]]);
  assert.deepEqual(found("Ziele smart formulieren, SMART prüfen"), [["SMART", "SMART", "goals"]]);
  assert.deepEqual(found("Objectives-and-Key-Results und Doppelt"), [["Objectives-and-Key-Results", "Objectives and Key Results", "goals"]]);
  assert.deepEqual(parseTerms(" OKR,  Objectives and Key Results;okr, X, SMART "), ["OKR", "Objectives and Key Results", "SMART"]);
});

test("a term explained in its own section previews that section", () => {
  const content = [
    "## Verstehen", "### Management by Objectives", "Ziele werden gemeinsam vereinbart.",
    "### Objectives and Key Results", "", "Ein **Objective** beschreibt die Richtung.", "Key Results machen den Fortschritt messbar.",
    "", "| A | B |", "|---|---|", "| 1 | 2 |", "", "Zweiter Absatz.", "### Daily Scrum", "```mermaid", "flowchart TD", "  A --> B", "```", "Täglich 15 Minuten.",
  ].join("\n");
  assert.deepEqual(noteSection(content, "OKR"), { heading: "Objectives and Key Results", text: "Ein **Objective** beschreibt die Richtung.\nKey Results machen den Fortschritt messbar.\n\nZweiter Absatz." });
  assert.equal(noteSection(content, "MbO").heading, "Management by Objectives");
  assert.deepEqual(noteSection(content, "Daily"), { heading: "Daily Scrum", text: "Täglich 15 Minuten." });
  assert.equal(noteSection(content, "Kanban"), null);
  const tableOnly = ["### SMART", "Diese fünf Prüffragen:", "", "| A | B |", "|---|---|", "| 1 | 2 |", "", "*Quelle: Aufzeichnung 4.*", "### Weiter", "Text"].join("\n");
  assert.deepEqual(noteSection(tableOnly, "SMART"), { heading: "SMART", text: "" });
  const long = noteSection("### Swarming\n" + "Ein **langer** Satz über gemeinsames Arbeiten. ".repeat(20), "Swarming").text;
  assert.ok(long.length <= 480 && long.endsWith("."));
  const visuals = noteVisuals(content);
  assert.equal(preferredVisual(visuals, "OKR", "Objectives and Key Results"), 0);
  assert.equal(visuals[0].heading, "Objectives and Key Results");
});

test("different terms of one note each stay links", () => {
  const scrum = buildGlossary([{ id: "scrum", title: "Scrum: Verantwortlichkeiten, Ablauf und Ergebnisse", archived: false, terms: ["Product Owner"] }]);
  const tree = { type: "root", children: [{ type: "element", tagName: "p", children: [{ type: "text", value: "Im Scrum entscheidet der Product Owner, Scrum bleibt." }] }] };
  linkGlossaryTerms(tree, scrum);
  assert.deepEqual(tree.children[0].children.filter(node => node.type === "element").map(node => [node.children[0].value, node.properties.dataTerm]), [["Scrum", "Scrum"], ["Product Owner", "Product Owner"]]);
});

test("short forms of one title concept are linked once", () => {
  const story = buildGlossary([{ id: "story", title: "User Story Mapping: den Nutzerweg strukturieren", archived: false }, { id: "sprint", title: "Sprint Backlog, Daily und Swarming", archived: false }]);
  const tree = { type: "root", children: [{ type: "element", tagName: "p", children: [{ type: "text", value: "Story Mapping, Story Map: Was ist was? Daily oder Swarming?" }] }] };
  linkGlossaryTerms(tree, story);
  assert.deepEqual(tree.children[0].children.filter(node => node.type === "element").map(node => node.children[0].value), ["Story Mapping", "Daily", "Swarming"]);
});
