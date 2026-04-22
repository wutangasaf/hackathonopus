import type { FastifyPluginAsync } from "fastify";
import { notImplemented } from "./util.js";

const photoGuidanceRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>(
    "/:id/photo-guidance",
    async (_req, reply) => {
      return notImplemented(reply, "GET", "/api/projects/:id/photo-guidance");
    },
  );
};

export default photoGuidanceRoutes;
