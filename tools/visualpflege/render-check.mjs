// Render every mermaid block of the given drafts with the app's mermaid version in headless Chrome.
// node tools/visualpflege/render-check.mjs <ausgabe-ordner> <entwurf.json>...
// Reports parse/render errors and writes one PNG per diagram at mobile width (390 px) for visual review.
import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const [outDir, ...files] = process.argv.slice(2);
if (!outDir || !files.length) throw new Error("Aufruf: render-check.mjs <ausgabe-ordner> <entwurf.json>...");
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
await page.setContent("<!doctype html><body style='margin:0;background:#fff;font-family:sans-serif'><div id=d style='width:358px;padding:16px'></div></body>");
await page.addScriptTag({ path: resolve("node_modules/mermaid/dist/mermaid.min.js") });
// Same configuration as components/brain/markdown diagram rendering (visual.tsx).
await page.evaluate(() => window.mermaid.initialize({ startOnLoad: false, securityLevel: "strict", htmlLabels: false, suppressErrorRendering: true, theme: "base", fontFamily: "Segoe UI, sans-serif", themeVariables: { primaryColor: "#edf2e8", primaryTextColor: "#2b332d", primaryBorderColor: "#6e8962", secondaryColor: "#f5eee7", secondaryTextColor: "#465248", secondaryBorderColor: "#b47755", lineColor: "#7d877e", tertiaryColor: "#faf9f6", tertiaryTextColor: "#465248", tertiaryBorderColor: "#c8d6bf", background: "#ffffff" }, flowchart: { htmlLabels: false, useMaxWidth: true }, maxTextSize: 12000, maxEdges: 150 }));

let total = 0, failed = 0;
for (const file of files) {
  for (const entry of JSON.parse(await readFile(file, "utf8"))) {
    const blocks = [...entry.content.matchAll(/```mermaid\n([\s\S]*?)```/g)].map(m => m[1]);
    for (const [i, source] of blocks.entries()) {
      total++;
      const result = await page.evaluate(async ({ source, id }) => {
        try {
          const { svg } = await window.mermaid.render(id, source);
          const box = document.getElementById("d"); box.innerHTML = svg;
          const el = box.querySelector("svg"); el.style.maxWidth = "100%"; el.style.height = "auto";
          const vb = el.viewBox.baseVal;
          return { ok: true, width: Math.round(vb.width), height: Math.round(vb.height) };
        } catch (e) { return { ok: false, error: String(e.message ?? e).slice(0, 200) }; }
      }, { source, id: "m" + total });
      const label = `${entry.title} #${i + 1}`;
      if (!result.ok) { failed++; console.log(`FEHLER  ${label}: ${result.error}`); continue; }
      // Scale factor at 358 px: small text means the diagram is too wide for mobile.
      const scale = Math.min(1, 358 / result.width);
      console.log(`${scale < 0.6 ? "BREIT " : "ok    "}  ${label} · ${result.width}×${result.height} · Mobilskalierung ${scale.toFixed(2)}`);
      await page.locator("#d").screenshot({ path: resolve(outDir, `${entry.id}-${i + 1}.png`) });
    }
  }
}
await browser.close();
console.log(`${total} Diagramme · ${failed} Fehler`);
process.exitCode = failed ? 1 : 0;
