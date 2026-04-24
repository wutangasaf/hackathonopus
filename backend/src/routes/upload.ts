import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyRequest } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import exifr from "exifr";
import { config } from "../config.js";
import { sha256OfBuffer } from "../lib/sha256.js";
import { DocumentModel, type DocumentKind, type DocumentDoc } from "../models/document.js";
import { sanitizeFilename } from "./util.js";

export type IngestedDocument = {
  document: DocumentDoc;
  duplicate: boolean;
};

export type ExifMeta = {
  present: boolean;
  capturedAt?: string;
  gps?: { lat: number; lon: number; altitude?: number };
  camera?: { make?: string; model?: string };
  orientation?: number;
  error?: string;
  // "exif_verified" = extracted from the image bytes (native camera path).
  // "client_hinted" = filled in from sidecar form fields supplied by a
  // browser capture (getUserMedia / in-page photo) where the JPEG bytes
  // carry no EXIF. Use this to grade trust in the UI.
  source?: "exif_verified" | "client_hinted";
  captureSource?:
    | "phone_camera"
    | "desktop_camera"
    | "native_upload"
    | "drone"
    | "iot";
};

export type ClientPhotoHint = {
  capturedAt?: string;
  lat?: number;
  lon?: number;
  captureSource?: ExifMeta["captureSource"];
};

async function extractPhotoExif(buf: Buffer): Promise<ExifMeta> {
  try {
    const raw = (await exifr.parse(buf, { gps: true })) as
      | Record<string, unknown>
      | undefined;

    if (!raw) return { present: false };

    const out: ExifMeta = { present: true };

    const taken =
      (raw.DateTimeOriginal as Date | undefined) ??
      (raw.CreateDate as Date | undefined) ??
      (raw.ModifyDate as Date | undefined);
    if (taken instanceof Date && !Number.isNaN(taken.getTime())) {
      out.capturedAt = taken.toISOString();
    }

    const lat = raw.latitude as number | undefined;
    const lon = raw.longitude as number | undefined;
    if (typeof lat === "number" && typeof lon === "number") {
      out.gps = { lat, lon };
      const alt = raw.GPSAltitude as number | undefined;
      if (typeof alt === "number") out.gps.altitude = alt;
    }

    const make = raw.Make as string | undefined;
    const model = raw.Model as string | undefined;
    if (make || model) {
      out.camera = {};
      if (make) out.camera.make = make;
      if (model) out.camera.model = model;
    }

    const orient = raw.Orientation as number | string | undefined;
    if (typeof orient === "number") out.orientation = orient;

    return out;
  } catch (err) {
    return {
      present: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function mergeHintIntoExif(base: ExifMeta, hint: ClientPhotoHint): ExifMeta {
  // If the bytes carried real EXIF, keep it authoritative and only tag the
  // capture source if the client told us one we don't already know. If the
  // bytes had no EXIF, synthesize from the sidecar fields and mark it
  // client-hinted so the UI can show a weaker trust tier.
  if (base.present) {
    return {
      ...base,
      source: "exif_verified",
      captureSource: base.captureSource ?? hint.captureSource ?? "native_upload",
    };
  }

  const out: ExifMeta = {
    ...base,
    source: "client_hinted",
    captureSource: hint.captureSource ?? "desktop_camera",
  };
  if (hint.capturedAt) {
    const d = new Date(hint.capturedAt);
    if (!Number.isNaN(d.getTime())) out.capturedAt = d.toISOString();
  }
  if (typeof hint.lat === "number" && typeof hint.lon === "number") {
    out.gps = { lat: hint.lat, lon: hint.lon };
  }
  return out;
}

export async function ingestMultipartFile(
  part: MultipartFile,
  kind: DocumentKind,
  projectId: string,
  hint?: ClientPhotoHint,
): Promise<IngestedDocument> {
  const buf = await part.toBuffer();
  const sha = sha256OfBuffer(buf);

  const existing = await DocumentModel.findOne({ projectId, sha256: sha });
  if (existing) {
    return { document: existing as DocumentDoc, duplicate: true };
  }

  const safe = sanitizeFilename(part.filename || "upload.bin");
  const storagePath = path.join(config.uploadsDir, `${randomUUID()}-${safe}`);
  await writeFile(storagePath, buf);

  let exifMeta: ExifMeta | undefined;
  if (kind === "PHOTO") {
    const extracted = await extractPhotoExif(buf);
    exifMeta = hint ? mergeHintIntoExif(extracted, hint) : extracted;
  }

  const doc = (await DocumentModel.create({
    projectId,
    kind,
    originalFilename: part.filename || "upload.bin",
    storagePath,
    mimeType: part.mimetype || "application/octet-stream",
    sha256: sha,
    serverReceivedAt: new Date(),
    exifMeta,
  })) as unknown as DocumentDoc;

  return { document: doc, duplicate: false };
}

export async function collectFileParts(req: FastifyRequest): Promise<MultipartFile[]> {
  const parts: MultipartFile[] = [];
  for await (const part of req.parts()) {
    if (part.type === "file") {
      parts.push(part);
    }
  }
  return parts;
}
