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
  await expect(reader.locator(".comparison-card svg")).toHaveCount(4);
  await expect(reader.locator("table")).toHaveCount(0);
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
  assert.match(await reader.locator(".comparison-card svg").first().getAttribute("aria-label"), /Ansatz: Sammeln.*Quelle: Quelle.*Leer: Keine Angabe/);
  await reader.locator(".comparison-text summary").first().click();
  await expect(reader.getByRole("link", { name: "Quelle", exact: true })).toHaveAttribute("href", "https://example.org/wissen");
  await expect(reader.locator(".comparison-text strong")).toHaveText("Sammeln");
  await expect(reader.locator(".comparison-text code")).toHaveText("eigene Worte");
  await expect(reader.locator(".comparison-text em")).toHaveText("Beispiele");
  await mkdir(".sites-runtime/qa", { recursive: true });
  for (const width of [1440, 390, 320, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => reader.locator(".comparison-card").first().evaluate(element => {
      const svg = element.querySelector("svg");
      return Math.abs(element.getBoundingClientRect().width - svg.viewBox.baseVal.width) < 1;
    })).toBe(true);
    assert.equal(await reader.locator(".entry-scroll").evaluate(element => element.scrollWidth > element.clientWidth), false, `No horizontal overflow at ${width}px`);
    assert.deepEqual(await reader.locator(".comparison-card svg").evaluateAll(elements => elements.flatMap(svg => {
      const box = svg.viewBox.baseVal;
      return Array.from(svg.querySelectorAll("text")).filter(text => {
        const bounds = text.getBBox();
        return bounds.x < 0 || bounds.x + bounds.width > box.width || bounds.y + bounds.height > box.height;
      }).map(text => text.textContent);
    })), [], `All SVG text fits at ${width}px`);
    assert.equal(await reader.locator(".comparison-card svg text").first().evaluate(element => getComputedStyle(element).fontSize), "16px");
    if (width === 390 || width === 1440) await reader.locator(".entry-scroll").screenshot({ path: `.sites-runtime/qa/comparison-${width}.png` });
  }
  await reader.getByRole("button", { name: "Bearbeiten", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Notiz bearbeiten", exact: true });
  assert.equal(await editor.getByRole("textbox", { name: /^Inhalt/ }).inputValue(), note.content, "Rendering preserves stored Markdown");
  await editor.getByRole("tab", { name: "Vorschau", exact: true }).click();
  await expect(editor.locator(".comparison-card svg")).toHaveCount(4);
  await expect(editor.locator("table")).toHaveCount(0);
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Lernkarten", exact: true }).click();
  await page.getByRole("button", { name: "Lernrunde starten", exact: true }).click();
  await expect(page.locator(".comparison-card svg")).toHaveCount(4);
  await expect(page.locator("table")).toHaveCount(0);
  await page.getByRole("button", { name: "Antwort aufdecken", exact: true }).click();
  await expect(page.locator(".comparison-card svg")).toHaveCount(8);
  await expect(page.locator("table")).toHaveCount(0);
  assert.deepEqual(errors, []);
  console.log("PASS: SVG comparisons, rich text and links, empty cells and headers, long words, responsive reflow, seed diagrams, editor preview and flashcards; stored content preserved.");
} finally {
  if (initial) {
    const latest = await (await page.request.get(origin + "/api/brain")).json();
    assert.equal((await page.request.put(origin + "/api/brain", { data: { revision: latest.revision, workspace: initial } })).status(), 200);
  }
  await browser.close();
}
