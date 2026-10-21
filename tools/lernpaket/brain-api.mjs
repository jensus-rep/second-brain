// Run from the repo root; configuration comes only from the environment.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { validateSnapshot } from "./skripte/snapshot.mjs";

async function writeNewJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
}

async function main() {
  const [command, file, ...extra] = process.argv.slice(2);
  if (!["pull", "push"].includes(command) || !file || extra.length) {
    throw new Error("Aufruf: node --experimental-strip-types --env-file=.env.brain tools/lernpaket/brain-api.mjs <pull|push> <datei.json>");
  }
  let target;
  try { target = new URL(process.env.BRAIN_URL); }
  catch { throw new Error("BRAIN_URL muss die Basisadresse der eigenen Instanz enthalten."); }
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname);
  if ((target.protocol !== "https:" && !(local && target.protocol === "http:")) || target.username || target.password || target.search || target.hash || target.pathname !== "/") {
    throw new Error("BRAIN_URL braucht HTTPS (lokal auch HTTP), ohne Zugangsdaten, Pfad, Query oder Fragment.");
  }
  const key = process.env.BRAIN_ACCESS_KEY;
  if (!/^nh_[A-Za-z0-9_-]{43}$/.test(key ?? "")) throw new Error("BRAIN_ACCESS_KEY fehlt oder hat ein ungültiges Format.");
  const origin = target.origin;
  async function request(method = "GET", data) {
    let response;
    try {
      response = await fetch(origin + "/api/brain", {
        method, redirect: "error", signal: AbortSignal.timeout(30_000),
        headers: { Authorization: "Bearer " + key, ...(data ? { "Content-Type": "application/json" } : {}) },
        ...(data ? { body: JSON.stringify(data) } : {}),
      });
    } catch {
      throw new Error(method === "PUT" ? "Übertragung unterbrochen; Speicherstatus unklar. Kontroll-Pull ausführen, nicht blind erneut senden." : "Lesen fehlgeschlagen. Ziel, Verbindung und mögliche Weiterleitung prüfen.");
    }
    if (response.status === 409) throw new Error("Revisionskonflikt (409). Neu pullen und Änderungen erneut abgleichen; nichts automatisch überschrieben.");
    if (!response.ok) throw new Error(`API antwortet mit HTTP ${response.status}. Ziel und Zugang prüfen.`);
    try { return validateSnapshot(await response.json()); }
    catch { throw new Error(method === "PUT" ? "Speicherantwort ungültig; Status mit Kontroll-Pull prüfen." : "API liefert keinen verlustfrei validierbaren Snapshot."); }
  }
  const withSource = snapshot => ({ ...snapshot, source: { origin } });
  if (command === "pull") {
    const snapshot = await request();
    await writeNewJson(resolve(file), withSource(snapshot));
    console.log(`Pull gespeichert · Revision ${snapshot.revision}`);
    return;
  }
  let input;
  try { input = JSON.parse(await readFile(file, "utf8")); }
  catch { throw new Error("Eingabedatei fehlt oder enthält kein gültiges JSON."); }
  if (input.source?.origin !== origin) throw new Error("Ziel stimmt nicht mit der Herkunft des Snapshots überein. Zuerst aus dieser Instanz pullen.");
  const proposed = validateSnapshot(input);
  const current = await request();
  if (current.revision !== proposed.revision) throw new Error("Revision ist veraltet. Frisch pullen und Änderungen erneut abgleichen.");
  const backupRoot = resolve(".data/brain-api-backups", new Date().toISOString().replaceAll(":", "-") + "-" + randomUUID());
  await writeNewJson(backupRoot + "-vorher.json", withSource(current));
  console.log(`Sicherung vor Übertragung: ${backupRoot}-vorher.json`);
  const saved = await request("PUT", proposed);
  if (saved.revision !== proposed.revision + 1 || !isDeepStrictEqual(saved.workspace, proposed.workspace)) {
    throw new Error("Speicherantwort weicht vom Auftrag ab. Bestand per Kontroll-Pull prüfen.");
  }
  await writeNewJson(backupRoot + "-nachher.json", withSource(saved));
  const control = await request();
  await writeNewJson(backupRoot + "-kontrolle.json", withSource(control));
  if (!isDeepStrictEqual(control, saved)) throw new Error("Kontroll-Pull weicht ab; möglicherweise wurde inzwischen weitergearbeitet. Sicherungen prüfen.");
  console.log(`Gespeichert und kontrolliert · Revision ${saved.revision} · Sicherungen unter .data/brain-api-backups/`);
}

try { await main(); }
catch (error) {
  // Never print server bodies, URLs, environment values or the access key.
  console.error(error?.code === "EEXIST" ? "Zieldatei existiert bereits. Für einen neuen Pull einen neuen Dateinamen wählen." : error.message);
  process.exitCode = 1;
}
