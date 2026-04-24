import type { FastifyPluginAsync } from "fastify";
import projectsRoutes from "./projects.js";
import plansRoutes from "./plans.js";
import financePlanRoutes from "./financePlan.js";
import photoGuidanceRoutes from "./photoGuidance.js";
import photosRoutes from "./photos.js";
import reportsRoutes from "./reports.js";
import runsRoutes from "./runs.js";
import drawsRoutes from "./draws.js";
import supervisorRoutes from "./supervisor.js";

export const registerRoutes: FastifyPluginAsync = async (app) => {
  await app.register(projectsRoutes, { prefix: "/api/projects" });
  await app.register(plansRoutes, { prefix: "/api/projects" });
  await app.register(financePlanRoutes, { prefix: "/api/projects" });
  await app.register(photoGuidanceRoutes, { prefix: "/api/projects" });
  await app.register(photosRoutes, { prefix: "/api/projects" });
  await app.register(reportsRoutes, { prefix: "/api/projects" });
  await app.register(runsRoutes, { prefix: "/api/projects" });
  await app.register(drawsRoutes, { prefix: "/api/projects" });
  await app.register(supervisorRoutes, { prefix: "/api/projects" });
};

export default registerRoutes;
