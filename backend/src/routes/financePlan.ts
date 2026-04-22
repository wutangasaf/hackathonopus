import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { isValidObjectId, Types } from "mongoose";
import { z } from "zod";
import { DocumentModel } from "../models/document.js";
import {
  FinancePlan,
  LOAN_TYPES,
  MILESTONE_STATUSES,
} from "../models/financePlan.js";
import { DISCIPLINES } from "../models/planClassification.js";
import { parseObjectId } from "./util.js";

const MODEL_VERSION = "finance-plan-form/v1";

const planDocRefSchema = z.object({
  documentId: z.string().refine(isValidObjectId, { message: "invalid documentId" }),
  sheetLabels: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const requiredCompletionSchema = z.object({
  discipline: z.enum(DISCIPLINES),
  elementKindOrId: z.string().min(1),
  minPct: z.number().min(0).max(100),
});

const milestoneInputSchema = z.object({
  sequence: z.number().int().min(1),
  name: z.string().min(1),
  plannedStartDate: z.coerce.date(),
  plannedCompletionDate: z.coerce.date(),
  plannedPercentOfLoan: z.number().min(0).max(100),
  trancheAmount: z.number().min(0),
  plannedReleasePct: z.number().min(0).max(100),
  planDocRefs: z.array(planDocRefSchema).default([]),
  requiredCompletion: z.array(requiredCompletionSchema).default([]),
  requiredDocs: z.array(z.string()).default([]),
  status: z.enum(MILESTONE_STATUSES).default("pending"),
});

const sovLineSchema = z.object({
  lineNumber: z.string().min(1),
  description: z.string().min(1),
  csiCode: z.string().optional(),
  scheduledValue: z.number().min(0),
  disciplineHint: z.enum(DISCIPLINES).optional(),
  zoneHint: z.string().optional(),
});

const financePlanInputSchema = z.object({
  loanType: z.enum(LOAN_TYPES),
  loanAmount: z.number().min(0),
  totalBudget: z.number().min(0),
  currency: z.literal("USD").default("USD"),
  retainagePct: z.number().min(0).max(100).default(10),
  retainageStepDownAt: z.number().min(0).max(100).default(50),
  retainageStepDownTo: z.number().min(0).max(100).default(5),
  coThresholdSingle: z.number().min(0).default(50000),
  coThresholdCumulativePct: z.number().min(0).max(100).default(5),
  materialDelayDays: z.number().int().min(0).default(60),
  cureDaysMonetary: z.number().int().min(0).default(10),
  cureDaysNonMonetary: z.number().int().min(0).default(30),
  kickoffDate: z.coerce.date(),
  requiredCompletionDate: z.coerce.date(),
  sov: z.array(sovLineSchema).default([]),
  milestones: z.array(milestoneInputSchema).min(1),
});

type FinancePlanInput = z.infer<typeof financePlanInputSchema>;

const patchMilestoneSchema = z
  .object({
    actualReleasePct: z.number().min(0).max(100).optional(),
    amountReleased: z.number().min(0).optional(),
    status: z.enum(MILESTONE_STATUSES).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "must supply at least one of actualReleasePct, amountReleased, status",
  });

async function validateCrossFields(
  projectId: string,
  body: FinancePlanInput,
): Promise<string[]> {
  const errors: string[] = [];

  const sovSum = body.sov.reduce((a, s) => a + s.scheduledValue, 0);
  if (body.sov.length > 0 && Math.abs(sovSum - body.totalBudget) > 0.01) {
    errors.push(
      `SOV scheduledValue sum (${sovSum}) does not equal totalBudget (${body.totalBudget})`,
    );
  }

  const sorted = body.milestones
    .slice()
    .sort((a, b) => a.sequence - b.sequence);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    if (cur.plannedPercentOfLoan <= prev.plannedPercentOfLoan) {
      errors.push(
        `milestones.plannedPercentOfLoan must be strictly monotonic (seq ${cur.sequence} <= seq ${prev.sequence})`,
      );
    }
  }
  const last = sorted[sorted.length - 1]!;
  if (last.plannedPercentOfLoan !== 100) {
    errors.push(
      `final milestone plannedPercentOfLoan must equal 100 (got ${last.plannedPercentOfLoan})`,
    );
  }

  const trancheSum = body.milestones.reduce(
    (a, m) => a + m.trancheAmount,
    0,
  );
  if (Math.abs(trancheSum - body.loanAmount) > 1) {
    errors.push(
      `sum(trancheAmount) (${trancheSum}) does not equal loanAmount (${body.loanAmount}) within $1`,
    );
  }

  for (const m of body.milestones) {
    if (m.plannedStartDate > m.plannedCompletionDate) {
      errors.push(
        `milestone seq ${m.sequence}: plannedStartDate must be <= plannedCompletionDate`,
      );
    }
  }

  const referencedIds = new Set<string>();
  for (const m of body.milestones) {
    for (const ref of m.planDocRefs) referencedIds.add(ref.documentId);
  }
  if (referencedIds.size > 0) {
    const docs = await DocumentModel.find({
      _id: { $in: Array.from(referencedIds).map((id) => new Types.ObjectId(id)) },
      projectId,
      kind: "PLAN",
    }).select("_id");
    const found = new Set(docs.map((d) => String(d._id)));
    for (const id of referencedIds) {
      if (!found.has(id)) {
        errors.push(
          `planDocRefs references documentId ${id} which does not exist as PLAN on this project`,
        );
      }
    }
  }

  return errors;
}

async function handleUpsert(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
  mode: "create" | "replace",
) {
  const projectId = parseObjectId(req.params.id, reply);
  if (!projectId) return;

  const parsed = financePlanInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.flatten() });
  }
  const body = parsed.data;

  const crossErrors = await validateCrossFields(projectId, body);
  if (crossErrors.length > 0) {
    return reply.code(400).send({ error: crossErrors });
  }

  await FinancePlan.deleteMany({ projectId });
  const plan = await FinancePlan.create({
    projectId,
    ...body,
    milestones: body.milestones.map((m) => ({
      ...m,
      actualReleasePct: null,
      actualReleasedAt: null,
      amountReleased: 0,
    })),
    modelVersion: MODEL_VERSION,
    uploadedAt: new Date(),
  });
  return reply.code(mode === "create" ? 201 : 200).send(plan);
}

const financePlanRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { id: string } }>(
    "/:id/finance-plan",
    async (req, reply) => handleUpsert(req, reply, "create"),
  );

  app.put<{ Params: { id: string } }>(
    "/:id/finance-plan",
    async (req, reply) => handleUpsert(req, reply, "replace"),
  );

  app.patch<{ Params: { id: string; milestoneId: string } }>(
    "/:id/finance-plan/milestones/:milestoneId",
    async (req, reply) => {
      const projectId = parseObjectId(req.params.id, reply);
      if (!projectId) return;
      if (!isValidObjectId(req.params.milestoneId)) {
        return reply.code(400).send({ error: "invalid milestoneId" });
      }

      const parsed = patchMilestoneSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const patch = parsed.data;

      const plan = await FinancePlan.findOne({ projectId }).sort({
        uploadedAt: -1,
      });
      if (!plan) {
        return reply.code(404).send({ error: "no finance plan on project" });
      }
      const ms = plan.milestones.find(
        (m) => String(m._id) === req.params.milestoneId,
      );
      if (!ms) {
        return reply.code(404).send({ error: "milestone not found on plan" });
      }

      const firstActualWrite =
        patch.actualReleasePct !== undefined && ms.actualReleasePct === null;

      if (patch.actualReleasePct !== undefined) {
        ms.actualReleasePct = patch.actualReleasePct;
      }
      if (patch.amountReleased !== undefined) {
        ms.amountReleased = patch.amountReleased;
      }
      if (patch.status !== undefined) {
        ms.status = patch.status;
      }
      if (firstActualWrite) {
        ms.actualReleasedAt = new Date();
      }

      await plan.save();
      return ms;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/:id/finance-plan",
    async (req, reply) => {
      const projectId = parseObjectId(req.params.id, reply);
      if (!projectId) return;
      const plan = await FinancePlan.findOne({ projectId }).sort({
        uploadedAt: -1,
      });
      if (!plan) {
        return reply.code(404).send({ error: "no finance plan parsed yet" });
      }
      return plan;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/:id/finance-plan/current-milestone",
    async (req, reply) => {
      const projectId = parseObjectId(req.params.id, reply);
      if (!projectId) return;
      const plan = await FinancePlan.findOne({ projectId }).sort({
        uploadedAt: -1,
      });
      if (!plan) {
        return reply.code(404).send({ error: "no finance plan parsed yet" });
      }
      const current = plan.milestones
        .slice()
        .sort((a, b) => a.sequence - b.sequence)
        .find((m) => m.status !== "verified" && m.status !== "rejected");
      if (!current) {
        return reply.code(404).send({
          error: "no non-terminal milestone — loan appears complete",
        });
      }
      return current;
    },
  );
};

export default financePlanRoutes;
