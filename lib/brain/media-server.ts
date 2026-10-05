import { imageSize } from "image-size";
import { MAX_IMAGE_BYTES } from "./media";

export async function imageBytes(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_IMAGE_BYTES) throw new Error("Bilder dürfen maximal 8 MB groß sein.");
  if (!request.body) throw new Error("Keine Bilddatei vorhanden.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_IMAGE_BYTES) { await reader.cancel(); throw new Error("Bilder dürfen maximal 8 MB groß sein."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let dimensions;
  try { dimensions = imageSize(bytes); } catch { throw new Error("Die Datei ist kein lesbares Bild."); }
  const mime = ({ png: "image/png", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif" } as Record<string, string>)[dimensions.type ?? ""];
  if (!mime) throw new Error("Bitte PNG, JPEG, WebP oder GIF verwenden.");
  if (!dimensions.width || !dimensions.height || dimensions.width * dimensions.height > 24_000_000 || dimensions.width > 12000 || dimensions.height > 12000) throw new Error("Bitte ein Bild mit höchstens 24 Megapixeln verwenden.");
  return { bytes, mime };
}

