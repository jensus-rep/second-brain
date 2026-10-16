import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { brainBody } from "./brain-request.mjs";

const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Save compression tests only mutate localhost.");
const api = origin + "/api/brain";
const sqlitePath = resolve(process.env.BRAIN_TEST_SQLITE_PATH ?? process.env.NEWHOPE_SQLITE_PATH ?? ".data/newhope.sqlite");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(20000);
page.setDefaultNavigationTimeout(90000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let initial;

async function snapshot() {
  const response = await page.request.get(api);
  assert.equal(response.status(), 200);
  return response.json();
}
async function verifyLocal(current) {
  assert.equal((await realpath(sqlitePath)).toLowerCase(), sqlitePath.toLowerCase());
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const row = db.prepare("SELECT body, revision FROM newhope_workspaces WHERE owner_id = ?").get("local_dev");
    assert.equal(row?.revision, current.revision, "API and local SQLite must match before writes.");
  } finally { db.close(); }
}
async function write(workspace) {
  const before = await snapshot();
  await verifyLocal(before);
  // Access-key clients keep sending plain JSON.
  const response = await page.request.put(api, { data: { revision: before.revision, workspace } });
  assert.equal(response.status(), 200, await response.text());
}
async function putRaw(body) {
  return page.request.put(api, { headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" }, data: body });
}

const dueAt = new Date(Date.now() - 60000).toISOString();
// A collection above the compression threshold, like a real one.
const cards = Array.from({ length: 40 }, (_, index) => ({
  id: "compressed-card-" + String(index).padStart(2, "0"),
  question: `Wie erklärst du Gedanke ${index + 1} in eigenen Worten?`,
  answer: `Gedanke ${index + 1}: ` + "Ein Beispiel verbindet die Erklärung mit einer Handlung und macht sie überprüfbar. ".repeat(18),
  noteId: null, reviews: 0, intervalDays: 0, dueAt: new Date(Date.parse(dueAt) + index).toISOString(), priority: 1,
}));
const fixture = { schemaVersion: 1, topics: [], notes: [], paths: [], completedStepIds: [], cards, quizQuestions: [], quizRuns: [], learningReminders: [], learningCollections: [] };
const reveal = () => page.getByRole("button", { name: "Antwort aufdecken", exact: true });
const rating = known => page.getByRole("group", { name: "Bewertung der Lernkarte", exact: true }).getByRole("button", { name: known ? /^Gewusst/ : /^Noch üben/ });

try {
  await page.goto(origin, { waitUntil: "networkidle" });
  initial = (await snapshot()).workspace;
  await write(fixture);
  assert.ok(JSON.stringify(fixture).length > 32_768, "The fixture exceeds the compression threshold.");

  console.log("Checking compressed uploads and batched background ratings");
  const writes = [];
  page.on("request", request => {
    if (request.url() !== api || request.method() !== "PUT") return;
    const raw = request.postDataBuffer();
    writes.push({ encoding: request.headers()["content-encoding"], gzip: raw[0] === 0x1f && raw[1] === 0x8b, bytes: raw.length, body: brainBody(request) });
  });
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Lernkarten", exact: true }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "Lernrunde starten", exact: true }).click();
  await expect(reveal()).toBeVisible();
  await expect(page.locator(".save-state")).toHaveText("Gespeichert");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].encoding, "gzip");
  assert.ok(writes[0].gzip, "The started round is uploaded gzip-compressed.");
  assert.ok(writes[0].bytes * 3 < JSON.stringify(writes[0].body).length, "Compression shrinks the upload clearly.");
  const started = await snapshot();
  assert.equal(started.workspace.flashcardSession.index, 0);

  let release, arrived;
  const gate = new Promise(done => { release = done; });
  const held = new Promise(done => { arrived = done; });
  await page.route(api, async route => {
    arrived();
    await gate;
    await route.fulfill({ response: await route.fetch() });
  }, { times: 1 });
  await reveal().click();
  await rating(true).click();
  await held;
  // The learner continues while the first rating waits for the server.
  await expect(page.locator(".study-topline")).toContainText("2 von 40", { timeout: 1000 });
  await reveal().click();
  await rating(false).click();
  await expect(page.locator(".study-topline")).toContainText("3 von 40", { timeout: 1000 });
  await reveal().click();
  await rating(true).click();
  await expect(page.locator(".study-topline")).toContainText("4 von 40", { timeout: 1000 });
  await expect(page.locator(".study-save-status")).toBeVisible();
  assert.equal((await snapshot()).revision, started.revision, "No rating is confirmed while the first write is held.");
  release();
  await expect(page.locator(".study-save-status")).toHaveCount(0);
  await expect(page.locator(".save-state")).toHaveText("Gespeichert");
  const saved = await snapshot();
  assert.equal(saved.revision, started.revision + 2, "Ratings that queued up behind the first one share one write.");
  assert.equal(writes.length, 3);
  assert.ok(writes.slice(1).every(item => item.encoding === "gzip" && item.gzip));
  assert.deepEqual(writes[2].body.workspace.cardReviewEvents.map(event => event.cardId), cards.slice(0, 3).map(card => card.id));
  assert.equal(saved.workspace.flashcardSession.index, 3);
  assert.deepEqual(saved.workspace.cards.slice(0, 4).map(card => card.reviews), [1, 1, 1, 0]);
  assert.deepEqual(saved.workspace.cards.slice(0, 3).map(card => card.intervalDays), [1, 0, 1]);
  await verifyLocal(saved);

  console.log("Checking damaged and oversized compressed uploads");
  const damaged = await putRaw(Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x01, 0x02, 0x03]));
  assert.equal(damaged.status(), 415);
  const expanding = await putRaw(gzipSync(JSON.stringify({ revision: saved.revision, workspace: fixture, padding: " ".repeat(5_000_000) })));
  assert.equal(expanding.status(), 413, "Decompression stops at the collection limit.");
  assert.equal((await snapshot()).revision, saved.revision, "Rejected uploads do not change the collection.");
  assert.deepEqual(errors, [], "No browser runtime errors.");
  console.log("PASS: gzip uploads above the threshold, plain JSON for access keys, batched background ratings in order, damaged and oversized gzip rejected.");
} finally {
  await page.unroute(api).catch(() => {});
  if (initial) await write(initial);
  await browser.close();
}
