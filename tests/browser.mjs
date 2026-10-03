import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Browser tests may only mutate local test data.");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let initial;
try {
  await page.goto(origin + "/#note=%", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Wissen, das bleibt." }).waitFor();
  await page.getByText("Dein Wissen ist gespeichert").waitFor();
  const response = await page.request.get(origin + "/api/brain");
  assert.equal(response.status(), 200);
  initial = (await response.json()).workspace;
  await mkdir(".sites-runtime/qa", { recursive: true });
  await page.screenshot({ path: ".sites-runtime/qa/desktop.png", fullPage: true });

  await page.getByRole("button", { name: "Neue Notiz", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Titel", { exact: true }).fill("Browserprüfung Wissensnotiz");
  await dialog.getByRole("button", { name: "Details & Verbindungen" }).click();
  await dialog.getByLabel("Kurzbeschreibung").fill("Ein prüfbarer Gedanke.");
  await dialog.getByLabel(/^Tags/).fill("Test, test, Wiederfinden");
  await dialog.getByRole("textbox", { name: /^Inhalt/ }).fill("## Meine Erkenntnis\n\nDiese Notiz prüft dauerhaftes Speichern und Suchen.");
  await dialog.getByRole("button", { name: "Notiz speichern", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "Wissen durchsuchen" }).fill("Browserprüfung");
  await page.getByRole("heading", { name: "Browserprüfung Wissensnotiz", exact: true }).waitFor();
  await page.getByRole("button", { name: "Zu Favoriten hinzufügen" }).click();
  await page.getByRole("button", { name: "Aus Favoriten entfernen" }).waitFor();
  await page.getByRole("heading", { name: "Browserprüfung Wissensnotiz", exact: true }).click();
  await page.getByRole("dialog").getByRole("heading", { name: "Meine Erkenntnis" }).waitFor();
  await page.getByRole("button", { name: "Weitere Notizaktionen" }).click();
  await page.getByRole("menuitem", { name: "Archivieren", exact: true }).click();
  await page.getByText("Notiz archiviert", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Weitere Notizaktionen" }).click();
  await page.getByRole("menuitem", { name: "Wiederherstellen", exact: true }).click();
  await page.getByText("Notiz wiederhergestellt", { exact: true }).waitFor();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Lernpfade", exact: true }).click();
  await page.getByRole("heading", { name: "Dein Second Brain aufbauen", exact: true }).click();
  await page.getByRole("checkbox", { name: "Abgeschlossen" }).first().click();
  await page.getByText("Lernschritt abgeschlossen", { exact: true }).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Lernpfade", exact: true }).click();
  await page.getByRole("heading", { name: "Dein Second Brain aufbauen", exact: true }).click();
  assert.equal(await page.getByRole("checkbox", { name: "Abgeschlossen" }).first().isChecked(), true);
  await page.getByRole("button", { name: "Neuer Lernpfad", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Titel", { exact: true }).fill("Eigener Testlernpfad");
  await page.getByRole("dialog").getByRole("button", { name: "Browserprüfung Wissensnotiz", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Aufgabe für Schritt 1").fill("Den Gedanken erklären.");
  await page.getByRole("dialog").getByRole("button", { name: "Lernpfad speichern" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("heading", { name: "Eigener Testlernpfad" }).waitFor();

  const current = await (await page.request.get(origin + "/api/brain")).json();
  const write = await page.request.put(origin + "/api/brain", { data: current });
  assert.equal(write.status(), 200);
  const stale = await page.request.put(origin + "/api/brain", { data: current });
  assert.equal(stale.status(), 409);
  const malformed = await page.request.put(origin + "/api/brain", { data: { revision: current.revision + 1, workspace: { ...current.workspace, notes: [] } } });
  assert.equal(malformed.status(), 400);

  await page.getByRole("button", { name: "Mein Überblick", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Wissen, das bleibt." }).waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false, "Mobile layout must not overflow horizontally");
  await page.screenshot({ path: ".sites-runtime/qa/mobile.png", fullPage: true });
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log("PASS: note creation, durable reload, search, favorites, archive/restore, learning progress, path creation, revision conflicts, import validation and responsive layout.");
} finally {
  if (initial) {
    const latest = await (await page.request.get(origin + "/api/brain")).json();
    const restored = await page.request.put(origin + "/api/brain", { data: { revision: latest.revision, workspace: initial } });
    assert.equal(restored.status(), 200, "Restore the original local test workspace");
  }
  await browser.close();
}
