import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { seedWorkspace } from "../lib/brain/seed.ts";
import { emptyWorkspace, workspaceSchema } from "../lib/brain/model.ts";
import { brainBody } from "./brain-request.mjs";

const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("UI checks must use localhost.");
// The browser exercises the real app with intercepted workspace requests.
// This check never writes to a database, including another local QA session.
const fixture = structuredClone(seedWorkspace);
fixture.topics.push({ id: "composition-child", title: "Gedanken strukturieren", description: "Zusammenhänge", color: "blue", parentId: fixture.topics[0].id });
fixture.notes[0].topicId = "composition-child";
fixture.notes[0].relatedIds = [fixture.notes[1].id];
fixture.notes.push({ ...fixture.notes[0], id: "composition-archive", title: "Archivierter Gedanke", archived: true });
fixture.paths[0].title = "Ein längerer Lernpfadtitel bleibt in der Seitenspalte gut lesbar";
let workspace = workspaceSchema.parse(fixture);
let revision = 7;
let writes = 0;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.setDefaultTimeout(15000);
await page.route("**/*", async route => {
  const url = new URL(route.request().url());
  if (["http:", "https:"].includes(url.protocol) && url.origin !== origin) return route.abort();
  if (url.pathname === "/api/brain") {
    if (route.request().method() === "PUT") {
      const submitted = brainBody(route.request());
      if (submitted.revision !== revision) return route.fulfill({ status: 409, json: { error: "Revision geändert" } });
      workspace = workspaceSchema.parse(submitted.workspace);
      revision++;
      writes++;
    }
    return route.fulfill({ json: { workspace, revision } });
  }
  if (url.pathname.startsWith("/api/tutor")) return route.fulfill({ json: { enabled: false } });
  return route.continue();
});
const navigation = name => page.locator('[data-slot="sidebar-content"]').getByRole("button", { name, exact: true });
async function home() {
  await page.goto(origin, { waitUntil: "networkidle" });
  await expect(page.locator(".home-workspace")).toBeVisible();
}
async function fits(width) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Page fits ${width}px`);
  const overflow = await page.locator(".home-workspace, .learning-overview, .learning-summary-stats, .home-side-column, .continue-strip, .collection-card, .note-row").evaluateAll(elements => elements.filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.className));
  assert.deepEqual(overflow, [], `Components fit ${width}px`);
}
try {
  await mkdir(".sites-runtime/qa", { recursive: true });
  await home();
  await expect(page.locator(".home-recent .note-row")).toHaveCount(5);
  await expect(page.locator(".home-recent .note-card")).toHaveCount(0);
  await expect(page.locator(".orientation-caption").first()).toContainText("6 aktive Einträge");
  const root = page.locator(".orientation-topic").filter({ hasText: fixture.topics[0].title });
  await expect(root).toContainText("Gedanken strukturieren");
  assert.equal((await root.locator(".orientation-topic-heading > span").last().textContent()).trim(), "2");
  const main = await page.locator(".home-main-column").boundingBox();
  const side = await page.locator(".home-side-column").boundingBox();
  assert.ok(side.x > main.x + main.width, "Orientation is alongside the main content on desktop");
  const pathTitle = await page.locator(".continue-strip h2").boundingBox();
  assert.ok(pathTitle.width > 130, "Long path titles retain a readable line width");
  await page.screenshot({ path: ".sites-runtime/qa/workspace-composition-desktop.png", fullPage: true });

  const first = page.locator(".home-recent .note-row").filter({ hasText: fixture.notes[0].title });
  await first.getByRole("button", { name: "Zu Favoriten hinzufügen", exact: true }).click();
  await expect(first.getByRole("button", { name: "Aus Favoriten entfernen", exact: true })).toBeVisible();
  assert.equal(writes, 1);
  assert.equal(workspace.notes.find(note => note.id === fixture.notes[0].id).favorite, true);
  await first.locator(".note-row-open").click();
  await expect(page.getByRole("dialog", { name: fixture.notes[0].title, exact: true })).toBeVisible();
  await home();
  await root.click();
  await expect(page.locator(".note-card")).toHaveCount(2);
  await page.getByRole("tab", { name: "Listenansicht", exact: true }).click();
  await expect(page.locator(".note-row")).toHaveCount(2);
  await home();
  await page.getByRole("textbox", { name: "Wissen durchsuchen", exact: true }).focus();
  await page.keyboard.type("Fundstelle", { delay: 60 });
  await expect(page.locator("h1")).toHaveText("Wissensbibliothek");
  await expect(page.getByRole("textbox", { name: "Wissen durchsuchen", exact: true })).toHaveValue("Fundstelle");
  await expect(page.locator(".note-card")).toHaveCount(1);
  await home();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("textbox", { name: "Wissen durchsuchen", exact: true })).toBeFocused();
  await home();
  await page.locator(".home-collections .collection-card").first().click();
  await expect(page.locator(".collection-detail")).toBeVisible();
  await navigation("Mein Überblick").click();

  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await fits(width);
    if (width === 390) await page.screenshot({ path: ".sites-runtime/qa/workspace-composition-mobile.png", fullPage: true });
  }
  workspace = workspaceSchema.parse({ ...emptyWorkspace, notes: [{ ...fixture.notes[0], id: "unassigned", title: "Ein freier Gedanke", topicId: null, relatedIds: [] }] });
  await home();
  await expect(page.locator(".note-row-topic")).toHaveText("Ohne Thema");
  await expect(page.locator(".orientation-caption").first()).toContainText("0 Fachthemen · 1 aktive Einträge");
  await fits(320);
  workspace = structuredClone(emptyWorkspace);
  await home();
  await expect(page.locator(".home-empty-notes")).toBeVisible();
  await fits(320);
  assert.deepEqual(errors, []);
  console.log("Workspace composition: navigation, search, note reader, revisioned favorite request, topic scope, collections, empty states and five viewport sizes passed. No database writes.");
} finally {
  await browser.close();
}
