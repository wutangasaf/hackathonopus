import type { FastifyPluginAsync } from "fastify";
import { PhotoGuidance } from "../models/photoGuidance.js";
import { FinancePlan, type FinancePlanDoc } from "../models/financePlan.js";
import { parseObjectId } from "./util.js";
import { runPhotoGuidance } from "../agents/photoGuidance.js";
import { isValidObjectId } from "mongoose";

const photoGuidanceRoutes: FastifyPluginAsync = async (app) => {
  app.get<{
    Params: { id: string };
    Querystring: { milestoneId?: string; regenerate?: string };
  }>("/:id/photo-guidance", async (req, reply) => {
    const projectId = parseObjectId(req.params.id, reply);
    if (!projectId) return;

    let milestoneId = req.query.milestoneId;
    if (milestoneId && !isValidObjectId(milestoneId)) {
      return reply.code(400).send({ error: "invalid milestoneId" });
    }

    if (!milestoneId) {
      const plan = (await FinancePlan.findOne({ projectId }).sort({
        uploadedAt: -1,
      })) as FinancePlanDoc | null;
      if (!plan) {
        return reply
          .code(404)
          .send({ error: "no finance plan parsed — upload one first" });
      }
      const current = plan.milestones
        .slice()
        .sort((a, b) => a.sequence - b.sequence)
        .find((m) => m.status !== "verified" && m.status !== "rejected");
      if (!current) {
        return reply
          .code(404)
          .send({ error: "no active milestone on this project" });
      }
      milestoneId = String(current._id);
    }

    const regenerate = req.query.regenerate === "1" || req.query.regenerate === "true";
    if (!regenerate) {
      const cached = await PhotoGuidance.findOne({
        projectId,
        milestoneId,
      }).sort({ generatedAt: -1 });
      if (cached) return cached;
    }

    try {
      await runPhotoGuidance(projectId, milestoneId);
    } catch (err) {
      return reply.code(500).send({
        error: "photo guidance generation failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
    const fresh = await PhotoGuidance.findOne({
      projectId,
      milestoneId,
    }).sort({ generatedAt: -1 });
    if (!fresh) {
      return reply.code(500).send({ error: "agent ran but no row persisted" });
    }
    return fresh;
  });
};

export default photoGuidanceRoutes;
