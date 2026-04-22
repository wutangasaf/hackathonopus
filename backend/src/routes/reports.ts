import type { FastifyPluginAsync } from "fastify";
import { notImplemented } from "./util.js";

const reportsRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { id: string } }>("/:id/reports", async (_req, reply) => {
    return notImplemented(reply, "POST", "/api/projects/:id/reports");
  });

  app.get<{ Params: { id: string } }>("/:id/reports", async (_req, reply) => {
    return notImplemented(reply, "GET", "/api/projects/:id/reports");
  });

  app.get<{ Params: { id: string; reportId: string } }>(
    "/:id/reports/:reportId",
    async (_req, reply) => {
      return notImplemented(reply, "GET", "/api/projects/:id/reports/:reportId");
    },
  );
};

export default reportsRoutes;
