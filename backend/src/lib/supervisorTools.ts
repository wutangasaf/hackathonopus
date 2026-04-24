import { Types } from "mongoose";
import { AgentRun } from "../models/agentRun.js";
import { DocumentModel } from "../models/document.js";
import { Draw } from "../models/draw.js";
import { GapReport } from "../models/gapReport.js";
import { Observation } from "../models/observation.js";
import { PhotoAssessment } from "../models/photoAssessment.js";
import { PlanFormat } from "../models/planFormat.js";
import {
  ReinspectionRequest,
  REINSPECTION_STATUSES,
} from "../models/reinspectionRequest.js";
import {
  SupervisorFinding,
  SUPERVISOR_FINDING_SEVERITIES,
  SUPERVISOR_RECOMMENDATIONS,
} from "../models/supervisorFinding.js";
import { DISCIPLINES } from "../models/planClassification.js";

export type SupervisorToolName =
  | "read_draw_state"
  | "read_photo_evidence"
  | "read_plan_scope"
  | "record_finding"
  | "generate_reinspection_request";

export type SupervisorToolDef = {
  name: SupervisorToolName;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export function buildSupervisorCustomToolDefs(): SupervisorToolDef[] {
  return [
    {
      name: "read_draw_state",
      description:
        "Fetch everything the pipeline already knows about a single draw: the draw header (period, contractor, status, totalAmountRequested), the parsed G703 lines (description, scheduledValue, pctThisPeriod, pctCumulative, amountThisPeriod, ai-suggested milestone/discipline/confidence, approvalStatus), the latest gap report (perElement statuses, sovLineFindings with claimed/observed variance and flag, overallStatus, drawVerdict, unapprovedDeviations, narrative), and the last 10 agent runs for this project (so you know which parts of the pipeline have actually run). Call this first for any draw investigation.",
      input_schema: {
        type: "object",
        properties: {
          drawId: {
            type: "string",
            description:
              "The Mongo ObjectId of the draw to inspect. Passed to you as the investigation's input.",
          },
        },
        required: ["drawId"],
      },
    },
    {
      name: "read_photo_evidence",
      description:
        "Fetch the photo evidence linked to a draw's project: photo documents uploaded around this draw period, their photoQuality assessments (GOOD vs NEEDS_RETAKE, issues, retakeInstructions, phaseFit), and all Observation records (matched plan elements with observedState and confidence, unexpectedObservations, safetyFlags). Use this to check whether the visual evidence supports the draw's quantity claims.",
      input_schema: {
        type: "object",
        properties: {
          drawId: {
            type: "string",
            description: "The Mongo ObjectId of the draw whose photos you want to inspect.",
          },
        },
        required: ["drawId"],
      },
    },
    {
      name: "read_plan_scope",
      description:
        "Fetch the approved plan scope for a project — the extracted plan elements (kind, identifier, location, drawingRef, spec key-values) per discipline, plus the inspectorChecklist and scaleNotes. Use this to ground claims against the design intent — e.g., to check that a claimed sequence (concrete before framing) matches the plan, or that claimed quantities align with plan-specified counts.",
      input_schema: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "The Mongo ObjectId of the project.",
          },
          discipline: {
            type: "string",
            enum: [...DISCIPLINES],
            description:
              "Optional — restrict to one discipline (ARCHITECTURE, STRUCTURAL, ELECTRICAL, PLUMBING). Omit to get all disciplines.",
          },
        },
        required: ["projectId"],
      },
    },
    {
      name: "generate_reinspection_request",
      description:
        "Produce a targeted re-inspection packet for the site inspector. Writes a new ReinspectionRequest document (does NOT modify any existing pipeline data). Use this when the current photo evidence is insufficient or contradicts the claim and a fresh site visit is needed. Provide a specific shot list — each shot with a clear description, discipline, reference element id if applicable, angle/lighting/safety notes — so the inspector knows exactly what to capture. Keep the narrative brief (2–4 sentences) explaining why this re-inspection is needed. Call this before record_finding when recommending HOLD.",
      input_schema: {
        type: "object",
        properties: {
          drawId: { type: "string" },
          narrative: {
            type: "string",
            description: "2–4 sentences explaining what's in question and why a re-shoot is needed.",
          },
          targetLineItems: {
            type: "array",
            items: { type: "string" },
            description: "G703 line numbers this re-inspection targets (e.g. ['03 30 00', '06 10 00']).",
          },
          shots: {
            type: "array",
            description: "Ordered shot list — aim for 3–6 shots that directly resolve the ambiguity.",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                discipline: { type: "string", enum: [...DISCIPLINES] },
                referenceElementId: { type: "string" },
                angle: { type: "string", description: "e.g. 'top-down', 'eye-level wide', 'corner detail'" },
                lighting: { type: "string", description: "e.g. 'natural morning', 'use flash'" },
                safety: { type: "string", description: "any PPE or access constraints the inspector should know" },
              },
              required: ["description"],
            },
          },
          dueByISO: {
            type: "string",
            description: "ISO-8601 timestamp for when the re-inspection should be completed by. Typically 24–72h from now.",
          },
        },
        required: ["drawId", "narrative", "shots"],
      },
    },
    {
      name: "record_finding",
      description:
        "Record your final conclusion for this investigation. Call this EXACTLY ONCE per session, after you've gathered enough evidence. Includes severity, category, narrative, evidence references, and recommendation. After you call this, go idle.",
      input_schema: {
        type: "object",
        properties: {
          drawId: { type: "string" },
          severity: {
            type: "string",
            enum: [...SUPERVISOR_FINDING_SEVERITIES],
            description: "low = informational, medium = notable gap, high = material anomaly, critical = fraud/safety.",
          },
          category: {
            type: "string",
            description:
              "Short tag, e.g. 'quantity_mismatch', 'out_of_sequence', 'missing_evidence', 'safety_flag', 'unapproved_scope', 'on_track'.",
          },
          narrative: {
            type: "string",
            description: "3–8 sentence plain-English summary grounded in the tool outputs you just saw.",
          },
          evidence: {
            type: "array",
            description: "Structured references to the evidence items (photos, gap report lines, plan elements) that support your narrative.",
            items: {
              type: "object",
              properties: {
                kind: {
                  type: "string",
                  description: "e.g. 'photo', 'gap_sov_line', 'plan_element', 'agent_run', 'draw_line'.",
                },
                reference: {
                  type: "string",
                  description: "An id or natural-key string identifying the item.",
                },
                note: { type: "string" },
              },
              required: ["kind", "reference"],
            },
          },
          recommendation: {
            type: "string",
            enum: [...SUPERVISOR_RECOMMENDATIONS],
          },
        },
        required: ["drawId", "severity", "category", "narrative", "recommendation"],
      },
    },
  ];
}

export type SupervisorToolContext = {
  projectId: Types.ObjectId;
  drawId: Types.ObjectId;
  sessionId: Types.ObjectId;
};

function truncateArr<T>(arr: T[], n: number): T[] {
  return arr.length > n ? arr.slice(0, n) : arr;
}

export async function dispatchSupervisorTool(
  name: string,
  input: Record<string, unknown>,
  ctx: SupervisorToolContext,
): Promise<{ isError: boolean; content: string }> {
  try {
    switch (name) {
      case "read_draw_state":
        return { isError: false, content: JSON.stringify(await readDrawState(ctx, input)) };
      case "read_photo_evidence":
        return { isError: false, content: JSON.stringify(await readPhotoEvidence(ctx, input)) };
      case "read_plan_scope":
        return { isError: false, content: JSON.stringify(await readPlanScope(ctx, input)) };
      case "generate_reinspection_request":
        return {
          isError: false,
          content: JSON.stringify(await generateReinspectionRequest(ctx, input)),
        };
      case "record_finding":
        return { isError: false, content: JSON.stringify(await recordFinding(ctx, input)) };
      default:
        return {
          isError: true,
          content: JSON.stringify({ error: `unknown tool: ${name}` }),
        };
    }
  } catch (err) {
    return {
      isError: true,
      content: JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
    };
  }
}

async function readDrawState(
  ctx: SupervisorToolContext,
  _input: Record<string, unknown>,
) {
  const draw = await Draw.findOne({
    _id: ctx.drawId,
    projectId: ctx.projectId,
  }).lean();
  if (!draw) {
    return { error: "draw not found" };
  }
  const gapReport = await GapReport.findOne({ projectId: ctx.projectId })
    .sort({ generatedAt: -1 })
    .lean();
  const agentRuns = await AgentRun.find({ projectId: ctx.projectId })
    .sort({ startedAt: -1 })
    .limit(10)
    .lean();

  return {
    draw: {
      id: String(draw._id),
      drawNumber: draw.drawNumber,
      periodStart: draw.periodStart,
      periodEnd: draw.periodEnd,
      contractor: draw.contractor,
      status: draw.status,
      totalAmountRequested: draw.totalAmountRequested ?? null,
      extractorError: draw.extractorError ?? null,
      lines: (draw.lines ?? []).map((l) => ({
        lineNumber: l.lineNumber,
        description: l.description,
        csiCode: l.csiCode ?? null,
        scheduledValue: l.scheduledValue,
        pctThisPeriod: l.pctThisPeriod,
        pctCumulative: l.pctCumulative,
        amountThisPeriod: l.amountThisPeriod,
        aiSuggestedMilestoneId: l.aiSuggestedMilestoneId ?? null,
        aiSuggestedDiscipline: l.aiSuggestedDiscipline ?? null,
        aiConfidence: l.aiConfidence ?? null,
        aiReasoning: l.aiReasoning ?? null,
        confirmedMilestoneId: l.confirmedMilestoneId ?? null,
        approvalStatus: l.approvalStatus,
      })),
    },
    gapReport: gapReport
      ? {
          id: String(gapReport._id),
          generatedAt: gapReport.generatedAt,
          overallStatus: gapReport.overallStatus,
          daysOffset: gapReport.daysOffset ?? null,
          loanInBalance: gapReport.loanInBalance,
          remainingBudget: gapReport.remainingBudget ?? null,
          remainingCost: gapReport.remainingCost ?? null,
          unapprovedDeviations: gapReport.unapprovedDeviations ?? [],
          narrative: gapReport.narrative,
          drawVerdict: gapReport.drawVerdict ?? null,
          perElement: truncateArr(gapReport.perElement ?? [], 40),
          sovLineFindings: truncateArr(gapReport.sovLineFindings ?? [], 40),
        }
      : null,
    recentAgentRuns: agentRuns.map((r) => ({
      id: String(r._id),
      agentName: r.agentName,
      status: r.status,
      startedAt: r.startedAt,
      completedAt: r.completedAt ?? null,
      error: r.error ?? null,
    })),
  };
}

async function readPhotoEvidence(
  ctx: SupervisorToolContext,
  _input: Record<string, unknown>,
) {
  const draw = await Draw.findOne({
    _id: ctx.drawId,
    projectId: ctx.projectId,
  }).lean();
  if (!draw) return { error: "draw not found" };

  const photos = await DocumentModel.find({
    projectId: ctx.projectId,
    kind: "PHOTO",
  })
    .sort({ serverReceivedAt: -1 })
    .limit(40)
    .lean();

  const photoIds = photos.map((p) => p._id);
  const [assessments, observations] = await Promise.all([
    PhotoAssessment.find({ photoDocumentId: { $in: photoIds } }).lean(),
    Observation.find({ photoDocumentId: { $in: photoIds } }).lean(),
  ]);

  const assessmentByPhoto = new Map(
    assessments.map((a) => [String(a.photoDocumentId), a]),
  );
  const obsByPhoto = new Map<string, typeof observations>();
  for (const o of observations) {
    const key = String(o.photoDocumentId);
    const list = obsByPhoto.get(key) ?? [];
    list.push(o);
    obsByPhoto.set(key, list);
  }

  return {
    photoCount: photos.length,
    photos: photos.map((p) => {
      const a = assessmentByPhoto.get(String(p._id));
      const obs = obsByPhoto.get(String(p._id)) ?? [];
      return {
        photoId: String(p._id),
        filename: p.originalFilename,
        uploadedAt: p.serverReceivedAt,
        exif: p.exifMeta ?? null,
        assessment: a
          ? {
              quality: a.quality,
              discipline: a.discipline ?? null,
              issues: a.issues ?? [],
              retakeInstructions: a.retakeInstructions ?? null,
              phaseFit: a.phaseFit ?? null,
              matchedShotId: a.matchedShotId ?? null,
            }
          : null,
        observations: obs.map((o) => ({
          discipline: o.discipline,
          matchedElements: o.matchedElements ?? [],
          unexpectedObservations: o.unexpectedObservations ?? [],
          safetyFlags: o.safetyFlags ?? [],
        })),
      };
    }),
  };
}

async function readPlanScope(
  ctx: SupervisorToolContext,
  input: Record<string, unknown>,
) {
  const discipline =
    typeof input.discipline === "string" ? input.discipline : undefined;
  const query: Record<string, unknown> = { projectId: ctx.projectId };
  if (discipline) query.discipline = discipline;

  const plans = await PlanFormat.find(query).sort({ version: -1 }).lean();
  const byDiscipline = new Map<string, (typeof plans)[number]>();
  for (const p of plans) {
    if (!byDiscipline.has(p.discipline)) byDiscipline.set(p.discipline, p);
  }

  return {
    disciplines: Array.from(byDiscipline.entries()).map(([d, p]) => ({
      discipline: d,
      version: p.version,
      elementCount: (p.elements ?? []).length,
      elements: truncateArr(p.elements ?? [], 80).map((el) => ({
        elementId: el.elementId,
        kind: el.kind,
        identifier: el.identifier,
        location: el.location ?? null,
        drawingRef: el.drawingRef ?? null,
        spec: el.spec ? Object.fromEntries(el.spec as Map<string, string>) : {},
      })),
      inspectorChecklist: p.inspectorChecklist ?? [],
      scaleNotes: p.scaleNotes ?? null,
      sourceSheets: p.sourceSheets ?? [],
    })),
  };
}

async function generateReinspectionRequest(
  ctx: SupervisorToolContext,
  input: Record<string, unknown>,
) {
  const narrative = String(input.narrative ?? "").trim();
  if (!narrative) return { error: "narrative is required" };

  const rawShots = Array.isArray(input.shots) ? input.shots : [];
  const shots = rawShots
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      description: String(s.description ?? "").trim(),
      discipline:
        typeof s.discipline === "string" ? s.discipline : undefined,
      referenceElementId:
        typeof s.referenceElementId === "string"
          ? s.referenceElementId
          : undefined,
      angle: typeof s.angle === "string" ? s.angle : undefined,
      lighting: typeof s.lighting === "string" ? s.lighting : undefined,
      safety: typeof s.safety === "string" ? s.safety : undefined,
    }))
    .filter((s) => s.description.length > 0);

  if (shots.length === 0) {
    return { error: "at least one shot with a description is required" };
  }

  const targetLineItems = Array.isArray(input.targetLineItems)
    ? input.targetLineItems.filter((v): v is string => typeof v === "string")
    : [];

  let dueBy: Date | undefined;
  if (typeof input.dueByISO === "string") {
    const d = new Date(input.dueByISO);
    if (!Number.isNaN(d.getTime())) dueBy = d;
  }

  const created = await ReinspectionRequest.create({
    sessionId: ctx.sessionId,
    projectId: ctx.projectId,
    drawId: ctx.drawId,
    narrative,
    shots,
    targetLineItems,
    dueBy,
    status: REINSPECTION_STATUSES[0],
  });

  return {
    reinspectionRequestId: String(created._id),
    shotCount: shots.length,
    dueBy: dueBy ?? null,
  };
}

async function recordFinding(
  ctx: SupervisorToolContext,
  input: Record<string, unknown>,
) {
  const severity = String(input.severity ?? "");
  const category = String(input.category ?? "").trim();
  const narrative = String(input.narrative ?? "").trim();
  const recommendation = String(input.recommendation ?? "");

  if (
    !SUPERVISOR_FINDING_SEVERITIES.includes(
      severity as (typeof SUPERVISOR_FINDING_SEVERITIES)[number],
    )
  ) {
    return { error: `invalid severity '${severity}'` };
  }
  if (
    !SUPERVISOR_RECOMMENDATIONS.includes(
      recommendation as (typeof SUPERVISOR_RECOMMENDATIONS)[number],
    )
  ) {
    return { error: `invalid recommendation '${recommendation}'` };
  }
  if (!category || !narrative) {
    return { error: "category and narrative are required" };
  }

  const rawEvidence = Array.isArray(input.evidence) ? input.evidence : [];
  const evidence = rawEvidence
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({
      kind: String(e.kind ?? ""),
      reference: String(e.reference ?? ""),
      note: typeof e.note === "string" ? e.note : undefined,
    }))
    .filter((e) => e.kind && e.reference);

  const created = await SupervisorFinding.create({
    sessionId: ctx.sessionId,
    projectId: ctx.projectId,
    drawId: ctx.drawId,
    severity,
    category,
    narrative,
    evidence,
    recommendation,
  });

  return { findingId: String(created._id) };
}
