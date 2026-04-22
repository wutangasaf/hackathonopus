import type { FastifyPluginAsync } from "fastify";
import { DocumentModel } from "../models/document.js";
import { notImplemented, parseObjectId } from "./util.js";
import { ingestMultipartFile } from "./upload.js";

const PENDING_PLAN_AGENTS = ["PlanClassifier", "PlanFormatExtractor"] as const;

const plansRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { id: string } }>("/:id/plans", async (req, reply) => {
    const projectId = parseObjectId(req.params.id, reply);
    if (!projectId) return;

    const documents: unknown[] = [];
    let gotAny = false;

    for await (const part of req.parts()) {
      if (part.type !== "file") continue;
      gotAny = true;
      const { document } = await ingestMultipartFile(part, "PLAN", projectId);
      documents.push(document);
    }

    if (!gotAny) {
      return reply.code(400).send({ error: "no file parts in multipart body" });
    }

    return reply.code(201).send({
      documents,
      pendingAgents: PENDING_PLAN_AGENTS,
    });
  });

  app.get<{ Params: { id: string } }>("/:id/plans", async (req, reply) => {
    const projectId = parseObjectId(req.params.id, reply);
    if (!projectId) return;
    return DocumentModel.find({ projectId, kind: "PLAN" }).sort({
      serverReceivedAt: -1,
    });
  });

  app.get<{ Params: { id: string } }>(
    "/:id/plan-classification",
    async (_req, reply) => {
      return notImplemented(
        reply,
        "GET",
        "/api/projects/:id/plan-classification",
      );
    },
  );

  app.get<{ Params: { id: string } }>("/:id/plan-format", async (_req, reply) => {
    return notImplemented(reply, "GET", "/api/projects/:id/plan-format");
  });
};

export default plansRoutes;
