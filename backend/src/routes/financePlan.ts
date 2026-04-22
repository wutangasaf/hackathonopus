import type { FastifyPluginAsync } from "fastify";
import { FinancePlan } from "../models/financePlan.js";
import { ingestMultipartFile } from "./upload.js";
import { parseObjectId } from "./util.js";
import { kickoffFinancePlanPipeline } from "../agents/financePipeline.js";

const PENDING_FINANCE_AGENTS = ["FinancePlanIngester"] as const;

const financePlanRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { id: string } }>(
    "/:id/finance-plan",
    async (req, reply) => {
      const projectId = parseObjectId(req.params.id, reply);
      if (!projectId) return;

      const part = await req.file();
      if (!part) {
        return reply.code(400).send({ error: "no file part in multipart body" });
      }
      const { document, duplicate } = await ingestMultipartFile(
        part,
        "FINANCE_PLAN",
        projectId,
      );
      if (!duplicate) {
        kickoffFinancePlanPipeline(projectId, app.log);
      }
      return reply.code(201).send({
        document,
        pendingAgents: PENDING_FINANCE_AGENTS,
        pipelineKickedOff: !duplicate,
      });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/:id/finance-plan",
    async (req, reply) => {
      const projectId = parseObjectId(req.params.id, reply);
      if (!projectId) return;
      const plan = await FinancePlan.findOne({ projectId }).sort({
        uploadedAt: -1,
      });
      if (!plan) {
        return reply.code(404).send({ error: "no finance plan parsed yet" });
      }
      return plan;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/:id/finance-plan/current-milestone",
    async (req, reply) => {
      const projectId = parseObjectId(req.params.id, reply);
      if (!projectId) return;
      const plan = await FinancePlan.findOne({ projectId }).sort({
        uploadedAt: -1,
      });
      if (!plan) {
        return reply.code(404).send({ error: "no finance plan parsed yet" });
      }
      const current = plan.milestones
        .slice()
        .sort((a, b) => a.sequence - b.sequence)
        .find((m) => m.status !== "verified" && m.status !== "rejected");
      if (!current) {
        return reply.code(404).send({
          error: "no non-terminal milestone — loan appears complete",
        });
      }
      return current;
    },
  );
};

export default financePlanRoutes;
