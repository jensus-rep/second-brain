import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";

const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Local tests only.");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
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
    await trigger.click({ timeout: 60000 });
    const dialog = page.getByRole("dialog", { name: "Diagramm", exact: true });
    const region = dialog.locator(".diagram-viewport");
    const image = region.getByRole("img");
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate(img => img.getBoundingClientRect().width)).toBeGreaterThan(0);
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
    await expect(dialog.locator("output")).toHaveText("600 %");
    const bounds = await region.evaluate(el => ({ x: el.scrollWidth - el.clientWidth, y: el.scrollHeight - el.clientHeight }));
    assert.ok(bounds.x > 0 || bounds.y > 0, "Zoom creates a scrollable image");
    for (const direction of [-1, 1]) {
      for (let i = 0; i < 24; i++) {
        const delta = Math.min(box.width / 3, box.height / 3);
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
    await page.keyboard.press("Escape");
    await expect(editor).toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(dialog.locator("output")).toHaveText("100 %");
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("PASS: mobile portrait/landscape pinch zoom, touch panning to all edges, fit/reset, reopen and nested-dialog focus.");
} finally {
  await browser.close();
}
