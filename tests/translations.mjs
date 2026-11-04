import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Translation tests may only change local test data.");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultNavigationTimeout(90000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let initial;
async function hoverWord(word) {
  await word.scrollIntoViewIfNeeded();
  const box = await word.boundingBox();
  assert.ok(box);
  // Continuous pointer motion also exercises the tooltip's hoverable gap.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
}
try {
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByText("Gespeichert", { exact: true }).waitFor();
  const snapshot = await (await page.request.get(origin + "/api/brain")).json();
  initial = snapshot.workspace;
  const now = new Date().toISOString();
  const note = {
    id: crypto.randomUUID(), title: "QA Indonesisch mit Übersetzungen", summary: "Sprachen direkt im Text lernen.",
    content: '1. Höre **nama, saya, belajar, mengerti, terima kasih**.\n2. Sage **Nama saya Jens. Saya baru mulai belajar bahasa Indonesia.**\n3. Lerne **Saya belum mengerti.** und **Bisa diulangi, tolong?** und **Apa arti kata ini?**\n\nEigene Übersetzung: [bonjour](#translation "Guten Tag").\n\n`saya` bleibt Code. [saya](https://example.com "Quelle") bleibt ein Link.\n\n[unsicher](javascript:alert%281%29)\n\n<script>alert(1)</script>',
    topicId: null, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: now, updatedAt: now,
  };
  const card = { id: crypto.randomUUID(), noteId: note.id, question: 'Übersetze: Saya belum mengerti. [bonjour](#translation "Guten Tag")', answer: "Saya belum mengerti.", dueAt: now, intervalDays: 0, reviews: 0 };
  const workspace = { ...initial, notes: [...initial.notes, note], cards: [...initial.cards, card] };
  assert.equal((await page.request.put(origin + "/api/brain", { headers: { Origin: origin }, data: { revision: snapshot.revision, workspace } })).status(), 200);
  await page.reload({ waitUntil: "networkidle" });
  await page.goto(origin + "/#note=" + note.id, { waitUntil: "networkidle" });
  const reader = page.getByRole("dialog", { name: note.title, exact: true });
  const saya = reader.locator("button.translation-term").filter({ hasText: /^saya$/i }).first();
  const tooltip = page.locator('[role="tooltip"]:not([data-state="closed"])');
  await hoverWord(saya);
  await expect(tooltip).toContainText("ich / mein");
  const focusBefore = await page.evaluate(() => document.activeElement?.className);
  await tooltip.hover();
  await expect(tooltip).toBeVisible();
  assert.equal(await page.evaluate(() => document.activeElement?.className), focusBefore, "Hover does not steal focus");
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);
  await expect(reader).toBeVisible();
  await page.mouse.move(0, 0);
  await saya.focus();
  await expect(tooltip).toContainText("ich / mein");
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);
  await expect(saya).toBeFocused();
  await hoverWord(reader.locator("button.translation-term").filter({ hasText: /^terima kasih$/i }));
  await expect(tooltip).toContainText("danke");
  await page.mouse.move(0, 0);
  await hoverWord(reader.getByRole("button", { name: "bonjour", exact: true }));
  await expect(tooltip).toContainText("Guten Tag");
  await expect(reader.locator("code .translation-term, a .translation-term, button button")).toHaveCount(0);
  await expect(reader.getByRole("link", { name: "saya", exact: true })).toHaveAttribute("href", "https://example.com");
  await expect(reader.getByRole("link", { name: "saya", exact: true })).toHaveAttribute("title", "Quelle");
  await expect(reader.locator('a[href^="javascript:"]')).toHaveCount(0);
  await mkdir(".sites-runtime/qa", { recursive: true });
  await page.screenshot({ path: ".sites-runtime/qa/translations-desktop.png", animations: "disabled" });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  mobile.setDefaultNavigationTimeout(90000);
  mobile.on("pageerror", error => errors.push(error.message));
  await mobile.goto(origin, { waitUntil: "networkidle" });
  await mobile.goto(origin + "/#note=" + note.id, { waitUntil: "networkidle" });
  const mobileReader = mobile.getByRole("dialog", { name: note.title, exact: true });
  const mobileWord = mobileReader.locator("button.translation-term").filter({ hasText: /^terima kasih$/i });
  await mobileWord.tap();
  await expect(mobile.getByRole("tooltip")).toContainText("danke");
  const box = await mobile.getByRole("tooltip").boundingBox();
  assert.ok(box && box.x >= 0 && box.x + box.width <= 390, "Translation stays within the mobile viewport");
  await mobile.screenshot({ path: ".sites-runtime/qa/translations-mobile.png", animations: "disabled" });
  await mobileWord.tap();
  await expect(mobile.getByRole("tooltip")).toHaveCount(0);
  await mobileWord.tap();
  await expect(mobile.getByRole("tooltip")).toBeVisible();
  await mobileReader.getByRole("heading", { name: note.title, exact: true }).tap();
  await expect(mobile.getByRole("tooltip")).toHaveCount(0);
  assert.equal(await mobileReader.locator(".entry-scroll").evaluate(el => el.scrollWidth > el.clientWidth), false);
  await mobile.close();

  await reader.getByRole("button", { name: "Zur Übersicht", exact: true }).click();
  await page.getByRole("button", { name: "Lernkarten", exact: true }).filter({ visible: true }).first().click();
  await page.locator(".flashcard-filters-disclosure > summary").click();
  await page.getByRole("textbox", { name: "Lernkarten durchsuchen", exact: true }).fill(note.title);
  await expect(page.locator(".flashcard-list article")).toHaveCount(1);
  await page.getByRole("button", { name: "Lernrunde starten", exact: true }).click();
  await expect(page.locator(".study-question")).toContainText("Saya belum mengerti.");
  await expect(page.locator(".study-question .translation-term")).toHaveCount(0);
  await page.getByRole("button", { name: "Antwort aufdecken", exact: true }).click();
  await expect(page.locator(".study-answer .translation-term")).toHaveCount(3);
  assert.deepEqual(errors, []);
  console.log("PASS: translation hover, focus, Escape, idioms, authored annotations, safe links/code, touch toggle, outside dismissal, mobile layout and no lookups before card reveal.");
} catch (error) {
  await mkdir(".sites-runtime/qa", { recursive: true });
  await page.screenshot({ path: ".sites-runtime/qa/translations-failure.png", fullPage: true });
  await writeFile(".sites-runtime/qa/translations-failure.html", await page.content());
  throw error;
} finally {
  if (initial) {
    const latest = await (await page.request.get(origin + "/api/brain")).json();
    assert.equal((await page.request.put(origin + "/api/brain", { headers: { Origin: origin }, data: { revision: latest.revision, workspace: initial } })).status(), 200);
  }
  await browser.close();
}
