import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

// Run against npm run dev. An isolated preview may override both variables:
// BRAIN_TEST_URL=http://127.0.0.1:5185 BRAIN_TEST_SQLITE_PATH=/absolute/preview.sqlite
const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
const originUrl = new URL(origin);
if (!["127.0.0.1", "localhost"].includes(originUrl.hostname)) throw new Error("Learning-collection browser tests may only mutate localhost.");
const sqlitePath = resolve(process.env.BRAIN_TEST_SQLITE_PATH ?? process.env.NEWHOPE_SQLITE_PATH ?? ".data/newhope.sqlite");
const output = ".sites-runtime/qa";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const blocked = [];
await context.route("**/*", async route => {
  const url = new URL(route.request().url());
  if (["http:", "https:"].includes(url.protocol) && url.origin !== originUrl.origin) {
    blocked.push(url.hostname);
    return route.abort();
  }
  return route.continue();
});
const page = await context.newPage();
page.setDefaultTimeout(30000);
page.setDefaultNavigationTimeout(90000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("dialog", dialog => dialog.accept());
let initial;

async function snapshot() {
  const response = await page.request.get(origin + "/api/brain", { maxRedirects: 0 });
  assert.equal(response.status(), 200, "Authenticated local snapshot");
  return response.json();
}

function normalizedStoredWorkspace(workspace) {
  return { ...workspace, cards: workspace.cards ?? [], quizQuestions: workspace.quizQuestions ?? [], quizRuns: workspace.quizRuns ?? [], learningReminders: workspace.learningReminders ?? [], learningCollections: workspace.learningCollections ?? [] };
}

async function verifyLocalSqlite(current) {
  assert.equal((await realpath(sqlitePath)).toLocaleLowerCase("en"), sqlitePath.toLocaleLowerCase("en"), "The test must use the specified SQLite file.");
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const row = db.prepare("SELECT body, revision FROM newhope_workspaces WHERE owner_id = ?").get("local_dev");
    assert.ok(row, "The development workspace must exist in the local SQLite file.");
    assert.equal(Number(row.revision), current.revision, "API revision must match the local SQLite file before writes.");
    assert.deepEqual(normalizedStoredWorkspace(JSON.parse(row.body)), current.workspace, "API contents must match the local SQLite file before writes.");
  } finally { db.close(); }
}

async function write(workspace) {
  const current = await snapshot();
  await verifyLocalSqlite(current);
  const response = await page.request.put(origin + "/api/brain", { headers: { Origin: origin }, data: { revision: current.revision, workspace } });
  assert.equal(response.status(), 200, await response.text());
  const saved = await snapshot();
  assert.equal(saved.revision, current.revision + 1, "A validated import advances exactly one revision.");
  return saved;
}

const button = (name, scope = page) => scope.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
async function click(name, scope = page) {
  await expect(button(name, scope)).toBeEnabled();
  await button(name, scope).click();
  if (["Lernkarten öffnen", "Zur Kartenübersicht"].includes(name)) await openCardFilters();
}
async function openCardFilters() {
  const filters = page.locator(".flashcard-filters-disclosure");
  await expect(filters).toBeVisible();
  if (!await filters.evaluate(element => element.open)) await filters.locator("summary").click();
}
async function navigate(name) {
  if (!await button(name).isVisible()) await click("Navigation öffnen");
  await click(name);
  if (name === "Lernkarten") await openCardFilters();
}
async function reload() {
  const response = await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200, "Local preview reload must compile successfully.");
  await expect(page.getByRole("heading", { name: "Dein Wissen", exact: true })).toBeVisible();
}
async function saveUi(action, predicate) {
  const before = await snapshot();
  await verifyLocalSqlite(before);
  const requested = page.waitForRequest(request => request.url() === origin + "/api/brain" && request.method() === "PUT");
  const responded = page.waitForResponse(response => response.url() === origin + "/api/brain" && response.request().method() === "PUT");
  await action();
  const request = await requested;
  assert.equal(request.postDataJSON().revision, before.revision, "UI writes the revision it actually loaded.");
  const response = await responded;
  assert.equal(response.status(), 200, await response.text());
  await expect.poll(async () => {
    const current = await snapshot();
    return current.revision === before.revision + 1 && predicate(current.workspace);
  }).toBe(true);
  return snapshot();
}
async function mobileFits(stage, selectors) {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), { message: `${stage} fits ${width}px` }).toBe(true);
    await page.screenshot({ path: `${output}/learning-collections-${stage}-${width}.png`, fullPage: true, animations: "disabled" });
    const overflow = await page.locator(selectors).evaluateAll(elements => elements.filter(element => element.getClientRects().length && element.scrollWidth > element.clientWidth + 1).map(element => ({ className: element.className, tagName: element.tagName, open: element.open, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, children: Array.from(element.children, child => ({ tagName: child.tagName, className: child.className, clientWidth: child.clientWidth, scrollWidth: child.scrollWidth, display: getComputedStyle(child).display })) })));
    assert.deepEqual(overflow, [], `${stage} panels fit ${width}px`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
function progress(card) { return { reviews: card.reviews, intervalDays: card.intervalDays, dueAt: card.dueAt }; }
async function unchangedCards(before, except = []) {
  const after = (await snapshot()).workspace.cards;
  for (const card of before) if (!except.includes(card.id)) assert.deepEqual(after.find(item => item.id === card.id), card, `Unselected card ${card.id} remains untouched.`);
}
async function openSource(scope, note) {
  const before = (await snapshot()).workspace;
  await click(`Lerninhalt öffnen: ${note.title}`, scope);
  const reader = page.getByRole("dialog", { name: note.title, exact: true });
  await expect(reader).toBeVisible();
  await expect(reader.getByRole("heading", { name: "Nachschlagbare Grundlage", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(reader).toHaveCount(0);
  assert.deepEqual((await snapshot()).workspace, before, "Opening a source neither counts a review nor changes stored progress.");
}

try {
  await reload();
  const first = await snapshot();
  await verifyLocalSqlite(first);
  initial = first.workspace;
  await mkdir(output, { recursive: true });
  const now = new Date().toISOString();
  const subject = "Lernprüfung Projektmanagement";
  const topics = [
    { id: "qa-collections-topic-project", title: "Projektgrundlagen", description: "Ziele und Verantwortung", color: "blue" },
    { id: "qa-collections-topic-product", title: "Produktentwicklung", description: "Bedarf und Nutzen", color: "green" },
  ];
  const notes = topics.map((topic, index) => ({ id: `qa-collections-note-${index + 1}`, title: index ? "Bedarf und Nutzen verstehen" : "Ziele und Verantwortung klären", content: "## Nachschlagbare Grundlage\n\nDie vorhandene Notiz erklärt den Zusammenhang mit einem übertragbaren Praxisbeispiel.", summary: topic.description, topicId: topic.id, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: now, updatedAt: now }));
  const card = (id, question, answer, noteId, priority, future = false) => ({ id, question, answer, noteId, priority, reviews: 4, intervalDays: 3, dueAt: future ? "2099-01-01T00:00:00.000Z" : "2000-01-01T00:00:00.000Z" });
  const cards = [
    card("qa-collections-core-one", "Welche Ziele prüft die Projektleitung?", "Zielprüfung: vereinbarte Ziele und Abweichungen betrachten.", notes[0].id, 1),
    card("qa-collections-core-two", "Woran erkennt man einen geklärten Projektumfang?", "Zielprüfung: enthaltene und ausgeschlossene Ergebnisse benennen.", notes[0].id, 1),
    card("qa-collections-future", "Welche Planung kommt in einer späteren Wiederholung vor?", "Zielprüfung: Diese Karte ist noch nicht fällig.", notes[0].id, 1, true),
    card("qa-collections-deepening", "Wie lässt sich die Planung genauer begründen?", "Einzelne Annahmen und ihre Folgen vergleichen.", notes[0].id, 2),
    card("qa-collections-supplementary", "Welches zusätzliche Produktdetail hilft beim Nachschlagen?", "Ein illustrierendes Detail ergänzt den Kernnutzen.", notes[1].id, 3),
    card("qa-collections-unclassified", "Welche neue Produktfrage ist noch nicht eingestuft?", "Die Priorität bleibt ausdrücklich offen.", notes[1].id, null),
    card("qa-collections-shared", "Welche gemeinsame Verantwortung ist in beiden Teilsets enthalten?", "Das verknüpfte Wissen bleibt eine einzelne Karte.", notes[0].id, 1),
    card("qa-collections-standalone", "Welche eigenständige Karte gehört noch zu keiner gespeicherten Sammlung?", "Eigenständige Inhalte bleiben erreichbar.", null, 2),
  ];
  const question = (id, note, concept, difficulty) => ({ id, subject, concept, difficulty, noteIds: [note.id], prompt: `${concept}: Welche Aussage erklärt die Grundlage?`, options: [{ id: `${id}-yes`, text: "Den vereinbarten Zusammenhang ausdrücklich klären.", feedback: "" }, { id: `${id}-no`, text: "Zuständigkeiten und Bedürfnisse vollständig ignorieren.", feedback: "Die Grundlage verlangt eine ausdrückliche Klärung." }], correctOptionIds: [`${id}-yes`], explanation: "Die vorhandene Notiz erklärt, warum die Zusammenhänge ausdrücklich geklärt werden.", source: "" });
  const questions = [question("qa-collections-q1", notes[0], "Ziele klären", 1), question("qa-collections-q2", notes[1], "Bedarf verstehen", 2), question("qa-collections-q3", notes[0], "Ziele übertragen", 3)];
  const path = { id: "qa-collections-path", title: "Vom Ziel zum Nutzen", description: "Beide Grundlagen erklären.", steps: notes.map((note, index) => ({ id: `qa-collections-step-${index}`, noteId: note.id, objective: "Den Zusammenhang in eigenen Worten erläutern." })) };
  const primary = { id: "qa-collections-primary", title: "Projekt und Produkt gemeinsam", description: "Ziele, Verantwortung und Nutzerbedarf gemeinsam wiederholen.", noteIds: notes.map(note => note.id), questionIds: questions.slice(0, 2).map(item => item.id), cardIds: [cards[6].id], pathIds: [path.id] };
  const subset = { id: "qa-collections-subset", title: "Produktfragen vertiefen", description: "Produktbedarf und eine gemeinsame Verantwortung gezielt erklären.", noteIds: [notes[1].id], questionIds: [questions[1].id], cardIds: [cards[6].id], pathIds: [] };
  await write({ schemaVersion: 1, topics, notes, cards, paths: [path], completedStepIds: [path.steps[0].id], quizQuestions: questions, quizRuns: [], learningReminders: [], learningCollections: [primary, subset] });
  await reload();

  if (!["collections", "creation"].includes(process.env.BRAIN_TEST_PHASE)) {
  console.log("Checking collection inventory, implicit membership and source links");
  const hub = page.getByRole("region", { name: "Lernsammlungen", exact: true });
  await expect(hub.getByRole("heading", { name: "Deine Lernsammlungen", exact: true })).toBeVisible();
  const primaryTile = hub.locator(".collection-card").filter({ has: page.getByRole("heading", { name: primary.title, exact: true }) });
  await expect(primaryTile.locator(".collection-card-counts")).toHaveText("2 Notizen7 Lernkarten2 Testaufgaben");
  await primaryTile.click();
  const detail = page.getByRole("article", { name: `Lernsammlung ${primary.title}`, exact: true });
  await expect(detail).toBeVisible();
  for (const [name, count] of [["Notizen", 2], ["Lernkarten", 7], ["Testaufgaben", 2], ["Lernpfade", 1]]) await expect(detail.locator(".collection-inventory > div").filter({ has: page.getByText(name, { exact: true }) }).locator("dd")).toHaveText(String(count));
  await expect(detail.getByLabel("Inhalte der Lernsammlung nach Thema").locator("option")).toHaveText(["Alle 2 Fachthemen", topics[0].title, topics[1].title]);
  await expect(detail.locator(".collection-note-list article")).toHaveCount(2);
  await expect(detail.locator(".collection-priorities")).toContainText("1 Karten sind noch nicht eingestuft.");
  const baseline = (await snapshot()).workspace;
  await detail.locator(".collection-note-list button").filter({ hasText: notes[0].title }).click();
  await expect(page.getByRole("dialog", { name: notes[0].title, exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  assert.deepEqual((await snapshot()).workspace, baseline, "Hub source reading preserves the stored learning state.");
  await page.screenshot({ path: `${output}/learning-collections-hub-desktop.png`, fullPage: true });
  await mobileFits("hub", ".learning-collections, .collection-detail, .collection-card");

  console.log("Checking shared collection selection for cards and tests");
  await click("Lernkarten öffnen", detail);
  await expect(page.getByLabel("Lernsammlung für Lernkarten", { exact: true })).toHaveValue(primary.id);
  await expect(page.locator(".flashcard-list > article")).toHaveCount(7);
  const shared = page.locator(".flashcard-list > article").filter({ has: page.getByRole("heading", { name: cards[6].question, exact: true }) });
  await expect(shared).toHaveCount(1);
  await expect(shared.locator(".flashcard-context")).toContainText(primary.title);
  await expect(shared.locator(".flashcard-context")).toContainText(subset.title);
  await openSource(shared, notes[0]);
  await navigate("Tests & Übungen");
  await expect(page.getByLabel("Lernsammlung für Tests", { exact: true })).toHaveValue(primary.id);
  await expect(page.locator(".quiz-collection-scope")).toContainText("insgesamt 2 Testaufgaben, 2 Notizen und 7 Lernkarten");
  await page.getByLabel("Modus", { exact: true }).selectOption("exam");
  await page.getByLabel("Aufgabenanzahl", { exact: true }).selectOption("2");
  await page.getByLabel("Zeitlimit", { exact: true }).selectOption("0");
  const started = await saveUi(() => click("Simulation starten"), workspace => workspace.quizRuns.length === 1);
  assert.equal(started.workspace.quizRuns[0].collectionId, primary.id);
  assert.deepEqual(started.workspace.quizRuns[0].questions.map(item => item.id).sort(), primary.questionIds.slice().sort(), "New tests use exactly the selected collection's question pool.");
  await saveUi(() => click("Test abgeben"), workspace => !!workspace.quizRuns[0].finishedAt);
  await click("Zur Testübersicht");
  await navigate("Lernkarten");
  await expect(page.getByLabel("Lernsammlung für Lernkarten", { exact: true })).toHaveValue(primary.id);

  console.log("Checking exact filtered due queue and source reading during a round");
  await page.getByLabel("Thema der Lernkarten", { exact: true }).selectOption(topics[0].id);
  await page.getByLabel("Prioritätsstufe", { exact: true }).selectOption("1");
  await page.getByLabel("Lernkarten durchsuchen", { exact: true }).fill("Zielprüfung");
  await expect(page.locator(".flashcard-list > article")).toHaveCount(3);
  await expect(page.locator(".flashcard-visible-count")).toHaveText("3 sichtbar · 2 fällig");
  await expect(page.locator(".flashcard-priority-overview")).toContainText("alle 5 Karten");
  await mobileFits("cards", ".flashcards-home, .flashcard-filter-panel, .flashcard-list > article");
  const beforeRound = (await snapshot()).workspace.cards;
  await click("Lernrunde starten");
  await expect(page.locator(".study-topline")).toContainText("1 von 2");
  await expect(page.locator(".study-question")).toHaveText(cards[0].question);
  await expect(page.locator(".study-session .flashcard-context")).toContainText("1 Kernwissen");
  await openSource(page.locator(".study-session"), notes[0]);
  await mobileFits("card-round", ".study-session, .study-card, .flashcard-context");
  for (const selected of cards.slice(0, 2)) {
    await expect(page.locator(".study-question")).toHaveText(selected.question);
    await click("Antwort aufdecken");
    await saveUi(() => page.locator(".rate-known").click(), workspace => workspace.cards.find(item => item.id === selected.id).reviews === selected.reviews + 1);
  }
  await expect(page.getByRole("heading", { name: "Ein Stück Wissen bleibt.", exact: true })).toBeVisible();
  await unchangedCards(beforeRound, cards.slice(0, 2).map(item => item.id));
  await click("Zur Kartenübersicht");
  await expect(page.locator(".flashcard-visible-count")).toHaveText("3 sichtbar · 0 fällig");
  await expect(button("Lernrunde starten")).toBeDisabled();

  console.log("Checking priority edits without rescheduling and durable reload");
  await page.getByLabel("Prioritätsstufe", { exact: true }).selectOption("all");
  await page.getByLabel("Lernkarten durchsuchen", { exact: true }).fill(cards[3].question);
  const beforeEdit = (await snapshot()).workspace.cards.find(item => item.id === cards[3].id);
  await click("Lernkarte bearbeiten", page.locator(".flashcard-list > article"));
  const cardEditor = page.getByRole("dialog", { name: "Lernkarte bearbeiten", exact: true });
  await cardEditor.getByLabel("Priorität der Lernkarte", { exact: true }).selectOption("3");
  const savedEdit = await saveUi(() => click("Lernkarte speichern", cardEditor), workspace => workspace.cards.find(item => item.id === cards[3].id).priority === 3);
  assert.deepEqual(progress(savedEdit.workspace.cards.find(item => item.id === cards[3].id)), progress(beforeEdit), "Changing only importance preserves all repetition data.");
  assert.deepEqual(savedEdit.workspace.completedStepIds, [path.steps[0].id]);
  await expect(cardEditor).toHaveCount(0);
  await reload();
  await navigate("Lernkarten");
  await page.getByLabel("Lernsammlung für Lernkarten", { exact: true }).selectOption(primary.id);
  await page.getByLabel("Lernkarten durchsuchen", { exact: true }).fill(cards[3].question);
  await expect(page.locator(".flashcard-list > article .flashcard-priority-badge")).toHaveText("3 Ergänzung");
  assert.deepEqual(progress((await snapshot()).workspace.cards.find(item => item.id === cards[3].id)), progress(beforeEdit));

  console.log("Checking partial sets, complete subject fallback and standalone cards");
  await page.getByLabel("Lernkarten durchsuchen", { exact: true }).fill("");
  await page.getByLabel("Lernsammlung für Lernkarten", { exact: true }).selectOption(subset.id);
  await expect(page.locator(".flashcard-list > article")).toHaveCount(3);
  await page.getByLabel("Prioritätsstufe", { exact: true }).selectOption("null");
  await expect(page.locator(".flashcard-list > article")).toHaveCount(1);
  await expect(page.locator(".flashcard-list > article h3")).toHaveText(cards[5].question);
  await page.getByLabel("Prioritätsstufe", { exact: true }).selectOption("all");
  await page.getByLabel("Lernsammlung für Lernkarten", { exact: true }).selectOption("");
  await page.getByLabel("Thema der Lernkarten", { exact: true }).selectOption("::unassigned");
  await expect(page.locator(".flashcard-list > article")).toHaveCount(1);
  await expect(page.locator(".flashcard-list .flashcard-source")).toHaveText("Eigenständige Lernkarte");
  await page.getByLabel("Thema der Lernkarten", { exact: true }).selectOption("");
  const additional = page.getByLabel("Lernsammlung für Lernkarten", { exact: true }).locator("option").filter({ hasText: "Weitere Lerninhalte" });
  const additionalId = await additional.getAttribute("value");
  assert.ok(additionalId, "Unassigned standalone cards have a reachable fallback collection.");
  await page.getByLabel("Lernsammlung für Lernkarten", { exact: true }).selectOption(additionalId);
  await expect(page.locator(".flashcard-list > article h3")).toHaveText(cards[7].question);
  await navigate("Tests & Übungen");
  const wholeSubject = page.getByLabel("Lernsammlung für Tests", { exact: true }).locator("option").filter({ hasText: subject });
  await expect(wholeSubject).toHaveCount(1);
  await expect(wholeSubject).toContainText("3 Aufgaben");
  const subjectId = await wholeSubject.getAttribute("value");
  await page.getByLabel("Lernsammlung für Tests", { exact: true }).selectOption(subjectId);
  await expect(page.locator(".quiz-history").last().getByRole("button", { name: /^Aufgabe bearbeiten:/ })).toHaveCount(3);
  }

  if (process.env.BRAIN_TEST_PHASE !== "creation") {
  console.log("Checking collection creation, update, revision persistence and card-link cleanup");
  await navigate("Lernsammlungen");
  await click("Neue Lernsammlung");
  const editor = page.getByRole("dialog", { name: "Lernsammlung zusammenstellen", exact: true });
  await editor.getByLabel("Name der Lernsammlung", { exact: true }).fill("Eigene Lernsammlung für Produktfragen");
  await editor.getByLabel("Umfang und Lernziel", { exact: true }).fill("Bedarf, Testfragen und eine eigenständige Karte gezielt wiederholen.");
  await editor.getByRole("checkbox", { name: notes[1].title, exact: true }).check();
  await editor.locator("summary").filter({ hasText: /^Testaufgaben/ }).click();
  await editor.getByRole("checkbox", { name: new RegExp(questions[1].prompt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).check();
  await editor.locator("summary").filter({ hasText: /^Zusätzliche Lernkarten/ }).click();
  await editor.getByRole("checkbox", { name: cards[7].question, exact: true }).check();
  await expect(editor.locator(".collection-editor-count")).toHaveText("Enthalten: 1 Notizen · 3 Lernkarten · 1 Testaufgaben · 0 Lernpfade");
  await mobileFits("collection-editor", ".collection-editor, .collection-picker, .collection-picker-list");
  const created = await saveUi(() => click("Sammlung speichern", editor), workspace => workspace.learningCollections.length === 3);
  const custom = created.workspace.learningCollections.find(item => item.title === "Eigene Lernsammlung für Produktfragen");
  assert.ok(custom);
  assert.deepEqual(custom.noteIds, [notes[1].id]);
  assert.deepEqual(custom.questionIds, [questions[1].id]);
  assert.deepEqual(custom.cardIds, [cards[7].id]);
  await expect(editor).toHaveCount(0);
  await reload();
  await navigate("Lernsammlungen");
  await page.locator(".collection-card").filter({ has: page.getByRole("heading", { name: custom.title, exact: true }) }).click();
  let customDetail = page.getByRole("article", { name: `Lernsammlung ${custom.title}`, exact: true });
  await expect(customDetail).toBeVisible();
  await click("Sammlung bearbeiten", customDetail);
  await editor.getByLabel("Name der Lernsammlung", { exact: true }).fill("Produktfragen mit gemeinsamen Grundlagen");
  await editor.locator("summary").filter({ hasText: /^Zusätzliche Lernkarten/ }).click();
  await editor.getByRole("checkbox", { name: cards[6].question, exact: true }).check();
  await click(`${topics[0].title} hinzufügen`, editor);
  await editor.locator("summary").filter({ hasText: /^Testaufgaben/ }).click();
  await click(`${subject}: alle Aufgaben hinzufügen`, editor);
  await expect(editor.locator(".collection-editor-count")).toHaveText("Enthalten: 2 Notizen · 8 Lernkarten · 3 Testaufgaben · 0 Lernpfade");
  const updated = await saveUi(() => click("Sammlung speichern", editor), workspace => workspace.learningCollections.find(item => item.id === custom.id)?.title === "Produktfragen mit gemeinsamen Grundlagen");
  assert.equal(updated.workspace.learningCollections.length, 3, "Updating retains the stable collection ID.");
  assert.deepEqual(updated.workspace.learningCollections.find(item => item.id === custom.id).questionIds.slice().sort(), questions.map(item => item.id).sort());
  await reload();
  await navigate("Lernsammlungen");
  await page.locator(".collection-card").filter({ has: page.getByRole("heading", { name: "Produktfragen mit gemeinsamen Grundlagen", exact: true }) }).click();
  customDetail = page.getByRole("article", { name: "Lernsammlung Produktfragen mit gemeinsamen Grundlagen", exact: true });
  await expect(customDetail.locator(".collection-inventory > div").filter({ has: page.getByText("Lernkarten", { exact: true }) }).locator("dd")).toHaveText("8");
  await click("Lernkarten öffnen", customDetail);
  await page.getByLabel("Lernkarten durchsuchen", { exact: true }).fill(cards[6].question);
  await click("Lernkarte bearbeiten", page.locator(".flashcard-list > article"));
  await click("Lernkarte löschen", page.getByRole("dialog", { name: "Lernkarte bearbeiten", exact: true }));
  const confirm = page.getByRole("alertdialog");
  await expect(confirm.getByRole("heading", { name: "Lernkarte löschen?", exact: true })).toBeVisible();
  const deleted = await saveUi(() => click("Löschen", confirm), workspace => !workspace.cards.some(item => item.id === cards[6].id));
  assert.ok(deleted.workspace.learningCollections.every(item => !item.cardIds.includes(cards[6].id)), "Deletion cleans shared collection references in the same write.");
  assert.deepEqual(deleted.workspace.notes, notes, "Deleting a card preserves its source notes.");
  assert.deepEqual(deleted.workspace.completedStepIds, [path.steps[0].id], "Deleting a card preserves path progress.");
  await reload();
  assert.ok((await snapshot()).workspace.learningCollections.every(item => !item.cardIds.includes(cards[6].id)), "Cleaned membership references survive reload.");
  }

  if (process.env.BRAIN_TEST_PHASE !== "collections") {
  if (process.env.BRAIN_TEST_PHASE !== "creation") {
    await write({ schemaVersion: 1, topics, notes, cards, paths: [path], completedStepIds: [path.steps[0].id], quizQuestions: questions, quizRuns: [], learningReminders: [], learningCollections: [primary, subset] });
    await reload();
  }
  console.log("Checking atomic membership when creating cards and questions inside a scope");
  async function createScopedCard(scopeId, scopeTitle, questionText) {
    await navigate("Lernkarten");
    await page.getByLabel("Lernsammlung für Lernkarten", { exact: true }).selectOption(scopeId);
    await page.getByLabel("Lernkarten durchsuchen", { exact: true }).fill("");
    await page.getByLabel("Thema der Lernkarten", { exact: true }).selectOption("");
    await page.getByLabel("Prioritätsstufe", { exact: true }).selectOption("all");
    await click("Neue Lernkarte");
    const editor = page.getByRole("dialog", { name: "Ein Gedanke zum Behalten", exact: true });
    await expect(editor).toContainText(`Die neue Karte gehört zur Lernsammlung „${scopeTitle}“.`);
    await editor.getByRole("textbox", { name: "Frage", exact: true }).fill(questionText);
    await editor.getByRole("tab", { name: "Antwort", exact: true }).click();
    await editor.getByRole("textbox", { name: "Antwort", exact: true }).fill("Der neue Gedanke bleibt über die bewusst gewählte Sammlung erreichbar.");
    await editor.getByLabel("Priorität der Lernkarte", { exact: true }).selectOption("2");
    const before = (await snapshot()).workspace;
    const saved = await saveUi(() => click("Lernkarte speichern", editor), workspace => workspace.cards.some(item => item.question === questionText));
    const createdCard = saved.workspace.cards.find(item => item.question === questionText);
    assert.ok(createdCard);
    assert.equal(createdCard.noteId, null, "A new standalone card is included through explicit collection membership.");
    assert.equal(createdCard.reviews, 0);
    assert.ok(saved.workspace.learningCollections.find(item => item.id === scopeId)?.cardIds.includes(createdCard.id), "Card creation and membership are saved atomically.");
    assert.deepEqual(saved.workspace.notes, before.notes);
    assert.deepEqual(saved.workspace.quizQuestions, before.quizQuestions);
    assert.deepEqual(saved.workspace.completedStepIds, before.completedStepIds);
    await unchangedCards(before.cards);
    await expect(editor).toHaveCount(0);
    await reload();
    await navigate("Lernkarten");
    await page.getByLabel("Lernsammlung für Lernkarten", { exact: true }).selectOption(scopeId);
    await page.getByLabel("Lernkarten durchsuchen", { exact: true }).fill(questionText);
    await expect(page.locator(".flashcard-list > article h3")).toHaveText(questionText);
    await expect(page.locator(".flashcard-list .flashcard-source")).toHaveText("Eigenständige Lernkarte");
    return createdCard;
  }
  async function createScopedQuestion(scopeId, scopeTitle, prompt) {
    await navigate("Tests & Übungen");
    await page.getByLabel("Lernsammlung für Tests", { exact: true }).selectOption(scopeId);
    await click("Neue Testaufgabe");
    const editor = page.getByRole("dialog", { name: "Neue Testaufgabe", exact: true });
    await expect(editor).toContainText(`Die neue Aufgabe gehört zur Lernsammlung „${scopeTitle}“.`);
    await editor.getByRole("textbox", { name: "Fachthema", exact: true }).fill(subject);
    await editor.getByRole("textbox", { name: "Lernbereich", exact: true }).fill("Neu angelegte Grundlagen");
    await editor.getByRole("textbox", { name: "Fragestellung", exact: true }).fill(prompt);
    for (let index = 1; index <= 4; index += 1) await editor.getByRole("textbox", { name: `Antwort ${index}`, exact: true }).fill(index === 1 ? "Den Zusammenhang ausdrücklich klären." : `Unpassende Behauptung ${index}.`);
    await editor.getByRole("textbox", { name: "Erklärung und Lerntipp", exact: true }).fill("Die bewusst gewählte Lernsammlung hält den neuen Inhalt mit seinen Grundlagen zusammen.");
    const before = (await snapshot()).workspace;
    const saved = await saveUi(() => click("Aufgabe speichern", editor), workspace => workspace.quizQuestions.some(item => item.prompt === prompt));
    const createdQuestion = saved.workspace.quizQuestions.find(item => item.prompt === prompt);
    assert.ok(createdQuestion);
    assert.ok(saved.workspace.learningCollections.find(item => item.id === scopeId)?.questionIds.includes(createdQuestion.id), "Question creation and membership are saved atomically.");
    assert.deepEqual(saved.workspace.cards, before.cards);
    assert.deepEqual(saved.workspace.quizRuns, before.quizRuns);
    assert.deepEqual(saved.workspace.completedStepIds, before.completedStepIds);
    await expect(editor).toHaveCount(0);
    await reload();
    await navigate("Tests & Übungen");
    await page.getByLabel("Lernsammlung für Tests", { exact: true }).selectOption(scopeId);
    await expect(button(`Aufgabe bearbeiten: ${prompt}`)).toBeVisible();
    return createdQuestion;
  }
  await createScopedCard(primary.id, primary.title, "Neue eigenständige Karte im gespeicherten Set");
  await createScopedQuestion(primary.id, primary.title, "Neue Frage im gespeicherten Set: Was ist zu klären?");

  console.log("Checking creation inside previously unsaved fallback proposals");
  await navigate("Lernkarten");
  const extraOption = page.getByLabel("Lernsammlung für Lernkarten", { exact: true }).locator("option").filter({ hasText: "Weitere Lerninhalte" });
  const extraId = await extraOption.getAttribute("value");
  assert.ok(extraId);
  assert.ok(!(await snapshot()).workspace.learningCollections.some(item => item.id === extraId));
  await createScopedCard(extraId, "Weitere Lerninhalte", "Neue eigenständige Karte im bislang ungespeicherten Vorschlag");
  assert.equal((await snapshot()).workspace.learningCollections.length, 3, "Creating the first explicit member adopts one proposal, without a duplicate.");
  await navigate("Tests & Übungen");
  const subjectOption = page.getByLabel("Lernsammlung für Tests", { exact: true }).locator("option").filter({ hasText: subject });
  const subjectCollectionId = await subjectOption.getAttribute("value");
  assert.ok(subjectCollectionId);
  assert.ok(!(await snapshot()).workspace.learningCollections.some(item => item.id === subjectCollectionId));
  await createScopedQuestion(subjectCollectionId, subject, "Neue Frage im bislang ungespeicherten Fachthema: Was ist zu klären?");
  const allAfterCreation = (await snapshot()).workspace;
  const adoptedSubject = allAfterCreation.learningCollections.find(item => item.id === subjectCollectionId);
  assert.deepEqual(adoptedSubject.questionIds.slice().sort(), allAfterCreation.quizQuestions.filter(item => item.subject === subject).map(item => item.id).sort(), "The adopted fallback keeps the entire subject pool and the new member.");

  console.log("Checking that editing a collection resets an invalid topic filter");
  await navigate("Lernsammlungen");
  await page.locator(".collection-card").filter({ has: page.getByRole("heading", { name: primary.title, exact: true }) }).click();
  const detail = page.getByRole("article", { name: `Lernsammlung ${primary.title}`, exact: true });
  await detail.getByLabel("Inhalte der Lernsammlung nach Thema", { exact: true }).selectOption(topics[0].id);
  await expect(detail.locator(".collection-note-list > article")).toHaveCount(1);
  await click("Sammlung bearbeiten", detail);
  const editor = page.getByRole("dialog", { name: "Lernsammlung zusammenstellen", exact: true });
  await editor.getByRole("checkbox", { name: notes[0].title, exact: true }).uncheck();
  await saveUi(() => click("Sammlung speichern", editor), workspace => workspace.learningCollections.find(item => item.id === primary.id)?.noteIds.length === 1);
  await expect(editor).toHaveCount(0);
  await expect(detail.getByLabel("Inhalte der Lernsammlung nach Thema", { exact: true })).toHaveValue("");
  await expect(detail.locator(".collection-note-list > article")).toHaveCount(1);
  await expect(detail.locator(".collection-note-list button strong")).toHaveText(notes[1].title);
  await page.screenshot({ path: `${output}/learning-collections-creation-filter-reset.png`, fullPage: true, animations: "disabled" });
  }

  assert.deepEqual(errors, [], "No browser runtime errors");
  assert.deepEqual(blocked, [], "The synthetic test uses no external resources");
  console.log(process.env.BRAIN_TEST_PHASE === "collections"
    ? "PASS: focused collection create/update, revision persistence, shared-card deletion and editor layouts at 390/320px."
    : process.env.BRAIN_TEST_PHASE === "creation"
      ? "PASS: atomic scoped card/question creation in saved collections and unsaved fallback proposals, durable reload, preserved progress and reset of invalid topic filters."
      : "PASS: collection inventory, shared selection, topic/priority/search due queue, source reading without reviews, durable priority editing, complete fallback scope, standalone cards, collection create/update, revision guards, shared-card deletion, scoped creation, filter reset and 390/320px layouts.");
} finally {
  try {
    if (initial) {
      await write(initial);
      assert.deepEqual((await snapshot()).workspace, initial, "Restore the original local workspace.");
    }
  } finally { await browser.close(); }
}
