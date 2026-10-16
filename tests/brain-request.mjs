import { gunzipSync } from "node:zlib";

/** The app uploads its collection gzip-compressed; tests read the same JSON body. */
export function brainBody(request) {
  const raw = request.postDataBuffer() ?? Buffer.alloc(0);
  return JSON.parse((raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw).toString("utf8"));
}
