import type { FastifyPluginAsync } from "fastify";
import { AgentRun } from "../models/agentRun.js";
import { parseObjectId } from "./util.js";

const runsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>("/:id/runs", async (req, reply) => {
    const projectId = parseObjectId(req.params.id, reply);
    if (!projectId) return;
    return AgentRun.find({ projectId }).sort({ startedAt: -1 });
  });

  app.get<{ Params: { id: string; runId: string } }>(
    "/:id/runs/:runId",
    async (req, reply) => {
      const projectId = parseObjectId(req.params.id, reply);
      if (!projectId) return;
      const runId = parseObjectId(req.params.runId, reply);
      if (!runId) return;
      const run = await AgentRun.findOne({ _id: runId, projectId });
      if (!run) return reply.code(404).send({ error: "run not found" });
      return run;
    },
  );
};

export default runsRoutes;
