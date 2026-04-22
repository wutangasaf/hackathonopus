import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyRequest } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import { config } from "../config.js";
import { sha256OfBuffer } from "../lib/sha256.js";
import { DocumentModel, type DocumentKind, type DocumentDoc } from "../models/document.js";
import { sanitizeFilename } from "./util.js";

export type IngestedDocument = {
  document: DocumentDoc;
  duplicate: boolean;
};

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

  const doc = (await DocumentModel.create({
    projectId,
    kind,
    originalFilename: part.filename || "upload.bin",
    storagePath,
    mimeType: part.mimetype || "application/octet-stream",
    sha256: sha,
    serverReceivedAt: new Date(),
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
