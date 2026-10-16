import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

// Every mutation must target loopback and match the selected local SQLite file.
const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Exam simulation tests may only mutate localhost.");
const api = origin + "/api/brain";
const sqlitePath = resolve(process.env.BRAIN_TEST_SQLITE_PATH ?? process.env.NEWHOPE_SQLITE_PATH ?? ".data/newhope.sqlite");
const screenshots = process.env.BRAIN_TEST_SCREENSHOTS;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Berlin" });
page.setDefaultTimeout(20000);
page.setDefaultNavigationTimeout(90000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));

const subject = "Projektmanagement";
const concepts = ["Grundlagen", "Stakeholder", "Planung", "Risiken"];
const timestamp = new Date().toISOString();
const questions = concepts.flatMap(concept => Array.from({ length: 8 }, (_, index) => ({
  id: `exam-${concepts.indexOf(concept)}-${index}`, subject, concept, difficulty: index % 3 + 1, prompt: `${concept}: Prüfungsaufgabe ${index + 1}`,
  options: [{ id: "right", text: "Zutreffend", feedback: "Passt." }, { id: "wrong", text: "Unzutreffend", feedback: "Passt nicht." }, { id: "part", text: "Nur teilweise", feedback: "Unvollständig." }],
  correctOptionIds: ["right"], explanation: "Die Begründung steht in der Erklärung.", source: "",
})));
const collection = { id: "exam-collection", title: "Prüfungsvorbereitung", description: "", noteIds: [], cardIds: [], questionIds: questions.map(question => question.id), pathIds: [] };
const fixture = { schemaVersion: 1, topics: [], notes: [], paths: [], completedStepIds: [], cards: [], quizQuestions: questions, quizRuns: [], learningReminders: [], learningCollections: [collection], learningFocus: { collectionId: collection.id, subject, updatedAt: timestamp } };
let initial;

const button = (name, scope = page) => scope.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
async function click(name, scope = page) {
  const target = button(name, scope);
  await expect(target).toBeEnabled();
  await target.click();
}
async function snapshot() {
  const response = await page.request.get(api);
  assert.equal(response.status(), 200);
  return response.json();
}
async function verifyLocal(current) {
  assert.equal((await realpath(sqlitePath)).toLowerCase(), sqlitePath.toLowerCase());
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const row = db.prepare("SELECT revision FROM newhope_workspaces WHERE owner_id = ?").get("local_dev");
    assert.equal(row?.revision, current.revision, "The running API must use the selected local SQLite database.");
  } finally { db.close(); }
}
async function write(workspace) {
  const before = await snapshot();
  await verifyLocal(before);
  const response = await page.request.put(api, { data: { workspace, revision: before.revision } });
  assert.equal(response.status(), 200, await response.text());
}
const simulations = async () => (await snapshot()).workspace.quizRuns.filter(run => run.examSimulation);
async function noHorizontalScroll(label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `${label}: page scrolls horizontally by ${overflow}px`);
}
async function shot(name) { if (screenshots) await page.screenshot({ path: resolve(screenshots, name), fullPage: true, animations: "disabled" }); }

try {
  const loaded = await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(loaded?.status(), 200);
  initial = (await snapshot()).workspace;
  await write(structuredClone(fixture));
  await page.reload({ waitUntil: "networkidle" });
  await click("Tutor");
  const tutor = page.locator(".learning-tutor");
  await expect(tutor).toBeVisible();

  console.log("Planning the first simulation in the tutor");
  await tutor.getByRole("tab", { name: "Prüfungssimulation", exact: true }).click();
  await expect(tutor.getByRole("heading", { name: "30 Aufgaben unter Prüfungsbedingungen", exact: true })).toBeVisible();
  await expect(tutor.getByLabel("Zeitlimit der Simulation", { exact: true })).toHaveValue("60");
  await tutor.getByLabel("Aufgaben in der Simulation", { exact: true }).selectOption("10");
  await expect(tutor.getByRole("heading", { name: "10 Aufgaben unter Prüfungsbedingungen", exact: true })).toBeVisible();
  await expect(tutor.getByLabel("Zeitlimit der Simulation", { exact: true })).toHaveValue("30");
  await tutor.getByLabel("Zeitlimit der Simulation", { exact: true }).selectOption("0");
  const mix = tutor.getByRole("list", { name: "Zusammensetzung der Simulation", exact: true });
  await expect(mix).toContainText("0frühere Fehler");
  await expect(mix).toContainText("10noch nicht bearbeitet");
  await shot("exam-tutor-start.png");

  console.log("Answering the simulation without automatic submission");
  await click("Simulation starten", tutor);
  await expect.poll(async () => (await simulations()).length).toBe(1);
  const [started] = await simulations();
  assert.equal(started.questions.length, 10);
  assert.equal(started.deadlineAt, null);
  assert.equal(started.finishedAt, null);
  assert.equal(started.collectionId, collection.id);
  assert.deepEqual([...new Set(started.questions.map(question => question.concept))].sort(), [...concepts].sort());
  await expect(page.locator(".quiz-session-top")).toContainText("Prüfungssimulation");
  await expect(page.getByRole("navigation", { name: "Aufgaben im Test" }).getByRole("button")).toHaveCount(10);
  const wrongIds = [];
  for (let index = 0; index < 10; index++) {
    const heading = page.locator("form.quiz-question h2");
    const prompt = (await heading.textContent()).replace(/^Aufgabe \d+: /, "");
    const question = started.questions.find(item => item.prompt === prompt);
    assert.ok(question, `Unknown task: ${prompt}`);
    const answer = index % 2 ? "Unzutreffend" : "Zutreffend";
    if (index % 2) wrongIds.push(question.id);
    await page.locator("form.quiz-question label.quiz-option").filter({ hasText: new RegExp(`^${answer}`) }).click();
    await click("Antwort speichern");
    if (index < 9) await expect(heading).not.toHaveText(`Aufgabe ${started.questions.indexOf(question) + 1}: ${prompt}`);
  }
  await expect(page.getByRole("status").filter({ hasText: "Alle 10 Aufgaben sind beantwortet." })).toBeVisible();
  await expect.poll(async () => (await simulations())[0].answers.length).toBe(10);
  assert.equal((await simulations())[0].finishedAt, null, "A simulation waits for its explicit submission.");
  await shot("exam-session-complete.png");

  console.log("Submitting and reading the evaluation");
  await click("Jetzt abgeben");
  await expect.poll(async () => !!(await simulations())[0].finishedAt).toBe(true);
  const report = page.locator(".exam-report");
  await expect(report.getByRole("heading", { name: "Auswertung nach Lernbereichen", exact: true })).toBeVisible();
  await expect(page.locator(".quiz-result-summary")).toContainText("5 von 10 richtig");
  await expect(report).toContainText("PRÜFUNGSSIMULATION 1");
  await expect(report.getByRole("region", { name: "Ergebnis nach bisherigem Lernstand" })).toContainText("5 von 10 richtig");
  await expect(page.locator(".quiz-result-next")).toContainText("So geht es weiter");
  await shot("exam-result.png");

  console.log("Planning the adapted next simulation");
  await click("Nächste Simulation ansehen");
  await expect(tutor.getByRole("tab", { name: "Prüfungssimulation", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(tutor.getByRole("heading", { name: "30 Aufgaben unter Prüfungsbedingungen", exact: true })).toBeVisible();
  await expect(tutor.locator(".tutor-exam-step .eyebrow")).toHaveText("PRÜFUNGSSIMULATION 2");
  await expect(mix).toContainText("5frühere Fehler");
  await expect(mix).toContainText("22noch nicht bearbeitet");
  await expect(mix).toContainText("3zuletzt richtig");
  const history = tutor.getByRole("list", { name: "Ergebnisse deiner Prüfungssimulationen" });
  await expect(history).toContainText("Simulation 1");
  await expect(history).toContainText("50 %");
  await expect(tutor.locator(".tutor-guided-progress").filter({ visible: true })).toContainText("10 von 32 Aufgaben");
  await shot("exam-tutor-next.png");

  console.log("Weak answers from the simulation steer the short units");
  await tutor.getByRole("tab", { name: "Kurze Einheiten", exact: true }).click();
  await expect(tutor.locator(".tutor-guided-step")).toContainText("noch Testantworten falsch");

  console.log("Checking the mobile layout");
  await page.setViewportSize({ width: 390, height: 860 });
  await tutor.getByRole("tab", { name: "Prüfungssimulation", exact: true }).click();
  await expect(history).toBeVisible();
  await noHorizontalScroll("Tutor simulation tab");
  await shot("exam-tutor-mobile.png");
  await history.getByRole("button", { name: /Simulation 1 vom .*: Auswertung ansehen/ }).click();
  await expect(page.locator(".exam-report")).toBeVisible();
  await noHorizontalScroll("Simulation result");
  await shot("exam-result-mobile.png");

  assert.deepEqual(errors, []);
  console.log("Exam simulation checks passed");
} finally {
  if (initial) await write(initial).catch(error => console.error("Restoring the local workspace failed:", error));
  await browser.close();
}
