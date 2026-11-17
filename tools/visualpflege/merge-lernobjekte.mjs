// Merge reworded flashcards and quiz questions (e.g. neutralised course references) into a fresh pull.
// node --experimental-strip-types tools/visualpflege/merge-lernobjekte.mjs <basis.json> <nachher.json> <entwurf.json>...
// Entwurf: [{ id, status: "neutralisiert" | "unverändert" | "kursspezifisch", question?, answer? } | { id, status, prompt?, concept?, options?: [{ id, text, feedback }], explanation? }]
// Only wording changes: ids, option order, correct answers, links and scheduling stay; media, mermaid and recording references must be identical.
// Learning evidence survives: tutor review fingerprints are remapped and curated priorities are pinned on the card.
import { readFile, writeFile } from "node:fs/promises";
import { flashcardSchema, quizQuestionSchema } from "../../lib/brain/model.ts";
import { tutorCardContentFingerprint } from "../../lib/brain/learning-tutor.ts";
import { flashcardPriority } from "../../lib/brain/learning-collections.ts";
import { validateSnapshot } from "../lernpaket/skripte/snapshot.mjs";

const [baseFile, outFile, ...draftFiles] = process.argv.slice(2);
if (!baseFile || !outFile || !draftFiles.length) throw new Error("Aufruf: merge-lernobjekte.mjs <basis.json> <nachher.json> <entwurf.json>...");
const base = JSON.parse(await readFile(baseFile, "utf8"));
const w = base.workspace;
const protectedParts = text => JSON.stringify([
  [...text.matchAll(/```mermaid\n[\s\S]*?```/g)].map(m => m[0]),
  [...text.matchAll(/\/api\/media\/[0-9a-f-]{36}/gi)].map(m => m[0]),
  // A recording reference: number, optional „title“, then the timestamp – never prose in between.
  [...text.matchAll(/Aufzeichnung(?:en)? \d+(?: „[^“\n]*“)? \[\d\d:\d\d\]/g)].map(m => m[0]),
]);
const courseWords = /\b(laut Kurs|der Kurs|im Kurs|des Kurses|Kursfassung|Klausur|Dozent)/i;
const cards = new Map(w.cards.map(c => [c.id, { ...c }]));
const questions = new Map(w.quizQuestions.map(q => [q.id, q]));
const errors = [], log = [], review = [], remaining = [];
const fingerprints = new Map();
let changedCards = 0, changedQuestions = 0;

for (const file of draftFiles) for (const entry of JSON.parse(await readFile(file, "utf8"))) {
  if (entry.status === "kursspezifisch") { review.push(`${entry.id}: ${entry.note ?? ""}`); continue; }
  if (entry.status !== "neutralisiert") continue;
  if (cards.has(entry.id)) {
    const card = cards.get(entry.id);
    const next = { ...card, question: entry.question ?? card.question, answer: entry.answer ?? card.answer };
    if (next.question === card.question && next.answer === card.answer) continue;
    if (protectedParts(card.question + card.answer) !== protectedParts(next.question + next.answer)) { errors.push(`Karte ${card.id}: Bilder, Diagramme oder Quellenangaben verändert`); continue; }
    const parsed = flashcardSchema.safeParse(next);
    if (!parsed.success) { errors.push(`Karte ${card.id}: ${parsed.error.issues[0].message}`); continue; }
    const priority = flashcardPriority(card);
    if (card.priority === undefined && priority !== null) next.priority = priority;
    fingerprints.set(card.id, [tutorCardContentFingerprint(card), tutorCardContentFingerprint(next)]);
    cards.set(card.id, next);
    changedCards++;
    log.push(`## Karte ${card.id}\n- F: ${card.question}\n+ F: ${next.question}\n- A: ${card.answer}\n+ A: ${next.answer}`);
    if (courseWords.test(next.question + next.answer)) remaining.push(card.id);
  } else if (questions.has(entry.id)) {
    const q = questions.get(entry.id);
    const options = entry.options ?? q.options;
    if (options.length !== q.options.length || options.some((o, i) => o.id !== q.options[i].id)) { errors.push(`Frage ${q.id}: Antwortoptionen in Anzahl oder Reihenfolge verändert`); continue; }
    const next = { ...q, prompt: entry.prompt ?? q.prompt, concept: entry.concept ?? q.concept, explanation: entry.explanation ?? q.explanation,
      options: q.options.map((o, i) => ({ ...o, text: options[i].text ?? o.text, feedback: options[i].feedback ?? o.feedback })) };
    const text = x => [x.prompt, x.explanation, ...x.options.flatMap(o => [o.text, o.feedback])].join("\n");
    if (text(next) === text(q) && next.concept === q.concept) continue;
    if (protectedParts(text(q)) !== protectedParts(text(next))) { errors.push(`Frage ${q.id}: Bilder, Diagramme oder Quellenangaben verändert`); continue; }
    const parsed = quizQuestionSchema.safeParse(next);
    if (!parsed.success) { errors.push(`Frage ${q.id}: ${parsed.error.issues[0].message}`); continue; }
    questions.set(q.id, next);
    changedQuestions++;
    log.push(`## Frage ${q.id}\n- ${q.prompt}\n+ ${next.prompt}\n- Erklärung: ${q.explanation}\n+ Erklärung: ${next.explanation}`);
    if (courseWords.test(text(next))) remaining.push(q.id);
  } else errors.push(`${file}: ${entry.id} fehlt im Basisstand`);
}
if (errors.length) { console.error("NICHT zusammengeführt:\n- " + errors.join("\n- ")); process.exit(1); }

let remapped = 0;
const cardReviewEvents = w.cardReviewEvents?.map(event => {
  const pair = fingerprints.get(event.cardId);
  if (!pair || event.contentFingerprint !== pair[0]) return event;
  remapped++;
  return { ...event, contentFingerprint: pair[1] };
});
const result = { ...base, workspace: { ...w, cards: w.cards.map(c => cards.get(c.id)), quizQuestions: w.quizQuestions.map(q => questions.get(q.id)),
  ...(cardReviewEvents ? { cardReviewEvents } : {}) } };
validateSnapshot(result);
await writeFile(outFile, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
await writeFile(outFile.replace(/\.json$/, "") + "-aenderungen.md", log.join("\n\n") + "\n", { flag: "wx" });
console.log(`${changedCards} Karten, ${changedQuestions} Fragen zusammengeführt (Revision ${base.revision}), ${remapped} Lernnachweise mitgeführt → ${outFile}`);
if (review.length) console.log(`Zur Prüfung (kursspezifisch, nicht geändert):\n- ${review.join("\n- ")}`);
if (remaining.length) console.log(`Noch Kursformulierungen in: ${remaining.join(", ")}`);
