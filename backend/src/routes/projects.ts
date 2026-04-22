import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { Project } from "../models/project.js";
import { parseObjectId } from "./util.js";

const createBody = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
});

const projectsRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", async (req, reply) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const project = await Project.create(parsed.data);
    return reply.code(201).send(project);
  });

  app.get("/", async () => {
    return Project.find().sort({ createdAt: -1 });
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const id = parseObjectId(req.params.id, reply);
    if (!id) return;
    const project = await Project.findById(id);
    if (!project) return reply.code(404).send({ error: "project not found" });
    return project;
  });
};

export default projectsRoutes;
