import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { workspaceSchema, MAX_WORKSPACE_BYTES, type Workspace } from "./model";
import { isPrivateImage, mediaReferences, uploadImage, MAX_IMAGE_BYTES } from "./media";

const MAX_BACKUP_BYTES = 64 * 1024 * 1024;
type Asset = { oldUrl: string; bytes: Uint8Array; mime: string };
export type ImportBundle = { workspace: Workspace; assets: Asset[]; complete: boolean };
function download(bytes: Uint8Array | string, name: string, type: string) {
  const blob = typeof bytes === "string" ? new Blob([bytes], { type }) : new Blob([new Uint8Array(bytes)], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fileName = () => "newhope-" + new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
export function exportJson(workspace: Workspace) { download(JSON.stringify(workspace, null, 2), fileName() + ".json", "application/json"); }
export async function exportBackup(workspace: Workspace) {
  const files: Record<string, Uint8Array> = { "workspace.json": strToU8(JSON.stringify(workspace)) };
  const index: Record<string, { file: string; mime: string }> = {};
  let size = files["workspace.json"].length;
  const references = mediaReferences(workspace);
  if (references.length > 200) throw new Error("Die Sicherung unterstützt derzeit bis zu 200 Abbildungen.");
  for (const reference of references) {
    const response = await fetch(reference);
    if (!response.ok) throw new Error("Eine Abbildung fehlt. Die vollständige Sicherung wurde nicht erstellt.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    size += bytes.length;
    if (size > MAX_BACKUP_BYTES) throw new Error("Die Bildsicherung überschreitet derzeit 64 MB.");
    const file = "media/" + reference.split("/").pop();
    files[file] = bytes; index[reference] = { file, mime: response.headers.get("content-type") ?? "image/png" };
  }
  files["media-index.json"] = strToU8(JSON.stringify(index));
  const archive = zipSync(files, { level: 0 });
  if (archive.length > MAX_BACKUP_BYTES) throw new Error("Die vollständige Sicherung überschreitet 64 MB.");
  download(archive, fileName() + ".zip", "application/zip");
}
export async function readBackup(file: File): Promise<ImportBundle> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error("Die Sicherungsdatei darf höchstens 64 MB groß sein.");
  if (file.name.toLowerCase().endsWith(".json")) {
    const workspace = workspaceSchema.parse(JSON.parse(await file.text()));
    if (strToU8(JSON.stringify(workspace)).length > MAX_WORKSPACE_BYTES) throw new Error("Die Wissensdaten überschreiten 1,8 MB.");
    return { workspace, assets: [], complete: false };
  }
  let unpackedSize = 0;
  let entries = 0;
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter(entry) {
    if (++entries > 202) throw new Error("Zu viele Dateien in der Sicherung.");
    unpackedSize += entry.originalSize;
    if (unpackedSize > MAX_BACKUP_BYTES || entry.originalSize > MAX_IMAGE_BYTES) throw new Error("Die entpackte Sicherung ist zu groß.");
    return entry.name === "workspace.json" || entry.name === "media-index.json" || /^media\/[0-9a-f-]{36}$/i.test(entry.name);
  } });
  if (!files["workspace.json"] || !files["media-index.json"]) throw new Error("Keine gültige NewHope-Sicherung.");
  const workspace = workspaceSchema.parse(JSON.parse(strFromU8(files["workspace.json"])));
  if (strToU8(JSON.stringify(workspace)).length > MAX_WORKSPACE_BYTES) throw new Error("Die Wissensdaten überschreiten 1,8 MB.");
  const index = JSON.parse(strFromU8(files["media-index.json"])) as Record<string, { file: string; mime: string }>;
  const assets = mediaReferences(workspace).map(oldUrl => {
    const item = index[oldUrl];
    if (!item || !/^media\/[0-9a-f-]{36}$/i.test(item.file) || !files[item.file] || !/^image\/(png|jpeg|webp|gif)$/.test(item.mime)) throw new Error("Die Sicherung enthält nicht alle Abbildungen.");
    return { oldUrl, bytes: files[item.file], mime: item.mime };
  });
  return { workspace, assets, complete: true };
}
export async function prepareImport(bundle: ImportBundle): Promise<Workspace> {
  if (!bundle.complete) {
    for (const reference of mediaReferences(bundle.workspace)) {
      if (!(await fetch(reference)).ok) throw new Error("Eine Bildreferenz ist hier nicht verfügbar. Verwende die vollständige ZIP-Sicherung mit Bildern.");
    }
    return bundle.workspace;
  }
  let encoded = JSON.stringify(bundle.workspace);
  for (const asset of bundle.assets) {
    const file = new File([new Uint8Array(asset.bytes)], "backup-image", { type: asset.mime });
    const replacement = await uploadImage(file);
    encoded = encoded.split(asset.oldUrl).join(replacement);
  }
  return workspaceSchema.parse(JSON.parse(encoded));
}
