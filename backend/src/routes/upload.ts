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

export async function ingestMultipartFile(
  part: MultipartFile,
  kind: DocumentKind,
  projectId: string,
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

  const exifMeta = kind === "PHOTO" ? await extractPhotoExif(buf) : undefined;

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
