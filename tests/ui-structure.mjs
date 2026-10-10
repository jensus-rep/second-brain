import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw new Error("UI structure tests may only change localhost.");
const sqlitePath = resolve(process.env.BRAIN_TEST_SQLITE_PATH ?? ".data/newhope.sqlite");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.route("**/*", route => {
  const url = new URL(route.request().url());
  return ["http:", "https:"].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let initial;
async function snapshot() {
  const response = await page.request.get(origin + "/api/brain");
  assert.equal(response.status(), 200);
  return response.json();
}
async function write(workspace) {
  const current = await snapshot();
  assert.equal((await realpath(sqlitePath)).toLowerCase(), sqlitePath.toLowerCase());
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const row = db.prepare("SELECT body, revision FROM newhope_workspaces WHERE owner_id = ?").get("local_dev");
    assert.equal(row?.revision, current.revision, "The API must use the isolated local SQLite file.");
  } finally { db.close(); }
  const response = await page.request.put(origin + "/api/brain", { data: { revision: current.revision, workspace } });
  assert.equal(response.status(), 200, await response.text());
}
const visibleButton = name => page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
async function navigate(name) {
  await expect.poll(async () => await visibleButton(name).isVisible() || await visibleButton("Weitere Bereiche öffnen").isVisible(), { message: "Navigation settles after changing the responsive breakpoint." }).toBe(true);
  if (!await visibleButton(name).isVisible()) {
    await visibleButton("Weitere Bereiche öffnen").click();
  }
  await visibleButton(name).click();
}
async function fits(label, selectors = ".brain-main, .workspace-content") {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, label + ": page fits");
  for (const element of await page.locator(selectors).all()) {
    if (!await element.isVisible()) continue;
    const bounds = await element.boundingBox();
    assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= (await page.viewportSize()).width + 1, label + ": component fits");
    assert.equal(await element.evaluate(node => node.scrollWidth > node.clientWidth + 1), false, label + ": readable contents fit");
  }
}
async function screenshot(name) { await page.screenshot({ path: `.sites-runtime/qa/${name}.png`, fullPage: true, animations: "disabled" }); }
const now = new Date().toISOString();
const topics = [
  { id: "ui-ai", title: "Künstliche Intelligenz", parentId: null, description: "Systeme, die Aufgaben mit intelligentem Verhalten bearbeiten.", color: "blue" },
  { id: "ui-ml", title: "Machine Learning", parentId: "ui-ai", description: "Modelle aus Beispieldaten entwickeln.", color: "blue" },
  { id: "ui-supervised", title: "Supervised Learning", parentId: "ui-ml", description: "Aus Beispielen mit Zielwert lernen.", color: "purple" },
  { id: "ui-unsupervised", title: "Unsupervised Learning", parentId: "ui-ml", description: "Strukturen in Daten entdecken.", color: "green" },
  { id: "ui-design", title: "Produktgestaltung", parentId: null, description: "Nutzbare Produkte gestalten.", color: "orange" },
];
const notes = topics.slice(1).map((topic, index) => ({ id: `ui-note-${index}`, title: ["Aus Daten lernen", "Mit Zielwerten lernen", "Muster ohne Zielwert finden", "Nutzerbedarf klären"][index], summary: topic.description, content: "## Ein Zusammenhang\n\nDer Eintrag bleibt auf seiner konkreten Themenebene zugeordnet.", topicId: topic.id, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: now, updatedAt: now }));
const cards = notes.map((note, index) => ({ id: `ui-card-${index}`, question: `Was bedeutet „${note.title}“?`, answer: note.summary, noteId: note.id, priority: 1, dueAt: index === 2 ? "2099-01-01T00:00:00.000Z" : "2000-01-01T00:00:00.000Z", intervalDays: 3, reviews: 2 }));
const aiCollection = { id: "ui-collection-ai", title: "Lernsammlung: Lernparadigmen", description: "Die Paradigmen des maschinellen Lernens unterscheiden.", noteIds: notes.slice(0, 3).map(note => note.id), cardIds: [], questionIds: [], pathIds: [] };
const futureCollection = { id: "ui-collection-future", title: "Muster in Daten", description: "Eine bereits wiederholte Karte gezielt üben.", noteIds: [notes[2].id], cardIds: [], questionIds: [], pathIds: [] };
const path = { id: "ui-path", title: "Paradigmen verstehen", description: "Beispiele einordnen.", steps: [{ id: "ui-step", noteId: notes[1].id, objective: "Ein Beispiel erklären." }] };
const fixture = { schemaVersion: 1, topics, notes, cards, paths: [path], completedStepIds: ["ui-step"], quizQuestions: [], quizRuns: [], learningReminders: [], learningCollections: [aiCollection, futureCollection] };
try {
  await page.goto(origin, { waitUntil: "networkidle" });
  initial = (await snapshot()).workspace;
  await write(fixture);
  await page.reload({ waitUntil: "networkidle" });
  await mkdir(".sites-runtime/qa", { recursive: true });

  console.log("Checking homepage collection click, direct learning and collection return");
  await page.locator(".collection-card").filter({ hasText: aiCollection.title }).click();
  const detail = page.getByRole("article", { name: `Lernsammlung ${aiCollection.title}`, exact: true });
  await expect(detail).toBeVisible();
  await expect(page.locator(".collection-card")).toHaveCount(0);
  await expect(detail.getByRole("button", { name: "Jetzt lernen", exact: true })).toBeInViewport();
  await screenshot("ui-collection-desktop");
  await detail.getByRole("button", { name: "Jetzt lernen", exact: true }).click();
  await expect(page.locator(".study-topline")).toContainText("1 von 2");
  await expect(page.locator(".study-scope-line")).toContainText(aiCollection.title);
  assert.deepEqual((await snapshot()).workspace.cards, cards, "Opening a round alone preserves progress.");
  await visibleButton("Beenden").click();
  await visibleButton("Zur Lernsammlung").click();
  await expect(detail).toBeVisible();
  await visibleButton("Alle Lernsammlungen").click();
  await page.locator(".collection-card").filter({ hasText: futureCollection.title }).click();
  await visibleButton("Jetzt lernen").click();
  await expect(page.getByRole("alertdialog", { name: "Pausierte Lernrunde ersetzen?", exact: true })).toBeVisible();
  await visibleButton("Neue Runde beginnen").click();
  await expect(page.locator(".study-question")).toHaveText(cards[2].question);
  await expect(page.locator(".study-scope-line")).toContainText("Alle ausgewählten Karten üben");
  await visibleButton("Beenden").click();
  await visibleButton("Zur Lernsammlung").click();

  console.log("Checking a consumed direct-start request after a revision conflict and reload");
  await navigate("Lernsammlungen");
  await page.locator(".collection-card").filter({ hasText: aiCollection.title }).click();
  await visibleButton("Jetzt lernen").click();
  await expect(page.getByRole("alertdialog", { name: "Pausierte Lernrunde ersetzen?", exact: true })).toBeVisible();
  await visibleButton("Neue Runde beginnen").click();
  await expect(page.locator(".study-session")).toBeVisible();
  await write(fixture);
  await visibleButton("Antwort aufdecken").click();
  await page.locator(".rate-known").click();
  await expect(page.locator(".error-banner")).toBeVisible();
  await visibleButton("Aktuellen Stand laden").click();
  await expect(page.locator(".flashcard-start-panel")).toBeVisible();
  await expect(page.locator(".study-session")).toHaveCount(0);
  assert.deepEqual((await snapshot()).workspace.cards, cards, "Conflict reload preserves the newer revision without restarting the consumed round.");

  console.log("Checking hierarchy, knowledge scope, breadcrumbs and card filtering");
  await navigate("Themen");
  const tree = page.locator(".topic-browser .topic-tree");
  const treeOpen = title => tree.locator(".topic-tree-open").filter({ has: page.getByText(title, { exact: true }) });
  await expect(tree.locator(".topic-tree-roots > li")).toHaveCount(2);
  await expect(tree.locator('ul[aria-label="Unterthemen von Machine Learning"] > li')).toHaveCount(2);
  await tree.getByRole("button", { name: "Machine Learning: Unterthemen ausblenden", exact: true }).click();
  await expect(treeOpen("Supervised Learning")).not.toBeVisible();
  await tree.getByRole("button", { name: "Machine Learning: Unterthemen anzeigen", exact: true }).click();
  await treeOpen("Künstliche Intelligenz").click();
  await expect(page.locator(".note-card")).toHaveCount(3);
  await expect(page.locator(".topic-scope-summary")).toContainText("3 Unterthemen");
  await page.locator(".topic-child-links").getByRole("button", { name: "Machine Learning", exact: true }).click();
  await expect(page.locator(".note-card")).toHaveCount(3);
  await page.locator(".topic-child-links").getByRole("button", { name: "Supervised Learning", exact: true }).click();
  await expect(page.locator(".note-card")).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Themenpfad", exact: true })).toContainText("Künstliche IntelligenzMachine LearningSupervised Learning");
  await page.locator(".note-open").click();
  const reader = page.getByRole("dialog", { name: notes[1].title, exact: true });
  await expect(reader.getByRole("navigation", { name: "Themenpfad des Eintrags", exact: true })).toContainText("Machine Learning");
  await reader.getByRole("navigation", { name: "Themenpfad des Eintrags", exact: true }).getByRole("button", { name: "Künstliche Intelligenz", exact: true }).click();
  await expect(reader).not.toBeVisible();
  await expect(page.locator(".note-card")).toHaveCount(3);
  await navigate("Lernkarten");
  await page.getByLabel("Lernsammlung für Lernkarten", { exact: true }).selectOption(aiCollection.id);
  await page.locator(".flashcard-filters-disclosure summary").click();
  await page.getByLabel("Thema der Lernkarten", { exact: true }).selectOption("ui-ai");
  await expect(page.locator(".flashcard-list > article")).toHaveCount(3);
  await page.getByLabel("Thema der Lernkarten", { exact: true }).selectOption("ui-supervised");
  await expect(page.locator(".flashcard-list > article")).toHaveCount(1);
  await screenshot("ui-flashcards-desktop");

  console.log("Checking persisted topic move, ID/progress preservation and cycle prevention");
  await navigate("Themen");
  await tree.getByRole("button", { name: "Supervised Learning bearbeiten", exact: true }).click();
  const editor = page.locator(".topic-editor-dialog");
  await editor.getByLabel("Übergeordnetes Thema", { exact: true }).click();
  await page.getByRole("option", { name: "Produktgestaltung", exact: true }).click();
  await editor.getByRole("button", { name: "Thema speichern", exact: true }).click();
  await expect(editor).not.toBeVisible();
  const moved = (await snapshot()).workspace;
  assert.equal(moved.topics.find(topic => topic.id === "ui-supervised").parentId, "ui-design");
  assert.deepEqual(moved.notes, notes);
  assert.deepEqual(moved.cards, cards);
  assert.deepEqual(moved.completedStepIds, fixture.completedStepIds);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal((await snapshot()).workspace.topics.find(topic => topic.id === "ui-supervised").parentId, "ui-design");
  await navigate("Themen");
  await tree.getByRole("button", { name: "Künstliche Intelligenz bearbeiten", exact: true }).click();
  await editor.getByLabel("Übergeordnetes Thema", { exact: true }).click();
  await expect(page.getByRole("option").filter({ hasText: "Machine Learning" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await editor.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await write(fixture);
  await page.reload({ waitUntil: "networkidle" });

  console.log("Checking complete mobile journeys at 320/390 px and tablet layout");
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await navigate("Mein Überblick");
    await fits(`Home ${width}`, ".workspace-content, .collection-card, .workspace-entrypoints");
    await page.locator(".collection-card").filter({ hasText: aiCollection.title }).click();
    await fits(`Collection ${width}`, ".collection-detail, .collection-inventory, .collection-note-list");
    await screenshot(`ui-collection-${width}`);
    await visibleButton("Lernkarten öffnen").click();
    await fits(`Cards ${width}`, ".flashcard-filter-panel, .flashcard-start-grid, .flashcard-list > article");
    await expect(visibleButton("Lernrunde starten")).toBeInViewport();
    const savedRound = (await snapshot()).workspace.flashcardSession;
    await visibleButton("Lernrunde starten").click();
    if (savedRound) {
      await expect(page.getByRole("alertdialog", { name: "Pausierte Lernrunde ersetzen?", exact: true })).toBeVisible();
      await visibleButton("Neue Runde beginnen").click();
    }
    await expect(page.locator(".study-topline")).toContainText("1 von 2");
    await fits(`Study ${width}`, ".study-session, .study-card");
    await visibleButton("Beenden").click();
    await navigate("Themen");
    await fits(`Topics ${width}`, ".topic-browser, .topic-tree-row");
    if (width < 768) {
      for (const control of await tree.locator(".topic-tree-toggle, .topic-tree-actions button").all()) {
        const bounds = await control.boundingBox();
        assert.ok(bounds.width >= 44 && bounds.height >= 44, "Topic controls have 44px touch targets.");
      }
    }
    await screenshot(`ui-topics-${width}`);
    await tree.getByRole("button", { name: "Unterthema für Machine Learning anlegen", exact: true }).click();
    await expect(editor.getByLabel("Übergeordnetes Thema", { exact: true })).toContainText("Machine Learning");
    await expect(editor.locator(".topic-location-preview")).toContainText("Künstliche Intelligenz › Machine Learning");
    await fits(`Topic editor ${width}`, ".topic-editor-dialog, .topic-location-preview");
    await editor.getByRole("button", { name: "Abbrechen", exact: true }).click();
  }

  console.log("Checking narrow layout with long paths and deep hierarchy");
  const deepTopics = Array.from({ length: 7 }, (_, index) => ({ id: `ui-deep-${index}`, title: (`Ausführliches Fachthema ${index} ` + "Zusammenhang ".repeat(12)).slice(0, 160), parentId: index ? `ui-deep-${index - 1}` : null, description: "", color: "blue" }));
  await write({ ...fixture, topics: [...topics, ...deepTopics] });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.reload({ waitUntil: "networkidle" });
  await navigate("Themen");
  await fits("Deep hierarchy", ".topic-tree-row");
  await tree.getByRole("button", { name: `${deepTopics[6].title} bearbeiten`, exact: true }).click();
  await fits("Long topic path", ".topic-editor-dialog, .topic-location-preview");
  await editor.getByLabel("Übergeordnetes Thema", { exact: true }).click();
  await fits("Long path menu", '[data-slot="select-content"]');
  await page.keyboard.press("Escape");
  await editor.getByRole("button", { name: "Abbrechen", exact: true }).click();

  console.log("Checking new child topics and note assignment through the mobile editors");
  await tree.getByRole("button", { name: "Unterthema für Machine Learning anlegen", exact: true }).click();
  await editor.getByLabel("Name", { exact: true }).fill("Reinforcement Learning");
  await editor.getByRole("button", { name: "Thema speichern", exact: true }).click();
  await expect(editor).not.toBeVisible();
  const createdTopic = (await snapshot()).workspace.topics.find(topic => topic.title === "Reinforcement Learning");
  assert.equal(createdTopic.parentId, "ui-ml");
  await tree.locator(".topic-tree-open").filter({ has: page.getByText("Supervised Learning", { exact: true }) }).click();
  await page.locator(".note-open").click();
  await page.getByRole("dialog", { name: notes[1].title, exact: true }).getByRole("button", { name: "Bearbeiten", exact: true }).filter({ visible: true }).first().click();
  const noteEditor = page.getByRole("dialog", { name: "Notiz bearbeiten", exact: true });
  await noteEditor.getByLabel("Thema der Notiz", { exact: true }).click();
  await page.getByRole("option").filter({ hasText: "Reinforcement Learning" }).click();
  await noteEditor.getByRole("button", { name: "Notiz speichern", exact: true }).click();
  await expect(noteEditor).not.toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  const assigned = (await snapshot()).workspace;
  assert.equal(assigned.notes.find(note => note.id === notes[1].id).topicId, createdTopic.id);
  assert.deepEqual(assigned.cards, cards);
  assert.deepEqual(assigned.completedStepIds, fixture.completedStepIds);
  assert.deepEqual(errors, [], "No browser runtime errors.");
  console.log("PASS: direct collection learning, future-card practice, return navigation, hierarchical knowledge/card scope, persistent topic moves, unchanged IDs/progress, cycle-safe editing and layouts at 320/390/768/1440 px.");
} finally {
  try { if (initial) await write(initial); } finally { await browser.close(); }
}
