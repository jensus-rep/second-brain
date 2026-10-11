import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw new Error("Hierarchy tests may only change localhost.");
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
    assert.equal(row?.revision, current.revision, "API must use the isolated SQLite file");
    assert.deepEqual(JSON.parse(row.body), current.workspace, "Database and API contain the same workspace");
  } finally { db.close(); }
  const response = await page.request.put(origin + "/api/brain", { data: { revision: current.revision, workspace } });
  assert.equal(response.status(), 200, await response.text());
}
const button = name => page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
async function navigate(name) {
  if (!await button(name).isVisible()) await button("Weitere Bereiche öffnen").click();
  await button(name).click();
}
async function openCollection(title) {
  await navigate("Lernsammlungen");
  await page.locator(".collection-card").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).click();
  return page.getByRole("article", { name: `Lernsammlung ${title}`, exact: true });
}
const topic = (id, title) => ({ id, title, description: title + " verstehen und einordnen.", color: "blue" });
const topics = [topic("agpm1-topic", "Projektmanagement"), topic("agile-umsetzung", "Agiles Projektmanagement"), topic("pm-klassisch", "Klassisches Projektmanagement"), topic("pm-hybrid", "Hybrides Projektmanagement"),
  topic("pm-agil-frameworks", "Frameworks & Methoden"), topic("pm-scrum", "Scrum"), topic("ki", "Künstliche Intelligenz"), topic("ki-machine-learning", "Machine Learning"),
  topic("ki-ml-supervised", "Supervised Learning"), topic("ki-ml-unsupervised", "Unsupervised Learning"), topic("ki-ml-self-supervised", "Self-Supervised Learning"), topic("ki-ml-reinforcement", "Reinforcement Learning"), topic("ki-sl-regression", "Regression"), topic("ki-sl-klassifikation", "Klassifikation"), topic("produktentwicklung", "Produktentwicklung")];
const timestamp = "2026-10-11T08:00:00.000Z";
const note = (id, topicId, title) => ({ id, topicId, title, summary: title, content: "## Einordnung\n\nEine nachvollziehbare Grundlage.", tags: [], relatedIds: [], favorite: false, archived: false, createdAt: timestamp, updatedAt: timestamp });
const notes = [note("agpm1-note-projektauftrag", "agpm1-topic", "Auftrag und Ziel klären"), note("agpm1-note-risiko", "pm-klassisch", "Risiken verstehen"), note("pm-note-klassisch", "pm-klassisch", "Klassische Phasen"), note("pm-note-hybrid", "pm-hybrid", "Vorgehensweisen kombinieren"), note("agpm1-note-manifest", "agile-umsetzung", "Agile Werte"), note("agpm1-note-scrum-ueberblick", "pm-scrum", "Scrum verstehen"),
  note("ki-note-ueberblick", "ki", "KI einordnen"), note("ki-note-machine-learning", "ki-machine-learning", "Lernen aus Daten"), note("ki-note-supervised", "ki-ml-supervised", "Lernen mit Zielwert"), note("ki-note-unsupervised", "ki-ml-unsupervised", "Muster entdecken"), note("ki-note-self-supervised", "ki-ml-self-supervised", "Trainingsziele aus Daten"), note("ki-note-reinforcement", "ki-ml-reinforcement", "Aus Belohnungen lernen"),
  note("excluded-supervised", "ki-ml-supervised", "Außerhalb dieser Lernsammlung"), note("agpm1-note-produktvision", "produktentwicklung", "Produktvision")];
const cards = [{ id: "hierarchy-card", noteId: notes[0].id, question: "Was klärt der Auftrag?", answer: "Ziel und Rahmen.", dueAt: timestamp, intervalDays: 7, reviews: 4, priority: 1 }];
const paths = [{ id: "hierarchy-path", title: "Ziele erklären", description: "", steps: [{ id: "hierarchy-step", noteId: notes[0].id, objective: "Den Auftrag erklären." }] }];
const fixture = { schemaVersion: 1, topics, notes, cards, paths, completedStepIds: ["hierarchy-step"], quizQuestions: [], quizRuns: [], learningReminders: [], learningCollections: [] };
const dialog = page.getByRole("dialog", { name: "Themenstruktur übernehmen", exact: true });
try {
  await page.goto(origin, { waitUntil: "networkidle" });
  initial = (await snapshot()).workspace;
  await write(fixture);
  await page.reload({ waitUntil: "networkidle" });
  await navigate("Lernsammlungen");
  await button("Themenstruktur prüfen").click();
  await expect(dialog).toContainText("Künstliche Intelligenz › Machine Learning › Self-Supervised Learning");
  await expect(dialog).toContainText("Projektmanagement › Gemeinsame Grundlagen");
  assert.deepEqual((await snapshot()).workspace, fixture, "Preview changes no stored data");

  console.log("Checking failed save and concurrent revision conflict");
  await page.route("**/api/brain", route => route.request().method() === "PUT" ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Lokale Speicherprüfung" }) }) : route.continue());
  await dialog.getByRole("button", { name: "Struktur übernehmen", exact: true }).click();
  await expect(page.locator(".error-banner")).toContainText("Lokale Speicherprüfung");
  await expect(dialog).toBeVisible();
  assert.deepEqual((await snapshot()).workspace, fixture);
  await page.unroute("**/api/brain");
  await write(fixture);
  await dialog.getByRole("button", { name: "Struktur übernehmen", exact: true }).click();
  await expect(page.locator(".error-banner")).toBeVisible();
  assert.deepEqual((await snapshot()).workspace, fixture);
  await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(button("Aktuellen Stand laden")).toBeVisible();
  await button("Aktuellen Stand laden").click();
  await button("Themenstruktur prüfen").click();
  await dialog.getByRole("button", { name: "Struktur übernehmen", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const saved = (await snapshot()).workspace;
  assert.equal(saved.topics.find(topic => topic.id === "ki-machine-learning").parentId, "ki");
  assert.equal(saved.notes.find(note => note.id === "agpm1-note-risiko").topicId, "pm-grundlagen");
  for (const key of ["cards", "paths", "completedStepIds", "learningCollections"]) assert.deepEqual(saved[key], fixture[key]);
  assert.deepEqual(saved.notes.map(note => ({ ...note, topicId: fixture.notes.find(original => original.id === note.id).topicId })), fixture.notes);
  await page.reload({ waitUntil: "networkidle" });
  assert.deepEqual((await snapshot()).workspace, saved, "Hierarchy survives reload");
  await expect(button("Themenstruktur prüfen")).toHaveCount(0);

  console.log("Checking project approaches and framework depth");
  const pm = await openCollection("Projektmanagement");
  const branches = pm.locator(".collection-topic-branch-card");
  await expect(pm.locator(".collection-topic-group").first().locator("strong")).toHaveText(["Gemeinsame Grundlagen", "Agiles Projektmanagement", "Klassisches Projektmanagement", "Hybrides Projektmanagement"]);
  await expect(pm.locator(".collection-topic-group").last()).toContainText("Übergreifende Fachthemen");
  await expect(pm.locator(".collection-topic-group").last().locator("strong")).toHaveText(["Produktentwicklung"]);
  await branches.filter({ hasText: "Gemeinsame Grundlagen" }).click();
  await expect(pm.locator(".collection-note-list article")).toHaveCount(2);
  await pm.getByRole("navigation", { name: "Themenpfad der Lernsammlung", exact: true }).getByRole("button", { name: "Projektmanagement", exact: true }).last().click();
  await branches.filter({ hasText: "Agiles Projektmanagement" }).click();
  await expect(branches.locator("strong")).toHaveText(["Frameworks & Methoden"]);
  await branches.first().click();
  await expect(branches.locator("strong")).toHaveText(["Scrum"]);
  await branches.first().click();
  await expect(pm.locator(".collection-note-list strong")).toHaveText("Scrum verstehen");

  console.log("Checking all four learning paradigms, collection scope and mobile layouts");
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const ai = await openCollection("Künstliche Intelligenz");
    const aiBranches = ai.locator(".collection-topic-branch-card");
    await expect(aiBranches.locator("strong")).toHaveText(["Machine Learning"]);
    await expect(ai.locator(".collection-note-list strong")).toHaveText("KI einordnen");
    await aiBranches.first().click();
    await expect(aiBranches.locator("strong")).toHaveText(["Supervised Learning", "Unsupervised Learning", "Self-Supervised Learning", "Reinforcement Learning"]);
    await expect(aiBranches.first()).toContainText("1 Notiz");
    await expect(ai.locator(".collection-note-list strong")).toHaveText("Lernen aus Daten");
    await ai.getByRole("button", { name: "Alle 5 Einträge anzeigen", exact: true }).click();
    await expect(ai.locator(".collection-note-list article")).toHaveCount(5);
    await expect(ai).not.toContainText("Außerhalb dieser Lernsammlung");
    await ai.getByRole("button", { name: "Nur diese Ebene anzeigen", exact: true }).click();
    for (const [title, text] of [["Supervised Learning", "Lernen mit Zielwert"], ["Unsupervised Learning", "Muster entdecken"], ["Self-Supervised Learning", "Trainingsziele aus Daten"], ["Reinforcement Learning", "Aus Belohnungen lernen"]]) {
      await aiBranches.filter({ has: page.getByText(title, { exact: true }) }).click();
      await expect(ai.locator(".collection-note-list strong")).toHaveText(text);
      await expect(ai.getByRole("navigation", { name: "Themenpfad der Lernsammlung", exact: true })).toContainText(title);
      if (title === "Supervised Learning") {
        await expect(aiBranches.locator("strong")).toHaveText(["Regression", "Klassifikation"]);
        await expect(aiBranches.first()).toContainText("0 Notizen");
        await aiBranches.first().click();
        await expect(ai).toContainText("Auf dieser Ebene sind in der Sammlung noch keine Notizen enthalten.");
        await ai.getByRole("navigation", { name: "Themenpfad der Lernsammlung", exact: true }).getByRole("button", { name: "Supervised Learning", exact: true }).click();
      }
      await ai.getByRole("navigation", { name: "Themenpfad der Lernsammlung", exact: true }).getByRole("button", { name: "Machine Learning", exact: true }).click();
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Page fits at ${width}px`);
    for (const element of await ai.locator(".collection-topic-branch-card, .collection-topic-breadcrumb, .collection-note-list, .collection-content-heading").all()) {
      const bounds = await element.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
      assert.equal(await element.evaluate(node => node.scrollWidth > node.clientWidth + 1), false);
    }
    await mkdir(".sites-runtime/qa", { recursive: true });
    await page.screenshot({ path: `.sites-runtime/qa/topic-structure-${width}.png`, fullPage: true, animations: "disabled" });
  }
  assert.deepEqual((await snapshot()).workspace, saved, "Navigation changes no stored progress or membership");
  assert.deepEqual(errors, []);
  console.log("PASS: preview, failures, conflicts, persistence, PM and ML hierarchies, collection boundaries and 320/390/768/1440px layouts");
} finally {
  try { if (initial) await write(initial); } finally { await browser.close(); }
}
