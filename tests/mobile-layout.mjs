import { chromium, webkit, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Mobile tests may only change localhost.");
const engine = process.env.BRAIN_TEST_ENGINE === "webkit" ? webkit : chromium;
const browser = await engine.launch(engine === chromium ? { channel: "chrome", headless: true } : { headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let initial;
async function fits(locator) {
  assert.equal(await locator.evaluate(el => el.scrollWidth > el.clientWidth + 1), false, `Overflow: ${await locator.getAttribute("class")}`);
}
async function loaded(locator) {
  await expect(locator).toBeVisible({ timeout: 60000 });
  await expect.poll(() => locator.evaluate(img => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0)).toBe(true);
}
async function navigate(name) {
  await page.locator(".mobile-toggle").click();
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.locator('[data-slot="sidebar"][data-mobile="true"]')).toHaveCount(0);
}
try {
  await page.goto(origin, { waitUntil: "networkidle" });
  const snapshot = await (await page.request.get(origin + "/api/brain")).json();
  initial = snapshot.workspace;
  const urls = [];
  for (const [width, height] of [[1600, 400], [400, 1600]]) {
    const data = await page.evaluate(([w, h]) => {
      const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
      const context = canvas.getContext("2d"); context.fillStyle = "#dce8fa"; context.fillRect(0, 0, w, h);
      context.fillStyle = "#253d60"; context.fillRect(20, 20, w - 40, h - 40);
      return canvas.toDataURL("image/png").split(",")[1];
    }, [width, height]);
    const response = await page.request.post(origin + "/api/media", { headers: { "Content-Type": "image/png", Origin: origin }, data: Buffer.from(data, "base64") });
    assert.equal(response.status(), 201);
    urls.push((await response.json()).url);
  }
  const now = new Date().toISOString();
  const note = { id: crypto.randomUUID(), title: "Mobile Medienprüfung", topicId: null, summary: "Bilder und Diagramme auf schmalen Bildschirmen.", tags: [], relatedIds: [], favorite: false, archived: false, createdAt: now, updatedAt: now,
    content: `## Bilder\n\n![Querformat](${urls[0]} "Breite Abbildung")\n\n![Hochformat](${urls[1]} "Hohe Abbildung")\n\n## Diagramme\n\n\`\`\`mermaid\nflowchart LR\n A[Gedanke] --> B[Verstehen] --> C[Anwenden] --> D[Prüfen]\n\`\`\`\n\n\`\`\`mermaid\nsequenceDiagram\n Alice->>Bob: Frage\n Bob-->>Alice: Antwort\n\`\`\`\n\n\`\`\`mermaid\nmindmap\n root((Wissen))\n  Verstehen\n  Anwenden\n\`\`\`\n\n## Vergleich\n\n| Ansatz | Erklärung |\n| --- | --- |\n| Praxis | ${"Zusammenhang".repeat(20)} |\n\n\`\`\`text\n${"lange_codezeile".repeat(30)}\n\`\`\`` };
  assert.equal((await page.request.put(origin + "/api/brain", { data: { revision: snapshot.revision, workspace: { ...initial, notes: [...initial.notes, note] } } })).status(), 200);
  await page.reload({ waitUntil: "networkidle" });
  await mkdir(".sites-runtime/qa", { recursive: true });
  for (const width of [320, 390, 768, 1440]) {
    console.log("Checking width", width);
    await page.setViewportSize({ width, height: 844 });
    await page.goto(origin + "/#note=" + note.id, { waitUntil: "networkidle" });
    const reader = page.getByRole("dialog", { name: note.title, exact: true });
    await expect(reader).toBeVisible();
    for (const image of await reader.locator(".figure-zoom img, .diagram-zoom img").all()) await loaded(image);
    await expect(reader.locator(".diagram-zoom img")).toHaveCount(3);
    for (const diagram of await reader.locator(".diagram-zoom img").all()) {
      const dimensions = await diagram.evaluate(img => {
        const svg = new DOMParser().parseFromString(decodeURIComponent(img.src.split(",")[1]), "image/svg+xml").documentElement;
        return { width: Number(svg.getAttribute("width")), height: Number(svg.getAttribute("height")), ratio: img.naturalWidth / img.naturalHeight };
      });
      assert.ok(dimensions.width > 0 && dimensions.height > 0);
      assert.ok(Math.abs(dimensions.ratio - dimensions.width / dimensions.height) < .05);
    }
    await fits(reader); await fits(reader.locator(".entry-scroll"));
    await fits(reader.locator(".prose-brain"));
    if (width === 390) await page.screenshot({ path: `.sites-runtime/qa/mobile-${engine.name()}-reader.png`, animations: "disabled" });
    await reader.locator(".diagram-zoom").first().click();
    const lightbox = page.locator(".diagram-lightbox");
    await loaded(lightbox.locator("img"));
    await fits(lightbox);
    if (width === 390) await page.screenshot({ path: `.sites-runtime/qa/mobile-${engine.name()}-diagram.png`, animations: "disabled" });
    const viewport = lightbox.locator(".diagram-viewport");
    const bounds = await viewport.boundingBox();
    assert.ok(bounds.width > 100 && bounds.height > 100);
    await page.getByRole("button", { name: "Diagramm einpassen", exact: true }).click();
    await page.getByRole("button", { name: "Diagramm weiter vergrößern", exact: true }).click();
    await expect(lightbox.locator("output")).toHaveText("150 %");
    await page.getByRole("button", { name: "Diagramm einpassen", exact: true }).click();
    await expect(lightbox.locator("output")).toHaveText("100 %");
    await page.setViewportSize({ width: 844, height: 390 });
    await fits(lightbox);
    assert.ok(await viewport.evaluate(el => el.clientHeight > 0));
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width, height: 844 });
    for (const alt of ["Querformat", "Hochformat"]) {
      await reader.getByRole("button", { name: alt + " vergrößern", exact: true }).click();
      const imagebox = page.getByRole("dialog", { name: alt, exact: true });
      await loaded(imagebox.getByRole("img")); await fits(imagebox);
      await expect.poll(() => imagebox.getByRole("img").evaluate(img => Math.abs(img.getBoundingClientRect().width - img.naturalWidth))).toBeLessThan(1);
      const imageViewport = imagebox.locator(".diagram-viewport");
      assert.ok(await imageViewport.evaluate(el => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight), "Original-size images have reachable overflow");
      await imagebox.getByRole("button", { name: "Abbildung einpassen", exact: true }).click();
      const imageBounds = await imagebox.getByRole("img").boundingBox();
      assert.ok(imageBounds.width <= width && imageBounds.height <= 844);
      assert.equal(await imageViewport.evaluate(el => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight), false, "Fit shows the whole image");
      await imagebox.getByRole("button", { name: "Abbildung weiter vergrößern", exact: true }).click();
      await expect(imagebox.locator("output")).toHaveText("150 %");
      assert.ok(await imagebox.getByRole("img").evaluate(img => img.getBoundingClientRect().width) > imageBounds.width * 1.4, "Figure zoom changes rendered dimensions");
      await imagebox.getByRole("button", { name: "Originalgröße anzeigen", exact: true }).click();
      await expect.poll(() => imagebox.getByRole("img").evaluate(img => Math.abs(img.getBoundingClientRect().width - img.naturalWidth))).toBeLessThan(1);
      await page.keyboard.press("Escape");
    }
    await reader.getByRole("button", { name: "Bearbeiten", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "Notiz bearbeiten", exact: true });
    await fits(editor);
    const editorBounds = await editor.boundingBox();
    assert.ok(editorBounds.x >= 0 && editorBounds.x + editorBounds.width <= width + 1);
    await editor.getByRole("tab", { name: "Vorschau", exact: true }).click();
    await loaded(editor.locator(".diagram-zoom img").first());
    await fits(editor); await fits(editor.locator(".markdown-preview"));
    await editor.getByRole("button", { name: "Abbrechen", exact: true }).click();
    await reader.getByRole("button", { name: "Schließen", exact: true }).click();
    await expect(reader).not.toBeVisible();
    await expect.poll(() => new URL(page.url()).hash).toBe("");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `.sites-runtime/qa/mobile-${engine.name()}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 320, height: 700 });
  for (const name of ["Themen", "Lernpfade", "Verbindungen", "Lernkarten", "Wissensbibliothek"]) {
    await navigate(name);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name);
    await fits(page.locator(".workspace-content"));
  }
  assert.deepEqual(errors, []);
  console.log(`PASS (${engine.name()}): 320/390/768/1440px, portrait and landscape media, flowchart/sequence/mindmap, SVG aspect ratios, lightboxes, zoom/reset, rotation, editor/preview, navigation and page overflow.`);
} finally {
  if (initial) {
    const latest = await (await page.request.get(origin + "/api/brain")).json();
    assert.equal((await page.request.put(origin + "/api/brain", { data: { revision: latest.revision, workspace: initial } })).status(), 200);
  }
  await browser.close();
}
