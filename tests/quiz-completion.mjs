import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Quiz completion tests only mutate localhost.");
const api = origin + "/api/brain";
const sqlitePath = resolve(process.env.BRAIN_TEST_SQLITE_PATH ?? ".data/newhope.sqlite");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let initial;
async function snapshot() {
  const response = await page.request.get(api);
  assert.equal(response.status(), 200);
  return response.json();
}
async function verifyLocal(current) {
  assert.equal((await realpath(sqlitePath)).toLowerCase(), sqlitePath.toLowerCase());
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const row = db.prepare("SELECT body, revision FROM newhope_workspaces WHERE owner_id = ?").get("local_dev");
    assert.equal(row?.revision, current.revision);
    const stored = JSON.parse(row.body);
    for (const key of ["cards", "quizQuestions", "quizRuns", "learningReminders", "learningCollections"]) stored[key] ??= [];
    assert.deepEqual(stored, current.workspace);
  } finally { db.close(); }
}
async function write(workspace) {
  const before = await snapshot();
  await verifyLocal(before);
  const response = await page.request.put(api, { data: { revision: before.revision, workspace } });
  assert.equal(response.status(), 200);
}
const subject = "Projektmanagement";
const questions = [1, 2].map(index => ({
  id: "completion-question-" + index, subject, concept: "Projektziele", difficulty: 1,
  prompt: "Wie wird das Ziel in Situation " + index + " überprüfbar?",
  options: [{ id: "yes", text: "Mit vereinbarten Kriterien", feedback: "Kriterien schaffen Klarheit." }, { id: "no", text: "Ohne Kriterien", feedback: "Ohne Kriterien fehlt der Vergleich." }],
  correctOptionIds: ["yes"], explanation: "Das Ergebnis wird an den vereinbarten Kriterien geprüft.", source: "",
}));
async function openRun(mode, timed = false) {
  const startedAt = new Date().toISOString();
  const run = { id: "completion-" + mode + (timed ? "-timed" : ""), subject, mode, startedAt,
    deadlineAt: timed ? new Date(Date.now() + 600000).toISOString() : null, finishedAt: null, questions, answers: [] };
  await write({ schemaVersion: 1, topics: [], notes: [], paths: [], completedStepIds: [], cards: [], quizQuestions: questions,
    quizRuns: [run], learningReminders: [], learningCollections: [] });
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Tests & Übungen", exact: true }).filter({ visible: true }).first().click();
  await expect(page.locator(".quiz-question")).toContainText(questions[0].prompt);
  return run;
}
const confirm = () => page.getByRole("button", { name: /^(Bestätigen|Antwort speichern)$/, exact: true });
async function answer() {
  await page.getByRole("checkbox", { name: questions[0].options[0].text, exact: true }).check();
  const responded = page.waitForResponse(response => response.url() === api && response.request().method() === "PUT");
  await confirm().click();
  assert.equal((await responded).status(), 200);
  await expect(page.locator(".save-state")).toHaveText("Gespeichert");
}
try {
  await page.goto(origin, { waitUntil: "networkidle" });
  initial = (await snapshot()).workspace;
  await verifyLocal(await snapshot());
  for (const [mode, timed] of [["practice", false], ["exam", false], ["exam", true]]) {
    console.log("Checking automatic last-answer completion", mode, timed ? "with timer" : "without timer");
    const run = await openRun(mode, timed);
    if (mode === "exam") {
      // Answer the last displayed question first: an unanswered earlier task keeps the test open.
      await page.getByRole("button", { name: "Aufgabe 2", exact: true }).click();
      await answer();
      assert.equal((await snapshot()).workspace.quizRuns[0].finishedAt, null);
      await expect(page.locator(".quiz-result-summary")).toHaveCount(0);
      await page.getByRole("button", { name: "Aufgabe 1", exact: true }).click();
    } else {
      await answer();
      await expect(page.locator(".quiz-verdict")).toBeVisible();
      await page.getByRole("button", { name: "Nächste Aufgabe", exact: true }).click();
    }
    const before = await snapshot();
    if (mode === "exam" && !timed) {
      await page.getByRole("checkbox", { name: questions[0].options[0].text, exact: true }).check();
      const failed = async route => route.request().method() === "PUT"
        ? route.fulfill({ status: 503, json: { error: "Lokaler Test: Antwort nicht gespeichert." } }) : route.continue();
      await page.route(api, failed);
      try {
        const rejected = page.waitForResponse(response => response.url() === api && response.request().method() === "PUT");
        await confirm().click();
        assert.equal((await rejected).status(), 503);
        await expect(page.locator(".quiz-result-summary")).toHaveCount(0);
        assert.deepEqual(await snapshot(), before);
      } finally { await page.unroute(api, failed); }
    }
    await answer();
    await expect(page.locator(".quiz-result-summary")).toBeVisible();
    await expect(page.locator(".quiz-session, .quiz-config, .mobile-navigation")).toHaveCount(0);
    const after = await snapshot();
    assert.equal(after.revision, before.revision + 1);
    assert.equal(after.workspace.quizRuns[0].id, run.id);
    assert.equal(after.workspace.quizRuns[0].answers.length, 2);
    assert.ok(after.workspace.quizRuns[0].finishedAt);
    await verifyLocal(after);
  }
  assert.deepEqual(errors, []);
  console.log("Quiz completion browser tests passed.");
} finally {
  await page.unroute(api);
  if (initial) await write(initial);
  await browser.close();
}
