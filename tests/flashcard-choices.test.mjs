import test from "node:test";
import assert from "node:assert/strict";
import { parseFlashcardChoices } from "../lib/brain/flashcard-choices.ts";

const question = "Welche Aussagen stimmen?\n\n- **A:** Ein **eigenes Beispiel** hilft.\n- **B:** Nur wiederlesen reicht immer.\n- **C:** Eine Erklärung in eigenen Worten prüft das Verständnis.\n- **D:** Mit `aktiver Wiederholung` wird Wissen abgerufen.";

test("parses existing multiple-answer cards and preserves inline Markdown", () => {
  assert.deepEqual(parseFlashcardChoices(question, "**Richtig: A, C und D.**\n\nB ist falsch."), {
    prompt: "Welche Aussagen stimmen?\n\n",
    choices: [
      { id: "A", content: "Ein **eigenes Beispiel** hilft." },
      { id: "B", content: "Nur wiederlesen reicht immer." },
      { id: "C", content: "Eine Erklärung in eigenen Worten prüft das Verständnis." },
      { id: "D", content: "Mit `aktiver Wiederholung` wird Wissen abgerufen." },
    ],
    suffix: "",
    correctIds: ["A", "C", "D"],
  });
});

test("accepts explicit common letter formats and two or more choices", () => {
  for (const label of [id => `${id})`, id => `${id}.`, id => `${id}:`, id => `(${id})`, id => `**${id})**`, id => `**${id}:**`, id => `**${id}**:`, id => `**(${id})**`]) {
    for (const bullet of ["", "- ", "* ", "+ "]) {
      const parsed = parseFlashcardChoices(`${bullet}${label("A")} Alpha\n${bullet}${label("B")} Beta`, "Richtige Antwort: B");
      assert.deepEqual(parsed?.choices, [{ id: "A", content: "Alpha" }, { id: "B", content: "Beta" }]);
      assert.deepEqual(parsed.correctIds, ["B"]);
    }
  }
});

test("preserves prompt and suffix bytes, CRLF, inline wrapping and hard breaks", () => {
  const prompt = "## Frage\r\n\r\nEin [Beleg](https://example.test).\r\n\r\n";
  const suffix = "\r\n\r\n**Hinweis:** Wähle alle passenden Antworten.\r\n";
  const parsed = parseFlashcardChoices(prompt + "- **A:** Eine **lange** Zeile  \r\n  mit `Umbruch`.\r\n\r\n- **B:** Eine zweite Zeile." + suffix, "Lösung: A");
  assert.equal(parsed.prompt, prompt);
  assert.equal(parsed.suffix, suffix);
  assert.equal(parsed.choices[0].content, "Eine **lange** Zeile  \r\nmit `Umbruch`.");
  assert.deepEqual(parsed.correctIds, ["A"]);
});

test("does not convert conceptual lists, nested blocks, fenced examples or malformed choices", () => {
  for (const input of [
    "1. Erster Schritt\n2. Zweiter Schritt",
    "- Erster Gedanke\n- Zweiter Gedanke",
    "**A:** Nur eine Auswahl",
    "A) Eins\nC) Drei",
    "B) Zwei\nC) Drei",
    "A) Eins\nB) Zwei\nA) Wiederholung",
    "A) Eins\nB) Zwei\nC) ",
    "A) Eins\nB) Zwei\nC - Unvollständig",
    "A) Eins\nB) Zwei\nc) Unvollständig",
    "A) Eins\nZwischentext\nB) Zwei",
    "- **A:** Eins\nB) Zwei",
    "- **A:** Eins\n  - Unterpunkt\n- **B:** Zwei",
    "- **A:** Eins\n  1. Unterpunkt\n- **B:** Zwei",
    "A) Eins\n  > Zitat\nB) Zwei",
    "A) Eins\n  | Tabelle |\nB) Zwei",
    "A) Eins\n\n  Zweiter Absatz\nB) Zwei",
    "- Oberpunkt\n  A) Eins\n  B) Zwei",
    "```markdown\nA) Eins\nB) Zwei\n```",
    "~~~\n- **A:** Eins\n- **B:** Zwei\n~~~",
    "    A) Code\n    B) Code",
    "A) Eins\nB) Zwei\n    C) Verschachtelt",
    "A) Ein ![Diagramm](/diagram.png)\nB) Zweite Auswahl",
    "A) Ein <img src='/diagram.png' alt='Diagramm'>\nB) Zweite Auswahl",
    "A) Erste Zeile\n  mit ![Diagramm][quelle]\nB) Zweite Auswahl",
  ]) assert.equal(parseFlashcardChoices(input, "Richtig: A"), null, input);
});

test("bounds the option list and rejects labels outside its contiguous sequence", () => {
  const make = count => Array.from({ length: count }, (_, index) => `${String.fromCharCode(65 + index)}) Auswahl ${index + 1}`).join("\n");
  assert.equal(parseFlashcardChoices(make(12), "Richtig: L").choices.length, 12);
  assert.deepEqual(parseFlashcardChoices(make(12), "Richtig: L").correctIds, ["L"]);
  assert.equal(parseFlashcardChoices(make(13), "Richtig: A"), null);
  assert.equal(parseFlashcardChoices("A) Eins\nB) Zwei\nAA) Mehrdeutig", "Richtig: A"), null);
});

test("reads explicit answer headers and the existing initial bold answer key", () => {
  for (const [answer, expected] of [
    ["Richtige Antwort: B", ["B"]],
    ["Richtige Antworten: D, A und C.", ["A", "C", "D"]],
    ["Lösung: A und C", ["A", "C"]],
    ["## Lösung: A und C", ["A", "C"]],
    ["**Richtig:** A, C und D.", ["A", "C", "D"]],
    ["Richtig: **A und C**", ["A", "C"]],
    ["**B und C.** A ist falsch, weil die Zuordnung nicht passt.", ["B", "C"]],
    ["\n\n**B, C und D.** A ist falsch.", ["B", "C", "D"]],
    ["**A.**", ["A"]],
    ["**B**", ["B"]],
    ["Richtig: A und C\n\nLösung: C, A", ["A", "C"]],
    ["```\nRichtig: B\n```\n\nLösung: A", ["A"]],
  ]) assert.deepEqual(parseFlashcardChoices(question, answer).correctIds, expected, answer);
});

test("keeps choices usable without guessing unknown or ambiguous answer keys", () => {
  for (const answer of [
    "Eine Erklärung, in der A und C vorkommen.",
    "A und C sind richtig.",
    "Die richtige Antwort: B",
    "Nicht richtig: A",
    "**A** steht für den ersten Begriff.",
    "**A.** ist falsch, B ist richtig.",
    "**A.** Eine Erklärung.",
    "**A und C.** sind falsch, B ist richtig.",
    "Erklärung:\n\n**A und C.** Weitere Aussage.",
    "Richtig: A oder C",
    "Richtig: A-C",
    "Richtig: A C",
    "Richtig: Alpha",
    "Richtig: A und C vermutlich",
    "Richtig: A und C. Weitere Erklärung.",
    "Richtig: A, Z",
    "Richtig: A und A",
    "**A und Z.** Erklärung.",
    "Richtig: A\n\nLösung: B",
    "**B und C.** Erklärung.\n\nRichtig: A",
    "Richtig: A\n\nLösung: unbekannt",
    "```\nRichtig: A\n```",
    "    Richtig: A",
    "    **Richtig: A.**",
    "",
  ]) {
    const parsed = parseFlashcardChoices(question, answer);
    assert.equal(parsed.choices.length, 4);
    assert.equal(parsed.correctIds, null, answer);
  }
});
