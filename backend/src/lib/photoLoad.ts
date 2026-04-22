import { readFile } from "node:fs/promises";
// @ts-expect-error heic-convert ships no types
import heicConvert from "heic-convert";

export type VisionImage = {
  buffer: Buffer;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
};

const SUPPORTED_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function isHeic(mimeType: string, filename: string): boolean {
  const lower = filename.toLowerCase();
  return (
    mimeType === "image/heic" ||
    mimeType === "image/heif" ||
    lower.endsWith(".heic") ||
    lower.endsWith(".heif")
  );
}

export async function loadVisionImage(
  path: string,
  mimeType: string,
  filename: string,
): Promise<VisionImage> {
  const raw = await readFile(path);
  if (isHeic(mimeType, filename)) {
    const jpegBuf = (await heicConvert({
      buffer: raw,
      format: "JPEG",
      quality: 0.9,
    })) as Uint8Array;
    return { buffer: Buffer.from(jpegBuf), mediaType: "image/jpeg" };
  }
  if (SUPPORTED_MEDIA_TYPES.has(mimeType)) {
    return {
      buffer: raw,
      mediaType: mimeType as VisionImage["mediaType"],
    };
  }
  return { buffer: raw, mediaType: "image/jpeg" };
}
