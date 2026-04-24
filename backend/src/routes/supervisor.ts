import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";
import { Draw } from "../models/draw.js";
import { Project } from "../models/project.js";
import { SupervisorSession } from "../models/supervisorSession.js";
import {
  loadSupervisorSession,
  runSupervisorInvestigation,
  type SupervisorStreamEvent,
} from "../agents/supervisor.js";
import { parseObjectId } from "./util.js";

type InvestigateBody = {
  drawId?: string;
};

const supervisorRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { id: string }; Body: InvestigateBody }>(
    "/:id/supervisor/investigate",
    async (req, reply) => {
      const projectId = parseObjectId(req.params.id, reply);
      if (!projectId) return;

      const project = await Project.findById(projectId);
      if (!project) {
        return reply.code(404).send({ error: "project not found" });
      }

      const body = (req.body ?? {}) as InvestigateBody;
      const drawId = body.drawId;
      if (!drawId || !Types.ObjectId.isValid(drawId)) {
        return reply.code(400).send({ error: "drawId is required" });
      }

      const draw = await Draw.findOne({
        _id: new Types.ObjectId(drawId),
        projectId: new Types.ObjectId(projectId),
      });
      if (!draw) {
        return reply
          .code(404)
          .send({ error: "draw not found for this project" });
      }

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      reply.hijack();

      const write = (payload: unknown) => {
        if (reply.raw.writableEnded) return;
        reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
      };

      const keepAlive = setInterval(() => {
        if (reply.raw.writableEnded) return;
        reply.raw.write(`: keep-alive\n\n`);
      }, 15000);

      let clientClosed = false;
      const ac = new AbortController();
      reply.raw.on("close", () => {
        clientClosed = true;
        clearInterval(keepAlive);
        ac.abort();
      });

      write({ type: "connected" });

      try {
        const { sessionId } = await runSupervisorInvestigation({
          projectId,
          drawId,
          signal: ac.signal,
          onEvent: async (ev: SupervisorStreamEvent) => {
            if (clientClosed) return;
            write({ type: "event", event: ev });
          },
        });

        if (!clientClosed) {
          const snapshot = await loadSupervisorSession(sessionId);
          write({ type: "complete", snapshot });
        }
      } catch (err) {
        write({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        clearInterval(keepAlive);
        if (!reply.raw.writableEnded) {
          reply.raw.end();
        }
      }
    },
  );

  app.get<{ Params: { id: string; sessionId: string } }>(
    "/:id/supervisor/sessions/:sessionId",
    async (req, reply) => {
      const projectId = parseObjectId(req.params.id, reply);
      if (!projectId) return;
      if (!Types.ObjectId.isValid(req.params.sessionId)) {
        return reply.code(400).send({ error: "invalid session id" });
      }

      const snapshot = await loadSupervisorSession(req.params.sessionId);
      if (!snapshot) {
        return reply.code(404).send({ error: "session not found" });
      }
      if (String(snapshot.session.projectId) !== String(projectId)) {
        return reply.code(404).send({ error: "session not found" });
      }
      return snapshot;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/:id/supervisor/sessions",
    async (req, reply) => {
      const projectId = parseObjectId(req.params.id, reply);
      if (!projectId) return;

      const sessions = await SupervisorSession.find({
        projectId: new Types.ObjectId(projectId),
      })
        .sort({ startedAt: -1 })
        .limit(50)
        .lean();
      return { sessions };
    },
  );
};

export default supervisorRoutes;
