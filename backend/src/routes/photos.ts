import { createReadStream } from "node:fs";
import { stat, readFile, unlink } from "node:fs/promises";
import type { FastifyPluginAsync } from "fastify";
import type { Types } from "mongoose";
// @ts-expect-error heic-convert ships no types
import heicConvert from "heic-convert";
import { DocumentModel } from "../models/document.js";
import { PhotoAssessment } from "../models/photoAssessment.js";
import { Observation } from "../models/observation.js";
import { AgentRun } from "../models/agentRun.js";
import { ingestMultipartFile } from "./upload.js";
import { parseObjectId } from "./util.js";
import { kickoffPhotoPipeline } from "../agents/photoPipeline.js";

const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "mif1",
  "msf1",
  "heif",
]);

function isHeic(mimeType: string, filename: string, headBuf?: Buffer): boolean {
  const lower = filename.toLowerCase();
  if (
    mimeType === "image/heic" ||
    mimeType === "image/heif" ||
    lower.endsWith(".heic") ||
    lower.endsWith(".heif")
  ) {
    return true;
  }
  if (headBuf && headBuf.length >= 12) {
    if (headBuf.slice(4, 8).toString("ascii") === "ftyp") {
      const brand = headBuf.slice(8, 12).toString("ascii");
      if (HEIC_BRANDS.has(brand)) return true;
    }
  }
  return false;
}

const PENDING_PHOTO_AGENTS = ["PhotoQuality", "PhotoToPlanFormat"] as const;

const photosRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { id: string } }>("/:id/photos", async (req, reply) => {
    const projectId = parseObjectId(req.params.id, reply);
    if (!projectId) return;

    const documents: unknown[] = [];
    const kickedOff: string[] = [];
    let gotAny = false;

    for await (const part of req.parts()) {
      if (part.type !== "file") continue;
      gotAny = true;
      const { document, duplicate } = await ingestMultipartFile(
        part,
        "PHOTO",
        projectId,
      );
      documents.push(document);
      if (!duplicate) {
        kickoffPhotoPipeline(
          (document as { _id: Types.ObjectId })._id,
          app.log,
        );
        kickedOff.push(String((document as { _id: Types.ObjectId })._id));
      }
    }

    if (!gotAny) {
      return reply.code(400).send({ error: "no file parts in multipart body" });
    }

    return reply.code(201).send({
      documents,
      pendingAgents: PENDING_PHOTO_AGENTS,
      pipelineKickedOffFor: kickedOff,
    });
  });

  app.get<{ Params: { id: string } }>("/:id/photos", async (req, reply) => {
    const projectId = parseObjectId(req.params.id, reply);
    if (!projectId) return;
    return DocumentModel.find({ projectId, kind: "PHOTO" }).sort({
      serverReceivedAt: -1,
    });
  });

  app.get<{ Params: { id: string; photoId: string } }>(
    "/:id/photos/:photoId/raw",
    async (req, reply) => {
      const projectId = parseObjectId(req.params.id, reply);
      if (!projectId) return;
      const photoId = parseObjectId(req.params.photoId, reply);
      if (!photoId) return;

      const doc = await DocumentModel.findOne({
        _id: photoId,
        projectId,
        kind: "PHOTO",
      });
      if (!doc) return reply.code(404).send({ error: "photo not found" });

      try {
        await stat(doc.storagePath);
      } catch {
        return reply
          .code(410)
          .send({ error: "photo bytes no longer available" });
      }

      const head = Buffer.alloc(12);
      try {
        const fd = await readFile(doc.storagePath);
        fd.copy(head, 0, 0, Math.min(12, fd.length));
        if (isHeic(doc.mimeType, doc.originalFilename, head)) {
          const jpeg = (await heicConvert({
            buffer: fd,
            format: "JPEG",
            quality: 0.9,
          })) as Uint8Array;
          reply.header("content-type", "image/jpeg");
          reply.header("cache-control", "private, max-age=300");
          return reply.send(Buffer.from(jpeg));
        }
      } catch (err) {
        req.log.error({ err, photoId: String(photoId) }, "raw photo read failed");
        return reply.code(500).send({ error: "failed to read photo bytes" });
      }

      reply.header("content-type", doc.mimeType || "application/octet-stream");
      reply.header("cache-control", "private, max-age=300");
      return reply.send(createReadStream(doc.storagePath));
    },
  );

  app.get<{ Params: { id: string; photoId: string } }>(
    "/:id/photos/:photoId",
    async (req, reply) => {
      const projectId = parseObjectId(req.params.id, reply);
      if (!projectId) return;
      const photoId = parseObjectId(req.params.photoId, reply);
      if (!photoId) return;
      const doc = await DocumentModel.findOne({
        _id: photoId,
        projectId,
        kind: "PHOTO",
      });
      if (!doc) return reply.code(404).send({ error: "photo not found" });

      const [assessment, observation] = await Promise.all([
        PhotoAssessment.findOne({ photoDocumentId: photoId }).sort({
          createdAt: -1,
        }),
        Observation.findOne({ photoDocumentId: photoId }).sort({
          observedAt: -1,
        }),
      ]);

      return { document: doc, assessment, observation };
    },
  );

  app.delete<{ Params: { id: string; photoId: string } }>(
    "/:id/photos/:photoId",
    async (req, reply) => {
      const projectId = parseObjectId(req.params.id, reply);
      if (!projectId) return;
      const photoId = parseObjectId(req.params.photoId, reply);
      if (!photoId) return;

      const doc = await DocumentModel.findOne({
        _id: photoId,
        projectId,
        kind: "PHOTO",
      });
      if (!doc) return reply.code(404).send({ error: "photo not found" });

      await AgentRun.updateMany(
        {
          projectId,
          status: "running",
          agentName: { $in: ["PhotoQuality", "PhotoToPlanFormat"] },
          "input.photoDocumentId": String(photoId),
        },
        {
          $set: {
            status: "failed",
            error: "document deleted: processing cancelled",
            completedAt: new Date(),
          },
        },
      );

      await Promise.all([
        PhotoAssessment.deleteMany({ photoDocumentId: photoId }),
        Observation.deleteMany({ photoDocumentId: photoId }),
      ]);

      try {
        await unlink(doc.storagePath);
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e.code !== "ENOENT") {
          req.log.warn(
            { err: e, photoId: String(photoId) },
            "failed to unlink photo file",
          );
        }
      }

      await DocumentModel.deleteOne({ _id: photoId });
      return reply.code(204).send();
    },
  );
};

export default photosRoutes;
