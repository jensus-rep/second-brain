import { chromium, request as playwrightRequest } from "@playwright/test";
import assert from "node:assert/strict";

// Creates, uses and revokes a personal access key against the local dev server only.
const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Access key tests may only mutate localhost.");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("dialog", dialog => dialog.accept());
const anonymous = await playwrightRequest.newContext({ baseURL: origin });
const withKey = key => ({ headers: { Authorization: "Bearer " + key } });
let secret;
try {
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Dein Wissen", exact: true }).waitFor();
  const before = await (await page.request.get(origin + "/api/brain")).json();

  await page.getByRole("button", { name: "Zugangsschlüssel", exact: true }).click();
  await page.getByRole("heading", { name: "Zugangsschlüssel", exact: true }).waitFor();
  await page.getByLabel("Name des Schlüssels").fill("Browsertest");
  await page.getByRole("button", { name: "Schlüssel erzeugen" }).click();
  secret = await page.getByLabel("Neuer Schlüssel").inputValue();
  assert.match(secret, /^nh_[A-Za-z0-9_-]{43}$/);
  await page.getByText("Browsertest", { exact: true }).waitFor();
  await page.getByText("noch nicht genutzt").first().waitFor();

  // Without session cookie: the key opens the data routes but not key management.
  assert.equal((await anonymous.get("/api/brain")).status(), 401);
  const read = await anonymous.get("/api/brain", withKey(secret));
  assert.equal(read.status(), 200);
  const snapshot = await read.json();
  assert.equal(snapshot.revision, before.revision);
  const written = await anonymous.put("/api/brain", { ...withKey(secret), data: { revision: snapshot.revision, workspace: snapshot.workspace } });
  assert.equal(written.status(), 200);
  assert.equal((await written.json()).revision, snapshot.revision + 1);
  assert.equal((await anonymous.get("/api/brain", withKey(secret.slice(0, -1) + (secret.endsWith("A") ? "B" : "A")))).status(), 401);
  assert.equal((await anonymous.get("/api/brain", { headers: { Authorization: "Bearer nh_kurz" } })).status(), 401);
  assert.equal((await anonymous.get("/api/keys", withKey(secret))).status(), 401);
  assert.equal((await anonymous.post("/api/keys", { ...withKey(secret), data: { name: "Nachschlüssel" } })).status(), 401);
  const listed = await (await page.request.get(origin + "/api/keys")).json();
  const mine = listed.keys.find(k => k.name === "Browsertest");
  assert.ok(mine.lastUsedAt, "last use is recorded");
  assert.equal(JSON.stringify(listed).includes(secret), false, "the list never returns the key");

  // Revoking cuts access immediately.
  await page.getByRole("button", { name: "Widerrufen: Browsertest" }).click();
  await page.getByText("Zugangsschlüssel widerrufen.", { exact: true }).waitFor();
  assert.equal((await anonymous.get("/api/brain", withKey(secret))).status(), 401);
  assert.deepEqual(errors, []);
  console.log("Access key tests passed");
} finally {
  // Clean up a key left behind by a failed run.
  const left = await page.request.get(origin + "/api/keys").then(r => r.json()).catch(() => ({ keys: [] }));
  for (const key of left.keys ?? []) if (key.name === "Browsertest") await page.request.delete(origin + "/api/keys/" + key.id);
  await anonymous.dispose();
  await browser.close();
}
