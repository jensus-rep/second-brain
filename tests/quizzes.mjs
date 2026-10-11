import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Quiz tests may only mutate localhost.");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("dialog", dialog => dialog.accept());
const snapshot = async () => { const response = await page.request.get(origin + "/api/brain"); assert.equal(response.status(), 200); return response.json(); };
const write = async workspace => { const current = await snapshot(); const response = await page.request.put(origin + "/api/brain", { data: { revision: current.revision, workspace } }); assert.equal(response.status(), 200); };
const openTests = async () => { await page.getByRole("button", { name: "Tests & Übungen", exact: true }).click(); await page.locator(".quizzes, .quiz-session").first().waitFor(); };
const reload = async () => { await page.reload({ waitUntil: "networkidle" }); await openTests(); };
let initial;
try {
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Dein Wissen", exact: true }).waitFor();
  initial = (await snapshot()).workspace;
  await write({ ...initial, quizQuestions: [], quizRuns: [], learningReminders: [] });
  await reload();
  assert.equal(await page.getByRole("button", { name: "Übungsrunde starten" }).isDisabled(), true);
  await page.getByRole("button", { name: "Beispiele hinzufügen" }).click();
  await page.getByText("Beispielaufgaben hinzugefügt", { exact: true }).waitFor();
  assert.equal((await snapshot()).workspace.quizQuestions.length, 12);
  await page.getByRole("button", { name: "Übungsrunde starten" }).click();
  await page.getByRole("heading", { name: /^Aufgabe 1:/ }).waitFor();
  let current = await snapshot();
  let run = current.workspace.quizRuns.at(-1);
  assert.equal(run.questions.length, 2);
  assert.ok(run.questions.every(q => q.difficulty === 1));
  const first = run.questions[0];
  const wrong = first.options.find(o => !first.correctOptionIds.includes(o.id));
  await page.getByRole("checkbox", { name: wrong.text, exact: true }).check();
  await page.getByRole("button", { name: "Bestätigen", exact: true }).click();
  await page.getByRole("heading", { name: "Nicht ganz richtig" }).waitFor();
  await page.getByText(wrong.feedback, { exact: true }).waitFor();
  // The answers stay in place and are marked: own wrong choice with its feedback, missed correct answers.
  const reviewList = page.getByRole("list", { name: "Antwortmöglichkeiten mit Lösung" });
  assert.equal(await reviewList.getByRole("listitem").count(), first.options.length);
  assert.match(await reviewList.getByRole("listitem").filter({ hasText: wrong.text }).innerText(), /Deine Wahl · falsch/);
  for (const option of first.options.filter(o => first.correctOptionIds.includes(o.id))) assert.match(await reviewList.getByRole("listitem").filter({ hasText: option.text }).innerText(), /Richtige Antwort · nicht gewählt/);
  await page.waitForFunction(() => document.activeElement?.textContent?.includes("Nächste Aufgabe"));
  await page.getByLabel("Mein Denkfehler / Merksatz").fill("Ich habe Arbeitsmenge und Lernziel verwechselt.");
  await page.getByRole("button", { name: "Merksatz speichern" }).click();
  await page.getByText("Denkfehler gespeichert", { exact: true }).waitFor();
  await reload();
  assert.equal(await page.getByLabel("Mein Denkfehler / Merksatz").inputValue(), "Ich habe Arbeitsmenge und Lernziel verwechselt.");
  await page.getByRole("button", { name: "Nächste Aufgabe" }).click();
  await page.getByRole("heading", { name: /^Aufgabe 2:/ }).waitFor();
  // Keyboard only: digits toggle answers; the final confirmation opens the result.
  const second = run.questions[1];
  for (const [i, option] of second.options.entries()) if (second.correctOptionIds.includes(option.id)) await page.keyboard.press(String(i + 1));
  for (const option of second.options) assert.equal(await page.getByRole("checkbox", { name: option.text, exact: true }).isChecked(), second.correctOptionIds.includes(option.id));
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Richtig beantwortet" }).waitFor();
  await page.getByRole("heading", { name: "1 von 2 richtig · 50 %" }).waitFor();
  assert.ok((await snapshot()).workspace.quizRuns.find(item => item.id === run.id).finishedAt);

  // Reminder survives reload, appears on the home page and exports an actual alarm.
  const due = new Date(Date.now() + 86400000);
  const pad = n => String(n).padStart(2, "0");
  const localDate = `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}T${pad(due.getHours())}:${pad(due.getMinutes())}`;
  await page.getByLabel("Erinnerungstermin").fill(localDate);
  await page.getByRole("button", { name: "Erinnerung speichern" }).click();
  await page.getByText("Lernerinnerung gespeichert", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Mein Überblick", exact: true }).click();
  await page.getByRole("region", { name: "Lernerinnerungen" }).waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Kalenderexport für Projektmanagement" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let calendar = ""; for await (const chunk of stream) calendar += chunk.toString();
  assert.match(calendar, /BEGIN:VALARM/); assert.match(calendar, /DTSTART:/);
  await reload();
  await page.getByRole("button", { name: /^Fehlerjournal öffnen/ }).click();
  await page.getByRole("region", { name: "Fehlerjournal" }).getByText(first.prompt, { exact: true }).waitFor();
  assert.equal((await snapshot()).workspace.learningReminders.length, 1);

  // Full simulation: exact multi-select scoring, hidden solutions, editable answers.
  await page.getByLabel("Fachthema für den Test").selectOption("Produktmanagement");
  await page.getByLabel("Modus", { exact: true }).selectOption("exam");
  await page.getByLabel("Aufgabenanzahl").selectOption("6");
  await page.getByLabel("Zeitlimit").selectOption("0");
  await page.getByRole("button", { name: "Simulation starten" }).click();
  await page.getByRole("heading", { name: /^Aufgabe 1:/ }).waitFor();
  run = (await snapshot()).workspace.quizRuns.at(-1);
  // Keep one question open to verify editable saved answers and conflict recovery.
  for (let i = 0; i < run.questions.length - 1; i++) {
    const q = run.questions[i];
    await page.getByRole("heading", { name: new RegExp(`^Aufgabe ${i + 1}:`) }).waitFor();
    for (const option of q.options.filter(o => q.correctOptionIds.includes(o.id))) await page.getByRole("checkbox", { name: option.text, exact: true }).check();
    await page.getByRole("button", { name: "Antwort speichern", exact: true }).click();
    await page.waitForFunction(async ({ origin, id, length }) => {
      const data = await (await fetch(origin + "/api/brain")).json();
      return data.workspace.quizRuns.find(r => r.id === id)?.answers.length === length;
    }, { origin, id: run.id, length: i + 1 });
    assert.equal(await page.getByRole("region", { name: "Auswertung", exact: true }).count(), 0);
  }
  await reload();
  await page.getByRole("button", { name: "Aufgabe 1, beantwortet", exact: true }).click();
  for (const option of run.questions[0].options.filter(o => run.questions[0].correctOptionIds.includes(o.id))) assert.equal(await page.getByRole("checkbox", { name: option.text, exact: true }).isChecked(), true);
  // Check conflict behavior with an unsaved answer selection still visible.
  const external = await snapshot();
  await write(external.workspace);
  await page.getByRole("button", { name: "Antwort speichern", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "anderen Fenster" }).waitFor();
  for (const option of run.questions[0].options.filter(o => run.questions[0].correctOptionIds.includes(o.id))) assert.equal(await page.getByRole("checkbox", { name: option.text, exact: true }).isChecked(), true);
  await page.getByRole("button", { name: "Aktuellen Stand laden" }).click();
  await page.getByRole("heading", { name: /^Aufgabe 1:/ }).waitFor();
  const finalQuestion = run.questions.at(-1);
  await page.getByRole("button", { name: `Aufgabe ${run.questions.length}`, exact: true }).click();
  for (const option of finalQuestion.options.filter(option => finalQuestion.correctOptionIds.includes(option.id))) await page.getByRole("checkbox", { name: option.text, exact: true }).check();
  await page.getByRole("button", { name: "Antwort speichern", exact: true }).click();
  await page.getByRole("heading", { name: "6 von 6 richtig · 100 %" }).waitFor();
  assert.ok((await snapshot()).workspace.quizRuns.find(item => item.id === run.id).finishedAt);
  await page.getByRole("button", { name: "Zur Testübersicht" }).click();

  // Create and edit a custom question without rewriting historical snapshots.
  await page.getByRole("button", { name: "Neue Testaufgabe" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Fachthema", { exact: true }).fill("Eigene Aufgaben");
  await dialog.getByLabel("Lernbereich", { exact: true }).fill("Prioritäten");
  await dialog.getByLabel("Fragestellung", { exact: true }).fill("Welches Ergebnis ist vereinbart?");
  for (let i = 1; i <= 4; i++) await dialog.getByLabel("Antwort " + i, { exact: true }).fill("Möglichkeit " + i);
  await dialog.getByLabel("Erklärung und Lerntipp").fill("Prüfe das gemeinsame Ziel.");
  await dialog.getByRole("button", { name: "Aufgabe speichern" }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal((await snapshot()).workspace.quizQuestions.length, 13);

  // Expired simulations finalize automatically, including after a reload.
  current = await snapshot();
  const expired = { ...run, id: "expired-test", answers: [], startedAt: new Date(Date.now() - 120000).toISOString(), deadlineAt: new Date(Date.now() - 60000).toISOString(), finishedAt: null };
  await write({ ...current.workspace, quizRuns: [...current.workspace.quizRuns, expired] });
  await reload();
  await page.getByRole("heading", { name: "0 von 6 richtig · 0 %" }).waitFor();
  assert.ok((await snapshot()).workspace.quizRuns.find(r => r.id === "expired-test").finishedAt);
  await page.getByRole("button", { name: "Zur Testübersicht" }).click();

  await mkdir(".sites-runtime/qa", { recursive: true });
  await page.screenshot({ path: ".sites-runtime/qa/quizzes-desktop.png", fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Quiz view should fit ${width}px`);
  }
  await page.screenshot({ path: ".sites-runtime/qa/quizzes-mobile.png", fullPage: true });
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log("PASS: examples, durable practice and error journal, simulation, multi-select, conflict recovery, custom questions, timer, reminders, calendar and mobile layout.");
} finally {
  if (initial) await write(initial);
  await browser.close();
}
