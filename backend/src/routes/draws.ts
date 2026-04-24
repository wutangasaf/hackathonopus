import type { FastifyPluginAsync } from "fastify";
import { isValidObjectId, Types } from "mongoose";
import { z } from "zod";
import { Draw } from "../models/draw.js";
import { FinancePlan } from "../models/financePlan.js";
import { Project } from "../models/project.js";
import { DEFAULT_CONTRACTOR } from "../lib/defaultContractor.js";
import type { DocumentDoc, DocumentKind } from "../models/document.js";
import { ingestMultipartFile } from "./upload.js";
import { parseObjectId } from "./util.js";
import { runG703Extractor } from "../agents/g703Extractor.js";

const patchLineSchema = z
  .object({
    confirmedMilestoneId: z.string().min(1).optional(),
    approvalStatus: z.enum(["pending", "confirmed", "overridden"]),
  })
  .refine(
    (v) => v.approvalStatus !== "overridden" || !!v.confirmedMilestoneId,
    {
      message: "confirmedMilestoneId is required when approvalStatus='overridden'",
    },
  );

const drawsRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { id: string } }>("/:id/draws", async (req, reply) => {
    const projectId = parseObjectId(req.params.id, reply);
    if (!projectId) return;

    const project = await Project.findById(projectId);
    if (!project) {
      return reply.code(404).send({ error: "project not found" });
    }
    const plan = await FinancePlan.findOne({ projectId }).sort({
      uploadedAt: -1,
    });
    if (!plan) {
      return reply.code(409).send({
        error:
          "project has no finance plan yet — upload the master SOV before requesting a draw",
      });
    }

    let g703Doc: DocumentDoc | null = null;
    let g702Doc: DocumentDoc | null = null;
    let periodStart: Date | undefined;
    let periodEnd: Date | undefined;

    for await (const part of req.parts()) {
      if (part.type === "file") {
        const fieldname = (part.fieldname ?? "").toLowerCase();
        const filename = (part.filename ?? "").toLowerCase();
        const isG702 =
          fieldname === "g702" ||
          (fieldname !== "g703" && filename.includes("g702"));
        const kind: DocumentKind = isG702 ? "DRAW_G702" : "DRAW_G703";
        const { document } = await ingestMultipartFile(part, kind, projectId);
        if (kind === "DRAW_G702") g702Doc = document;
        else g703Doc = document;
      } else if (part.type === "field") {
        if (
          part.fieldname === "periodStart" &&
          typeof part.value === "string"
        ) {
          const d = new Date(part.value);
          if (!Number.isNaN(d.getTime())) periodStart = d;
        } else if (
          part.fieldname === "periodEnd" &&
          typeof part.value === "string"
        ) {
          const d = new Date(part.value);
          if (!Number.isNaN(d.getTime())) periodEnd = d;
        }
      }
    }

    if (!g703Doc) {
      return reply
        .code(400)
        .send({ error: "missing G703 file (send as field name 'g703')" });
    }

    const drawCount = await Draw.countDocuments({ projectId });
    const now = new Date();
    const fallbackStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const g703Id = (g703Doc as unknown as { _id: Types.ObjectId })._id;
    const g702Id = g702Doc
      ? (g702Doc as unknown as { _id: Types.ObjectId })._id
      : undefined;

    const draw = await Draw.create({
      projectId,
      drawNumber: drawCount + 1,
      periodStart: periodStart ?? fallbackStart,
      periodEnd: periodEnd ?? now,
      contractor: { ...DEFAULT_CONTRACTOR },
      g703DocumentId: g703Id,
      g702DocumentId: g702Id,
      status: "parsing",
      lines: [],
    });

    // Fire the extractor in the background. On failure, flip status to "failed"
    // via CAS so a later retry endpoint can still recover the row.
    runG703Extractor({
      projectId,
      drawId: draw._id,
      g703DocumentId: g703Id,
    }).catch((err) => {
      app.log.error(
        { err, drawId: String(draw._id) },
        "G703 extractor failed",
      );
      const message = err instanceof Error ? err.message : String(err);
      Draw.updateOne(
        { _id: draw._id, status: "parsing" },
        { $set: { status: "failed", extractorError: message } },
      ).exec();
    });

    return reply.code(201).send(draw);
  });

  app.get<{ Params: { id: string } }>("/:id/draws", async (req, reply) => {
    const projectId = parseObjectId(req.params.id, reply);
    if (!projectId) return;
    return Draw.find({ projectId }).sort({ drawNumber: -1 });
  });

  app.get<{ Params: { id: string; drawId: string } }>(
    "/:id/draws/:drawId",
    async (req, reply) => {
      const projectId = parseObjectId(req.params.id, reply);
      if (!projectId) return;
      if (!isValidObjectId(req.params.drawId)) {
        return reply.code(400).send({ error: "invalid drawId" });
      }
      const draw = await Draw.findOne({
        _id: req.params.drawId,
        projectId,
      });
      if (!draw) return reply.code(404).send({ error: "draw not found" });
      return draw;
    },
  );

  app.patch<{
    Params: { id: string; drawId: string; lineIndex: string };
  }>(
    "/:id/draws/:drawId/lines/:lineIndex",
    async (req, reply) => {
      const projectId = parseObjectId(req.params.id, reply);
      if (!projectId) return;
      if (!isValidObjectId(req.params.drawId)) {
        return reply.code(400).send({ error: "invalid drawId" });
      }
      const lineIndex = Number(req.params.lineIndex);
      if (!Number.isInteger(lineIndex) || lineIndex < 0) {
        return reply.code(400).send({ error: "invalid lineIndex" });
      }
      const parsed = patchLineSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const { confirmedMilestoneId, approvalStatus } = parsed.data;

      const draw = await Draw.findOne({
        _id: req.params.drawId,
        projectId,
      });
      if (!draw) return reply.code(404).send({ error: "draw not found" });
      if (draw.status === "approved") {
        return reply
          .code(409)
          .send({ error: "draw is already approved; cannot modify lines" });
      }
      if (draw.status !== "ready_for_review") {
        return reply
          .code(409)
          .send({ error: `draw is not reviewable (status=${draw.status})` });
      }
      if (lineIndex >= draw.lines.length) {
        return reply.code(404).send({ error: "line index out of range" });
      }

      const line = draw.lines[lineIndex]!;
      if (confirmedMilestoneId !== undefined) {
        line.confirmedMilestoneId = confirmedMilestoneId;
      } else if (approvalStatus === "confirmed") {
        line.confirmedMilestoneId = line.aiSuggestedMilestoneId ?? undefined;
      }
      line.approvalStatus = approvalStatus;
      await draw.save();
      return line;
    },
  );

  app.post<{ Params: { id: string; drawId: string } }>(
    "/:id/draws/:drawId/approve",
    async (req, reply) => {
      const projectId = parseObjectId(req.params.id, reply);
      if (!projectId) return;
      if (!isValidObjectId(req.params.drawId)) {
        return reply.code(400).send({ error: "invalid drawId" });
      }
      const draw = await Draw.findOne({
        _id: req.params.drawId,
        projectId,
      });
      if (!draw) return reply.code(404).send({ error: "draw not found" });
      if (draw.status !== "ready_for_review") {
        return reply.code(409).send({
          error: `draw is not ready for approval (status=${draw.status})`,
        });
      }
      const pending = draw.lines.filter(
        (l) => l.approvalStatus === "pending",
      );
      if (pending.length > 0) {
        return reply.code(409).send({
          error: `cannot approve: ${pending.length} line(s) still pending contractor review`,
        });
      }
      for (const l of draw.lines) {
        if (l.approvalStatus === "confirmed" && !l.confirmedMilestoneId) {
          l.confirmedMilestoneId = l.aiSuggestedMilestoneId ?? undefined;
        }
      }
      draw.status = "approved";
      draw.approvedAt = new Date();
      await draw.save();
      return draw;
    },
  );
};

export default drawsRoutes;
