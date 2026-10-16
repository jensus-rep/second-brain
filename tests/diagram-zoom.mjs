import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";

const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Local tests only.");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const page = await browser.newPage({ viewport, isMobile: true, hasTouch: true });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin, { waitUntil: "networkidle" });
    await page.getByText("Gespeichert", { exact: true }).waitFor({ state: "attached" });
    await page.getByRole("button", { name: "Neue Notiz", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "Ein neuer Gedanke", exact: true });
    await editor.getByRole("textbox", { name: /^Inhalt/ }).fill("```mermaid\nflowchart LR\nA[Linker Rand] --> B[Ein Gedanke] --> C[Verbindungen] --> D[Rechter Rand]\nA --> E[Weitere Gedanken] --> F[Ein Beispiel] --> D\nA --> G[Eine Anwendung] --> H[Zusammenhang] --> D\n```");
    await editor.getByRole("tab", { name: "Vorschau", exact: true }).click();
    const trigger = editor.getByRole("button", { name: "Diagramm vergrößern", exact: true });
    await expect(trigger).toBeVisible({ timeout: 60000 });
    const previewWidth = await trigger.locator("img").evaluate(img => img.getBoundingClientRect().width);
    await trigger.click({ timeout: 60000 });
    const dialog = page.getByRole("dialog", { name: "Diagramm", exact: true });
    await expect.poll(async () => {
      const box = await dialog.boundingBox();
      return box && Math.abs(box.x) < 1 && Math.abs(box.y) < 1 && Math.abs(box.width - viewport.width) < 1 && Math.abs(box.height - viewport.height) < 1;
    }, { message: "Mobile portrait and landscape use the full screen" }).toBe(true);
    const region = dialog.locator(".diagram-viewport");
    const image = region.getByRole("img");
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate(img => img.getBoundingClientRect().width)).toBeGreaterThan(0);
    const openingZoom = await dialog.locator("output").innerText();
    assert.ok(parseInt(openingZoom, 10) <= 150, "SVG diagrams open at no more than 150 %");
    assert.ok(await image.evaluate(img => img.getBoundingClientRect().width <= img.naturalWidth + 1), "Opening never exceeds the intrinsic size");
    assert.ok(await image.evaluate(img => img.getBoundingClientRect().width) > previewWidth, "Opening actually enlarges the diagram beyond the preview");
    await dialog.getByRole("button", { name: "Diagramm einpassen" }).click();
    const cdp = await page.context().newCDPSession(page);
    const box = await region.boundingBox();
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((point, id) => ({ ...point, id, radiusX: 2, radiusY: 2 })) });
    // Real Chromium touch input: pinch, then one-finger panning.
    await touch("touchStart", [{ x: center.x - 30, y: center.y }, { x: center.x + 30, y: center.y }]);
    for (let distance = 40; distance <= 90; distance += 10) {
      await touch("touchMove", [{ x: center.x - distance, y: center.y }, { x: center.x + distance, y: center.y }]);
      await page.waitForTimeout(30);
    }
    await touch("touchEnd", []);
    await expect.poll(() => dialog.locator("output").innerText()).not.toBe("100 %");
    const enlarge = dialog.getByRole("button", { name: "Diagramm weiter vergrößern" });
    while (await enlarge.isEnabled()) await enlarge.click();
    assert.ok(parseInt(await dialog.locator("output").innerText(), 10) >= 600);
    assert.ok(await image.evaluate(img => img.getBoundingClientRect().width >= img.naturalWidth * 4 - 1), "Zoom can reach four times intrinsic size even for large diagrams");
    const bounds = await region.evaluate(el => ({ x: el.scrollWidth - el.clientWidth, y: el.scrollHeight - el.clientHeight }));
    assert.ok(bounds.x > 0 || bounds.y > 0, "Zoom creates a scrollable image");
    for (const direction of [-1, 1]) {
      const delta = Math.min(box.width / 3, box.height / 3);
      for (let i = 0; i < Math.ceil(Math.max(bounds.x, bounds.y) / delta) + 2; i++) {
        await touch("touchStart", [center]);
        await touch("touchMove", [{ x: center.x + direction * delta, y: center.y + direction * delta }]);
        await touch("touchEnd", []);
      }
      const edge = await region.evaluate(el => {
        const image = el.querySelector("img").getBoundingClientRect(), rect = el.getBoundingClientRect();
        return { left: el.scrollLeft, top: el.scrollTop, maxX: el.scrollWidth - el.clientWidth, maxY: el.scrollHeight - el.clientHeight, imageLeft: image.left - rect.left, imageRight: image.right - rect.right, imageTop: image.top - rect.top, imageBottom: image.bottom - rect.bottom };
      });
      if (direction === -1) {
        assert.ok(Math.abs(edge.left - edge.maxX) <= 1 && Math.abs(edge.top - edge.maxY) <= 1, "Touch reaches the right and bottom scroll limits");
        assert.ok(edge.imageRight <= 1 && edge.imageBottom <= 1, "Entire right and bottom image edges are reachable");
      } else {
        assert.ok(edge.left <= 1 && edge.top <= 1, "Touch reaches the left and top scroll limits");
        assert.ok(edge.imageLeft >= -1 && edge.imageTop >= -1, "Entire left and top image edges are reachable");
      }
    }
    await dialog.getByRole("button", { name: "Diagramm einpassen" }).click();
    await expect(dialog.locator("output")).toHaveText("100 %");
    assert.equal(await region.evaluate(el => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight), false, "Reset fits the whole diagram");
    await dialog.getByRole("button", { name: "Originalgröße anzeigen" }).click();
    await expect.poll(() => image.evaluate(img => Math.abs(img.getBoundingClientRect().width - img.naturalWidth))).toBeLessThan(1);
    const originalZoom = await dialog.locator("output").innerText();
    const originalWidth = await image.evaluate(img => img.getBoundingClientRect().width);
    const rotated = viewport.width < viewport.height ? { width: 844, height: 390 } : { width: 390, height: 844 };
    await page.setViewportSize(rotated);
    await expect.poll(() => image.evaluate(img => Math.abs(img.getBoundingClientRect().width - img.naturalWidth))).toBeLessThan(1);
    assert.ok(Math.abs(await image.evaluate(img => img.getBoundingClientRect().width) - originalWidth) < 1, "Rotation preserves readable image scale");
    await page.setViewportSize(viewport);
    await expect(dialog.locator("output")).toHaveText(originalZoom);
    await page.keyboard.press("Escape");
    await expect(editor).toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(dialog.locator("output")).toHaveText(openingZoom);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("PASS: 320px and mobile portrait/landscape, SVG opening capped at 150 %, real pinch zoom, touch panning to all edges, fit/original size, rotation, reopen and nested-dialog focus.");
} finally {
  await browser.close();
}
