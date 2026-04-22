import type { FastifyPluginAsync } from "fastify";
import { DocumentModel } from "../models/document.js";
import { ingestMultipartFile } from "./upload.js";
import { parseObjectId } from "./util.js";

const PENDING_PHOTO_AGENTS = [
  "PhotoQuality",
  "PhotoToPlanFormat",
] as const;

const photosRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { id: string } }>("/:id/photos", async (req, reply) => {
    const projectId = parseObjectId(req.params.id, reply);
    if (!projectId) return;

    const documents: unknown[] = [];
    let gotAny = false;

    for await (const part of req.parts()) {
      if (part.type !== "file") continue;
      gotAny = true;
      const { document } = await ingestMultipartFile(part, "PHOTO", projectId);
      documents.push(document);
    }

    if (!gotAny) {
      return reply.code(400).send({ error: "no file parts in multipart body" });
    }

    return reply.code(201).send({
      documents,
      pendingAgents: PENDING_PHOTO_AGENTS,
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
      return doc;
    },
  );
};

export default photosRoutes;
