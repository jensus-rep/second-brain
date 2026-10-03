export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MEDIA_PATTERN = /^\/api\/media\/[0-9a-f-]{36}$/i;
export function isPrivateImage(src: string) { return MEDIA_PATTERN.test(src); }
export function mediaReferences(value: unknown): string[] {
  return [...new Set(JSON.stringify(value).match(/\/api\/media\/[0-9a-f-]{36}/gi) ?? [])];
}
export function firstImage(content: string): { src: string; alt: string } | null {
  const match = content.match(/!\[([^\]]*)\]\((\/api\/media\/[0-9a-f-]{36})(?:\s+"[^"]*")?\)/i);
  return match ? { src: match[2], alt: match[1] } : null;
}
export function noteExcerpt(content: string): string {
  return content.replace(/```[\s\S]*?```/g, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[#*>_`]/g, "").replace(/\s+/g, " ").trim().slice(0, 150) || "Eine visuelle Notiz.";
}
export async function uploadImage(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Bilder dürfen maximal 8 MB groß sein.");
  try {
    const bitmap = await createImageBitmap(file);
    const valid = bitmap.width > 0 && bitmap.height > 0 && bitmap.width <= 12000 && bitmap.height <= 12000 && bitmap.width * bitmap.height <= 24_000_000;
    bitmap.close();
    if (!valid) throw new Error();
  } catch { throw new Error("Die Bilddatei ist beschädigt oder größer als 24 Megapixel."); }
  const response = await fetch("/api/media", { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
  const data = await response.json() as { url?: string; error?: string };
  if (!response.ok || !data.url) throw new Error(data.error ?? "Bild konnte nicht gespeichert werden.");
  return data.url;
}
export function imageMarkdown(src: string, alt: string, caption: string) {
  const safeAlt = alt.replace(/[\[\]\r\n]/g, " ").trim() || "Abbildung";
  const safeCaption = caption.replace(/["\r\n]/g, " ").trim();
  return "![" + safeAlt + "](" + src + (safeCaption ? ' "' + safeCaption + '"' : "") + ")";
}
