import type { FastifyPluginAsync } from "fastify";
import { isValidObjectId } from "mongoose";
import { GapReport } from "../models/gapReport.js";
import { runComparisonAndGap } from "../agents/comparisonAndGap.js";
import { parseObjectId } from "./util.js";

const reportsRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Params: { id: string };
    Querystring: { milestoneId?: string; drawId?: string };
  }>("/:id/reports", async (req, reply) => {
    const projectId = parseObjectId(req.params.id, reply);
    if (!projectId) return;

    const milestoneId = req.query.milestoneId;
    if (milestoneId && !isValidObjectId(milestoneId)) {
      return reply.code(400).send({ error: "invalid milestoneId" });
    }
    const drawId = req.query.drawId;
    if (drawId && !isValidObjectId(drawId)) {
      return reply.code(400).send({ error: "invalid drawId" });
    }

    try {
      const { result } = await runComparisonAndGap(projectId, {
        milestoneId,
        drawId,
      });
      const report = await GapReport.findById(result.gapReportId);
      if (!report) {
        return reply.code(500).send({ error: "agent ran but report missing" });
      }
      return reply.code(201).send(report);
    } catch (err) {
      return reply.code(500).send({
        error: "gap report generation failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get<{ Params: { id: string } }>("/:id/reports", async (req, reply) => {
    const projectId = parseObjectId(req.params.id, reply);
    if (!projectId) return;
    return GapReport.find({ projectId }).sort({ generatedAt: -1 });
  });

  app.get<{ Params: { id: string; reportId: string } }>(
    "/:id/reports/:reportId",
    async (req, reply) => {
      const projectId = parseObjectId(req.params.id, reply);
      if (!projectId) return;
      const reportId = parseObjectId(req.params.reportId, reply);
      if (!reportId) return;
      const report = await GapReport.findOne({ _id: reportId, projectId });
      if (!report) return reply.code(404).send({ error: "report not found" });
      return report;
    },
  );
};

export default reportsRoutes;
