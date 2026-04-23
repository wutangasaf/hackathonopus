import { unlink } from "node:fs/promises";
import type { FastifyPluginAsync } from "fastify";
import { DocumentModel } from "../models/document.js";
import {
  PlanClassification,
  DISCIPLINES,
  type Discipline,
} from "../models/planClassification.js";
import { PlanFormat } from "../models/planFormat.js";
import { FinancePlan } from "../models/financePlan.js";
import { AgentRun } from "../models/agentRun.js";
import { parseObjectId } from "./util.js";
import { ingestMultipartFile } from "./upload.js";
import { kickoffPlanPipeline } from "../agents/pipeline.js";

const PENDING_PLAN_AGENTS = ["PlanClassifier", "PlanFormatExtractor"] as const;

const plansRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { id: string } }>("/:id/plans", async (req, reply) => {
    const projectId = parseObjectId(req.params.id, reply);
    if (!projectId) return;

    const documents: unknown[] = [];
    let gotAny = false;
    let addedNew = false;

    for await (const part of req.parts()) {
      if (part.type !== "file") continue;
      gotAny = true;
      const { document, duplicate } = await ingestMultipartFile(
        part,
        "PLAN",
        projectId,
      );
      documents.push(document);
      if (!duplicate) addedNew = true;
    }

    if (!gotAny) {
      return reply.code(400).send({ error: "no file parts in multipart body" });
    }

    if (addedNew) {
      kickoffPlanPipeline(projectId, app.log);
    }

    return reply.code(201).send({
      documents,
      pendingAgents: PENDING_PLAN_AGENTS,
      pipelineKickedOff: addedNew,
    });
  });

  app.get<{ Params: { id: string } }>("/:id/plans", async (req, reply) => {
    const projectId = parseObjectId(req.params.id, reply);
    if (!projectId) return;
    return DocumentModel.find({ projectId, kind: "PLAN" }).sort({
      serverReceivedAt: -1,
    });
  });

  app.delete<{ Params: { id: string; docId: string } }>(
    "/:id/plans/:docId",
    async (req, reply) => {
      const projectId = parseObjectId(req.params.id, reply);
      if (!projectId) return;
      const docId = parseObjectId(req.params.docId, reply);
      if (!docId) return;

      const doc = await DocumentModel.findOne({
        _id: docId,
        projectId,
        kind: "PLAN",
      });
      if (!doc) return reply.code(404).send({ error: "plan document not found" });

      const plan = await FinancePlan.findOne({ projectId }).sort({
        uploadedAt: -1,
      });
      if (plan) {
        const referencingMilestone = plan.milestones.find((m) =>
          m.planDocRefs.some((ref) => String(ref.documentId) === String(docId)),
        );
        if (referencingMilestone) {
          return reply.code(409).send({
            error: `referenced by milestone "${referencingMilestone.name}": edit the finance plan first`,
          });
        }
      }

      await AgentRun.updateMany(
        {
          projectId,
          status: "running",
          agentName: { $in: ["PlanClassifier", "PlanFormatExtractor"] },
        },
        {
          $set: {
            status: "failed",
            error: "document deleted: processing cancelled",
            completedAt: new Date(),
          },
        },
      );

      const classification = await PlanClassification.findOne({ projectId }).sort({
        version: -1,
      });
      if (classification) {
        await PlanClassification.updateOne(
          { _id: classification._id },
          {
            $pull: {
              sheets: { documentId: docId },
              sourceDocumentIds: docId,
            },
          },
        );
        const after = await PlanClassification.findById(classification._id);
        if (after && after.sheets.length === 0) {
          await PlanClassification.deleteOne({ _id: after._id });
        }
      }

      try {
        await unlink(doc.storagePath);
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e.code !== "ENOENT") {
          req.log.warn({ err: e, docId: String(docId) }, "failed to unlink plan file");
        }
      }

      await DocumentModel.deleteOne({ _id: docId });
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { id: string } }>(
    "/:id/plan-classification",
    async (req, reply) => {
      const projectId = parseObjectId(req.params.id, reply);
      if (!projectId) return;
      const doc = await PlanClassification.findOne({ projectId }).sort({
        version: -1,
      });
      if (!doc) {
        return reply
          .code(404)
          .send({ error: "no plan classification yet — pipeline still running or failed" });
      }
      return doc;
    },
  );

  app.get<{
    Params: { id: string };
    Querystring: { discipline?: string };
  }>("/:id/plan-format", async (req, reply) => {
    const projectId = parseObjectId(req.params.id, reply);
    if (!projectId) return;

    const raw = req.query.discipline;
    if (raw !== undefined) {
      if (!(DISCIPLINES as readonly string[]).includes(raw)) {
        return reply.code(400).send({
          error: `discipline must be one of: ${DISCIPLINES.join(", ")}`,
        });
      }
      const discipline = raw as Discipline;
      const format = await PlanFormat.findOne({ projectId, discipline }).sort({
        version: -1,
      });
      if (!format) {
        return reply
          .code(404)
          .send({ error: `no plan format for discipline=${discipline}` });
      }
      return format;
    }

    const formats = await Promise.all(
      DISCIPLINES.map((d) =>
        PlanFormat.findOne({ projectId, discipline: d }).sort({ version: -1 }),
      ),
    );
    const nonEmpty = formats.filter((f) => f !== null);
    return { formats: nonEmpty };
  });
};

export default plansRoutes;
