import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { seedWorkspace } from "../lib/brain/seed.ts";

const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Local test data only.");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let initial;
const comparison = `| Ansatz | Erklärung | Quelle | Leer |
| --- | --- | --- | --- |
| **Sammeln** | Ein Gedanke mit Kontext und einer offenen Frage. | [Quelle](https://example.org/wissen) | |
| Verstehen | ${"Zusammenhang".repeat(12)} | \`eigene Worte\` und *Beispiele* | A \\| B |

| Nur eine Überschrift |
| --- |

| | |
| --- | --- |
| Links | Rechts |`;
try {
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByText("Gespeichert", { exact: true }).waitFor();
  const snapshot = await (await page.request.get(origin + "/api/brain")).json();
  initial = snapshot.workspace;
  const now = new Date().toISOString();
  const note = { id: crypto.randomUUID(), title: "QA SVG Vergleiche", summary: "", tags: [], topicId: null, relatedIds: [], favorite: false, archived: false, createdAt: now, updatedAt: now,
    content: comparison + "\n\n" + seedWorkspace.notes.filter(note => ["understand", "connect", "path"].includes(note.id)).map(note => note.content.slice(note.content.lastIndexOf("\n\n## "))).join("\n\n") };
  const card = { id: crypto.randomUUID(), question: comparison, answer: comparison, noteId: note.id, dueAt: now, intervalDays: 0, reviews: 0 };
  assert.equal((await page.request.put(origin + "/api/brain", { data: { revision: snapshot.revision, workspace: { ...initial, notes: [...initial.notes, note], cards: [card] } } })).status(), 200);
  await page.goto(origin + "/#note=" + note.id, { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  const reader = page.getByRole("dialog", { name: note.title, exact: true });
  await expect(reader).toBeVisible();
  await expect(reader.locator("table")).toHaveCount(3);
  await expect(reader.locator(".comparison-card")).toHaveCount(0);
  await expect(reader.getByRole("img", { name: "Diagramm", exact: true })).toHaveCount(3, { timeout: 60000 });
  await expect(reader.locator(".diagram-error")).toHaveCount(0);
  assert.deepEqual(await reader.locator('.diagram-figure img').evaluateAll(images => images.flatMap(image => {
    const source = decodeURIComponent(image.src.slice(image.src.indexOf(",") + 1));
    const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
    const svg = document.importNode(parsed.documentElement, true);
    svg.style.cssText = "position:fixed;left:-10000px;top:0;opacity:0;pointer-events:none";
    document.body.appendChild(svg);
    try {
      const view = svg.viewBox.baseVal;
      const content = svg.getBBox();
      const clipped = content.x < view.x - 1 || content.y < view.y - 1
        || content.x + content.width > view.x + view.width + 1
        || content.y + content.height > view.y + view.height + 1;
      return clipped ? [svg.id] : [];
    } finally { svg.remove(); }
  })), [], "Reduced motion preserves all diagram nodes inside the SVG viewBox");
  await expect(reader.getByRole("link", { name: "Quelle", exact: true })).toHaveAttribute("href", "https://example.org/wissen");
  await expect(reader.locator("table strong")).toHaveText("Sammeln");
  await expect(reader.locator("table code")).toHaveText("eigene Worte");
  await expect(reader.locator("table em")).toHaveText("Beispiele");
  await expect(reader.locator("table").first().locator("tbody tr")).toHaveCount(2);
  await mkdir(".sites-runtime/qa", { recursive: true });
  for (const width of [1440, 390, 320, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await reader.locator(".entry-scroll").evaluate(element => element.scrollWidth > element.clientWidth), false, `No horizontal overflow at ${width}px`);
    await expect(reader.locator(".markdown-table-scroll").first()).toBeVisible();
    assert.ok(await reader.locator("table th").first().evaluate(element => element.getBoundingClientRect().width >= 127), `Columns remain readable at ${width}px`);
    if (width === 320) {
      const scroller = reader.locator(".markdown-table-scroll").first();
      assert.equal(await scroller.evaluate(element => element.scrollWidth > element.clientWidth), true, "Wide tables scroll within the article");
      await scroller.focus();
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => scroller.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    }
    if (width === 390 || width === 1440) await reader.locator(".entry-scroll").screenshot({ path: `.sites-runtime/qa/comparison-${width}.png` });
  }
  await reader.getByRole("button", { name: "Bearbeiten", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Notiz bearbeiten", exact: true });
  assert.equal(await editor.getByRole("textbox", { name: /^Inhalt/ }).inputValue(), note.content, "Rendering preserves stored Markdown");
  await editor.getByRole("tab", { name: "Vorschau", exact: true }).click();
  await expect(editor.locator("table")).toHaveCount(3);
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Lernkarten", exact: true }).click();
  await page.getByRole("button", { name: "Lernrunde starten", exact: true }).click();
  await expect(page.locator("table")).toHaveCount(3);
  await page.getByRole("button", { name: "Antwort aufdecken", exact: true }).click();
  await expect(page.locator("table")).toHaveCount(6);
  assert.deepEqual(errors, []);
  console.log("PASS: semantic tables, rich text and links, empty cells and headers, long words, responsive scrolling, seed diagrams, editor preview and flashcards; stored content preserved.");
} finally {
  if (initial) {
    const latest = await (await page.request.get(origin + "/api/brain")).json();
    assert.equal((await page.request.put(origin + "/api/brain", { data: { revision: latest.revision, workspace: initial } })).status(), 200);
  }
  await browser.close();
}
