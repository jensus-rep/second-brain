import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import { emptyWorkspace } from "../lib/brain/model.ts";

const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Navigation tests only use localhost.");
const now = new Date().toISOString();
const script = {
  id: "qa-chapter-navigation", title: "QA Kapitelwechsel", summary: "Synthetisches Prüfskript", introduction: "",
  topicId: null, tags: [], status: "ready", createdAt: now, updatedAt: now, readingPosition: null,
  chapters: ["Anfang", "Mitte", "Ende"].map((title, index) => ({ id: "qa-chapter-" + index, title, content: ("Lesetext zum Prüfen.\n\n").repeat(100), sources: [] })),
};
let snapshot = { revision: 1, workspace: { ...emptyWorkspace, scripts: [script] } };
let mode = "normal";
let releaseSave;
let writes = 0;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
try {
  // Every workspace request is intercepted; no existing collection is read or changed.
  await page.route("**/api/brain", async route => {
    const request = route.request();
    if (request.method() === "GET") return route.fulfill({ json: snapshot });
    assert.equal(request.method(), "PUT");
    writes++;
    if (mode === "delayed") await new Promise(resolve => { releaseSave = resolve; });
    if (mode === "failure") return route.fulfill({ status: 503, json: { error: "QA: Speicherung vorübergehend nicht erreichbar." } });
    const bytes = request.postDataBuffer();
    const body = JSON.parse((request.headers()["content-encoding"] === "gzip" ? gunzipSync(bytes) : bytes).toString());
    assert.equal(body.revision, snapshot.revision);
    snapshot = { revision: snapshot.revision + 1, workspace: body.workspace };
    await route.fulfill({ json: { revision: snapshot.revision } });
  });
  await page.goto(origin + "/#script=" + script.id, { waitUntil: "networkidle" });
  const reader = page.locator(".script-reader");
  const title = reader.locator(".script-chapter-title");
  const outline = reader.locator(".script-outline ol button");
  await expect(title).toHaveText("Anfang");
  mode = "delayed";
  await reader.getByRole("button", { name: "Nächstes Kapitel", exact: true }).click();
  await expect.poll(() => !!releaseSave).toBe(true);
  await expect(title).toHaveText("Mitte", { timeout: 1500 });
  await outline.nth(2).click();
  await expect(title).toHaveText("Ende");
  mode = "normal"; releaseSave(); releaseSave = null;
  await expect.poll(() => snapshot.workspace.scripts[0].readingPosition?.chapterId).toBe("qa-chapter-2");
  await page.reload({ waitUntil: "networkidle" });
  await expect(title).toHaveText("Ende");

  mode = "failure";
  await reader.getByRole("button", { name: "Vorheriges Kapitel", exact: true }).click();
  await expect(title).toHaveText("Mitte");
  await expect(reader.getByRole("status")).toContainText("Leseposition konnte nicht gespeichert werden");
  assert.equal(snapshot.workspace.scripts[0].readingPosition.chapterId, "qa-chapter-2");
  mode = "normal";
  await reader.getByRole("button", { name: "Leseposition erneut speichern", exact: true }).click();
  await expect.poll(() => snapshot.workspace.scripts[0].readingPosition?.chapterId).toBe("qa-chapter-1");
  await expect(reader.getByRole("status")).toHaveCount(0);
  await page.reload({ waitUntil: "networkidle" });
  await expect(title).toHaveText("Mitte");
  await reader.getByRole("button", { name: "Vorheriges Kapitel", exact: true }).click();
  await expect(title).toHaveText("Anfang");
  await expect(reader.getByRole("button", { name: "Vorheriges Kapitel", exact: true })).toBeDisabled();
  await expect.poll(() => snapshot.workspace.scripts[0].readingPosition?.chapterId).toBe("qa-chapter-0");
  await outline.nth(0).click();
  await reader.locator(".script-scroll").evaluate(element => { element.scrollTop = (element.scrollHeight - element.clientHeight) / 2; });
  await expect.poll(() => snapshot.workspace.scripts[0].readingPosition?.offset ?? 0).toBeGreaterThan(0.4);
  await outline.nth(2).click();
  await expect(title).toHaveText("Ende");
  await expect(reader.getByRole("button", { name: "Nächstes Kapitel", exact: true })).toBeDisabled();
  await expect.poll(() => snapshot.workspace.scripts[0].readingPosition?.chapterId).toBe("qa-chapter-2");
  await page.setViewportSize({ width: 390, height: 844 });
  await reader.getByRole("button", { name: /Inhalts\u00fcbersicht/ }).click();
  await outline.nth(1).click();
  await expect(title).toHaveText("Mitte");
  await expect(reader.locator(".script-outline-content")).not.toBeVisible();
  await reader.getByRole("button", { name: "N\u00e4chstes Kapitel", exact: true }).press("Enter");
  await expect(title).toHaveText("Ende");
  await expect.poll(() => snapshot.workspace.scripts[0].readingPosition?.chapterId).toBe("qa-chapter-2");
  assert.deepEqual(errors, []);
  assert.ok(writes >= 6);
  console.log("Kapitelwechsel: verzögerte Speicherung, schnelle Auswahl, Speicherfehler, erneutes Speichern, Scrollposition und Wiederaufnahme geprüft.");
} finally {
  if (releaseSave) releaseSave();
  await browser.close();
}
