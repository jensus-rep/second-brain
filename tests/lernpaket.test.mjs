import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { emptyWorkspace } from "../lib/brain/model.ts";
import { validateSnapshot } from "../tools/lernpaket/skripte/snapshot.mjs";

const cli = fileURLToPath(new URL("../tools/lernpaket/brain-api.mjs", import.meta.url));
const validator = fileURLToPath(new URL("../tools/lernpaket/skripte/validate.mjs", import.meta.url));
const key = "nh_" + "a".repeat(43); // Synthetic key; all requests go to the fixture's loopback server.
const snapshot = () => ({ revision: 4, workspace: structuredClone(emptyWorkspace) });

function run(script, args, cwd, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", script, ...args], {
      cwd, env: { ...process.env, BRAIN_URL: "", BRAIN_ACCESS_KEY: "", NODE_NO_WARNINGS: "1", ...env },
    });
    let output = "";
    child.stdout.on("data", data => { output += data; });
    child.stderr.on("data", data => { output += data; });
    child.on("error", reject);
    child.on("close", code => resolve({ code, output }));
  });
}

async function fixture(t, behavior = {}) {
  const dir = await mkdtemp(join(tmpdir(), "brain-handover-"));
  let state = snapshot();
  let puts = 0;
  const server = createServer(async (request, response) => {
    assert.equal(request.url, "/api/brain");
    assert.equal(request.headers.authorization, "Bearer " + key);
    if (behavior.redirect) { response.writeHead(302, { Location: "/other" }); response.end(); return; }
    response.setHeader("Content-Type", "application/json");
    if (request.method === "PUT") {
      puts++;
      const parts = [];
      for await (const part of request) parts.push(part);
      const input = JSON.parse(Buffer.concat(parts).toString());
      if (behavior.conflict || input.revision !== state.revision) {
        response.writeHead(409); response.end(JSON.stringify({ conflict: true })); return;
      }
      assert.deepEqual(Object.keys(input).sort(), ["revision", "workspace"]);
      state = { revision: input.revision + 1, workspace: input.workspace };
    }
    response.end(JSON.stringify(state));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  const env = { BRAIN_URL: `http://127.0.0.1:${server.address().port}`, BRAIN_ACCESS_KEY: key };
  return { dir, env, run: (...args) => run(cli, args, dir, env), state: () => state, puts: () => puts };
}

test("validation refuses nested data loss and normalization, allows schema defaults", () => {
  const input = snapshot();
  delete input.workspace.cards;
  assert.deepEqual(validateSnapshot(input).workspace.cards, []);
  const unknown = snapshot();
  unknown.workspace.unrecognized = { privateData: "must survive" };
  assert.throws(() => validateSnapshot(unknown), /workspace.unrecognized/);
  const card = { id: "c", question: " question ", answer: "answer", noteId: null, dueAt: "2026-10-21T10:00:00.000Z", intervalDays: 0, reviews: 0 };
  const nested = snapshot();
  nested.workspace.cards = [card];
  assert.throws(() => validateSnapshot(nested), /question/);
  card.question = "question"; card.unknown = "value";
  assert.throws(() => validateSnapshot(nested), /cards.0.unknown/);
});

test("pull/edit/push creates before, after and control backups without exposing a key", async t => {
  const f = await fixture(t);
  assert.equal((await f.run("pull", "stand.json")).code, 0);
  const input = JSON.parse(await readFile(join(f.dir, "stand.json"), "utf8"));
  assert.equal(input.source.origin, f.env.BRAIN_URL);
  input.workspace.topics.push({ id: "example", title: "Beispiel", description: "", color: "blue" });
  await writeFile(join(f.dir, "nachher.json"), JSON.stringify(input));
  const result = await f.run("push", "nachher.json");
  assert.equal(result.code, 0, result.output);
  assert.equal(result.output.includes(key), false);
  assert.equal(f.puts(), 1);
  assert.equal(f.state().revision, 5);
  const backups = await readdir(join(f.dir, ".data/brain-api-backups"));
  assert.equal(backups.length, 3);
  const before = JSON.parse(await readFile(join(f.dir, ".data/brain-api-backups", backups.find(name => name.endsWith("-vorher.json"))), "utf8"));
  assert.equal(before.workspace.topics.length, 0);
  assert.equal((await f.run("push", "nachher.json")).code, 1);
  assert.equal(f.puts(), 1, "stale snapshots must not be written");
  assert.equal((await f.run("pull", "stand.json")).code, 1, "pull must not overwrite a saved snapshot");
});

test("wrong origin and lossy input are rejected before a PUT; validator exits with error", async t => {
  const f = await fixture(t);
  const input = { ...snapshot(), source: { origin: "https://other.example" } };
  const path = join(f.dir, "input.json");
  await writeFile(path, JSON.stringify(input));
  assert.match((await f.run("push", path)).output, /Herkunft/);
  input.source.origin = f.env.BRAIN_URL;
  input.workspace.unrecognized = "do not discard";
  await writeFile(path, JSON.stringify(input));
  assert.equal((await f.run("push", path)).code, 1);
  assert.equal((await run(validator, [path], f.dir)).code, 1);
  assert.equal(f.puts(), 0);
});

test("a concurrent API conflict stops without retrying and keeps the before backup", async t => {
  const f = await fixture(t, { conflict: true });
  await f.run("pull", "stand.json");
  const result = await f.run("push", "stand.json");
  assert.equal(result.code, 1);
  assert.match(result.output, /409/);
  assert.equal(f.puts(), 1);
  assert.equal((await readdir(join(f.dir, ".data/brain-api-backups"))).length, 1);
});

test("redirects and insecure remote addresses cannot receive the access key", async t => {
  const f = await fixture(t, { redirect: true });
  assert.equal((await f.run("pull", "stand.json")).code, 1);
  const result = await run(cli, ["pull", "stand.json"], f.dir, { ...f.env, BRAIN_URL: "http://remote.example" });
  assert.equal(result.code, 1);
  assert.match(result.output, /HTTPS/);
  assert.equal(result.output.includes(key), false);
});
