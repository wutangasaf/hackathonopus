import type { FastifyPluginAsync } from "fastify";
import { isValidObjectId } from "mongoose";
import { PhotoGuidance } from "../models/photoGuidance.js";
import { Draw } from "../models/draw.js";
import { parseObjectId } from "./util.js";
import { runPhotoGuidance } from "../agents/photoGuidance.js";

const photoGuidanceRoutes: FastifyPluginAsync = async (app) => {
  app.get<{
    Params: { id: string };
    Querystring: { drawId?: string; regenerate?: string };
  }>("/:id/photo-guidance", async (req, reply) => {
    const projectId = parseObjectId(req.params.id, reply);
    if (!projectId) return;

    let drawId = req.query.drawId;
    if (drawId && !isValidObjectId(drawId)) {
      return reply.code(400).send({ error: "invalid drawId" });
    }

    if (!drawId) {
      const latestApproved = await Draw.findOne({
        projectId,
        status: "approved",
      }).sort({ approvedAt: -1, drawNumber: -1 });
      if (!latestApproved) {
        return reply.code(404).send({
          error:
            "no approved draw on this project — contractor must approve a G703 draw request first",
        });
      }
      drawId = String(latestApproved._id);
    } else {
      const draw = await Draw.findOne({ _id: drawId, projectId });
      if (!draw) return reply.code(404).send({ error: "draw not found" });
      if (draw.status !== "approved") {
        return reply.code(409).send({
          error: `draw is not approved (status=${draw.status})`,
        });
      }
    }

    const regenerate =
      req.query.regenerate === "1" || req.query.regenerate === "true";
    if (!regenerate) {
      const cached = await PhotoGuidance.findOne({
        projectId,
        drawId,
      }).sort({ generatedAt: -1 });
      if (cached) return cached;
    }

    try {
      await runPhotoGuidance(projectId, drawId);
    } catch (err) {
      return reply.code(500).send({
        error: "photo guidance generation failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
    const fresh = await PhotoGuidance.findOne({
      projectId,
      drawId,
    }).sort({ generatedAt: -1 });
    if (!fresh) {
      return reply.code(500).send({ error: "agent ran but no row persisted" });
    }
    return fresh;
  });
};

export default photoGuidanceRoutes;
