import { z } from "zod";
import type { Types } from "mongoose";
import {
  PlanFormat,
  type PlanFormatDoc,
} from "../models/planFormat.js";
import {
  DISCIPLINES,
  type Discipline,
} from "../models/planClassification.js";
import { FinancePlan, type FinancePlanDoc } from "../models/financePlan.js";
import { Draw } from "../models/draw.js";
import {
  Observation,
  type ObservationDoc,
} from "../models/observation.js";
import {
  GapReport,
  PER_ELEMENT_STATUSES,
  SOV_FLAGS,
  OVERALL_STATUSES,
  DRAW_VERDICTS,
} from "../models/gapReport.js";
import { claudeCall, type ClaudeMessage } from "../lib/claudeCall.js";
import { withAgentRun } from "./shared.js";
import { config } from "../config.js";

const AGENT_NAME = "ComparisonAndGap";
const MODEL_VERSION = "comparison-and-gap/v1";

const perElementSchema = z.object({
  discipline: z.enum(DISCIPLINES),
  elementId: z.string().min(1),
  plannedState: z.string().min(1),
  observedState: z.string().min(1),
  status: z.enum(PER_ELEMENT_STATUSES),
});

const sovLineFindingSchema = z.object({
  sovLineNumber: z.string().min(1),
  claimedPct: z.number().min(0).max(100),
  observedPct: z.number().min(0).max(100),
  variance: z.number(),
  flag: z.enum(SOV_FLAGS),
});

const drawVerdictSchema = z.object({
  verdict: z.enum(DRAW_VERDICTS),
  reasoning: z.string().min(1),
  conditions: z.array(z.string()).optional(),
  missingRequirements: z.array(z.string()).optional(),
});

const toolOutputSchema = z.object({
  perElement: z.array(perElementSchema),
  sovLineFindings: z.array(sovLineFindingSchema),
  overallStatus: z.enum(OVERALL_STATUSES),
  daysOffset: z.number().optional(),
  loanInBalance: z.boolean(),
  remainingBudget: z.number().optional(),
  remainingCost: z.number().optional(),
  unapprovedDeviations: z.array(z.string()).optional(),
  narrative: z.string().min(1),
  drawVerdict: drawVerdictSchema,
});

type ToolOutput = z.infer<typeof toolOutputSchema>;

const SYSTEM_PROMPT = `You are a senior construction risk management consultant (CRMC) advising a community bank on whether to release the next construction-loan draw. You've been doing this for 50 years and you speak with the blunt authority that comes with it.

You receive a structured packet:
- The draw milestone the borrower is claiming (with plannedPercentOfLoan and requiredCompletion targets).
- The approved plan elements grouped by discipline (what should exist on site).
- Aggregated observations from site photos per element (what was actually visible, with confidence).
- Unapproved observations across all photos (things on site that aren't on the plans).
- The SOV (Schedule of Values — G703 line items with scheduledValue).
- Finance rules — retainage %, change-order thresholds, cure-day windows.

Your job is to produce a GapReport that the bank can act on. Call the emit_gap_report tool exactly once with:

- perElement: one entry per plan element that appears in requiredCompletion OR has a non-trivial observation. status values:
  - VERIFIED = element is installed per spec per the photos (high confidence).
  - PARTIAL = installed but incomplete at current phase (rough-in only, etc.).
  - MISSING = should be present for this milestone but no photo shows it.
  - DEVIATED = present but does not match spec (wrong material, wrong location, wrong dimension).
  - UNVERIFIED = not enough photo evidence to say either way.
  Use plannedState and observedState as short human-readable summaries (e.g. plannedState="corner shower, chrome, 65×76cm", observedState="present, finished, chrome fittings visible").

- sovLineFindings: one entry per SOV line that is in scope for this milestone. claimedPct = the borrower's implicit claim (proportional to plannedPercentOfLoan applied to that line), observedPct = your best estimate from the photos/observations, variance = observedPct - claimedPct. flag:
  - ok = variance within ±5%.
  - minor = variance 5–15%, doesn't block the draw.
  - material = variance > 15% in either direction, blocks the draw.
  - unapproved_scope = work is visible that isn't on the approved SOV at all (change order needed).

- overallStatus:
  - ON_TRACK = draw should release.
  - BEHIND = work is less complete than claimed; some holds.
  - DEVIATION_FOUND = at least one DEVIATED element or unapproved_scope SOV line.
  - TECHNICAL_DEFAULT_RISK = multiple material variances, missing cure-period documentation, or the loan is out of balance.

- daysOffset = integer; negative if ahead of plannedCompletionDate, positive if behind. Estimate from photo evidence vs plannedCompletionDate. Omit if unclear.

- loanInBalance: true if remaining budget ≥ remaining cost-to-complete, false otherwise. Use the SOV as your cost base.

- remainingBudget / remainingCost: optional numeric estimates in USD, informational.

- unapprovedDeviations: consolidated, deduplicated short strings. These are the headline "change order needed" items the bank officer will read first.

- narrative: 3–5 tight sentences in the CRMC voice, summarizing what's good, what's concerning, and what the bank should do. No bullet points. No "In conclusion". Speak like you're calling the loan officer.

- drawVerdict: APPROVE, APPROVE_WITH_CONDITIONS, HOLD, or REJECT. Reasoning is 1–3 sentences. conditions[] lists what must be true for the draw to release (retainage adjustments, lien waivers, signed COs). missingRequirements[] lists what the bank still needs to see before considering the draw at all (e.g. inspector sign-off, insurance COI).

Decision rules:
- APPROVE = overallStatus ON_TRACK, no MISSING elements blocking the milestone, no material variances.
- APPROVE_WITH_CONDITIONS = ON_TRACK or minor variance, but conditions (lien waivers, minor rework, doc updates) must be met at or before funding. This is the normal case.
- HOLD = real problems (BEHIND, missing docs, uncured monetary default) — pause the draw until resolved.
- REJECT = DEVIATION_FOUND with unapproved scope that needs re-underwriting, or TECHNICAL_DEFAULT_RISK. Requires borrower + bank to renegotiate.

When you quote release dollars in the narrative or reasoning, always use the net-of-retainage figure (trancheAmount × plannedReleasePct / 100), not the gross trancheAmount. Never tell an officer to release the gross when retainage is being held; it is a common error and it undermines trust.

Be specific. Cite elementIds and SOV lineNumbers in your reasoning. Do not hedge.

If any required element has confidence < 0.5 OR observedState=ABSENT with no offsetting evidence, include its elementId in drawVerdict.missingRequirements so the Supervisor agent knows to draft a targeted re-inspection — don't silently mark it UNVERIFIED and move on.

## Few-shot example — the normal case (APPROVE_WITH_CONDITIONS)

Context: milestone 3 (plumbing + electrical rough-in), plannedPercentOfLoan=35, retainagePct=10, trancheAmount=$420,000. All plumbing elements verified, one electrical panel label partially legible (PARTIAL), one minor variance on line 26-200 (claimed 80%, observed 72%), one sheet-rock chip near plumbing wall (cosmetic, not material).

Call shape (abridged):
{
  "perElement": [
    { "discipline": "PLUMBING", "elementId": "lav-01-roughin", "plannedState": "DWV + supply, stubbed, tested", "observedState": "DWV + supply present, capped, pressure-test tag visible", "status": "VERIFIED" },
    { "discipline": "ELECTRICAL", "elementId": "panel-p2", "plannedState": "Panel P-2 installed, circuit directory populated", "observedState": "panel set and energized, directory label partially legible — bottom 4 circuits obscured", "status": "PARTIAL" }
  ],
  "sovLineFindings": [
    { "sovLineNumber": "22-420", "claimedPct": 100, "observedPct": 100, "variance": 0, "flag": "ok" },
    { "sovLineNumber": "26-200", "claimedPct": 80, "observedPct": 72, "variance": -8, "flag": "minor" }
  ],
  "overallStatus": "ON_TRACK",
  "loanInBalance": true,
  "narrative": "Plumbing rough-in at milestone 3 is verified across all claimed lines (22-420 series) with pressure-test tags in frame. Electrical panel P-2 is energized but the circuit directory is only partially legible in the submitted photos — not grounds to hold the draw, but it needs a clean re-shoot before the next draw closes. The minor 8% shortfall on 26-200 is within normal rough-in variance. Release net-of-retainage at $378,000; withhold the remaining $42,000 per the 10% retainage schedule.",
  "drawVerdict": {
    "verdict": "APPROVE_WITH_CONDITIONS",
    "reasoning": "Rough-in evidence is sufficient to release tranche 3 net-of-retainage. Conditions address the panel-label shot and the standard lien-waiver package before wire.",
    "conditions": [
      "Receive a legible close-up photo of Panel P-2 circuit directory (all 24 circuits) within 5 business days",
      "Collect conditional lien waivers from plumbing and electrical subs for amounts invoiced this period",
      "Hold retainage per standard 10% schedule — net release $378,000"
    ],
    "missingRequirements": []
  }
}`;

type AggregatedObservation = {
  elementId: string;
  observedState: string;
  observedPct?: number;
  bestConfidence: number;
  evidence: string;
  photoCount: number;
  photoIds: Types.ObjectId[];
};

function aggregateObservationsPerElement(
  observations: ObservationDoc[],
): Map<string, AggregatedObservation> {
  const map = new Map<string, AggregatedObservation>();
  for (const obs of observations) {
    for (const m of obs.matchedElements) {
      const prior = map.get(m.elementId);
      if (!prior || m.confidence > prior.bestConfidence) {
        map.set(m.elementId, {
          elementId: m.elementId,
          observedState: m.observedState,
          observedPct: m.observedPct ?? undefined,
          bestConfidence: m.confidence,
          evidence: m.evidence,
          photoCount: (prior?.photoCount ?? 0) + 1,
          photoIds: [...(prior?.photoIds ?? []), obs.photoDocumentId],
        });
      } else {
        prior.photoCount += 1;
        prior.photoIds.push(obs.photoDocumentId);
      }
    }
  }
  return map;
}

function buildContextPacket(args: {
  milestone: FinancePlanDoc["milestones"][number];
  plan: FinancePlanDoc;
  planFormats: Map<Discipline, PlanFormatDoc>;
  aggregated: Map<string, AggregatedObservation>;
  unapproved: string[];
}): string {
  const lines: string[] = [];
  const m = args.milestone;
  lines.push(`## Active milestone`);
  const netRelease = (m.trancheAmount * m.plannedReleasePct) / 100;
  lines.push(
    `sequence=${m.sequence} name="${m.name}" plannedPercentOfLoan=${m.plannedPercentOfLoan}% plannedStartDate=${m.plannedStartDate.toISOString().slice(0, 10)} plannedCompletionDate=${m.plannedCompletionDate.toISOString().slice(0, 10)} status=${m.status}`,
  );
  lines.push(
    `trancheAmount=$${m.trancheAmount} plannedReleasePct=${m.plannedReleasePct}% => net release if approved=$${netRelease.toFixed(0)} (retainage held=$${(m.trancheAmount - netRelease).toFixed(0)})`,
  );
  if (m.actualReleasePct !== null && m.actualReleasePct !== undefined) {
    lines.push(
      `actualReleasePct=${m.actualReleasePct}% amountReleased=$${m.amountReleased} actualReleasedAt=${m.actualReleasedAt ? m.actualReleasedAt.toISOString().slice(0, 10) : "n/a"}`,
    );
  }
  if (m.planDocRefs && m.planDocRefs.length > 0) {
    lines.push(
      `planDocRefs: ${m.planDocRefs.length} doc(s) cited — ${m.planDocRefs
        .map((r) => {
          const sheets = r.sheetLabels && r.sheetLabels.length > 0 ? ` sheets=[${r.sheetLabels.join(",")}]` : "";
          const note = r.notes ? ` note="${r.notes}"` : "";
          return `docId=${String(r.documentId)}${sheets}${note}`;
        })
        .join("; ")}`,
    );
  }
  lines.push(`## Required completion at this milestone`);
  for (const rc of m.requiredCompletion) {
    lines.push(
      `- discipline=${rc.discipline} elementKindOrId="${rc.elementKindOrId}" minPct=${rc.minPct}`,
    );
  }
  if (m.requiredDocs.length > 0) {
    lines.push(`## Required docs at this milestone`);
    for (const d of m.requiredDocs) lines.push(`- ${d}`);
  }

  const priorReleased = args.plan.milestones
    .filter(
      (x) => x.sequence < m.sequence && x.amountReleased && x.amountReleased > 0,
    )
    .reduce((a, x) => a + (x.amountReleased ?? 0), 0);
  lines.push(`## Finance rules (apply when judging drawVerdict)`);
  lines.push(
    `loanAmount=$${args.plan.loanAmount} totalBudget=$${args.plan.totalBudget} priorAmountReleased=$${priorReleased}`,
  );
  lines.push(
    `kickoffDate=${args.plan.kickoffDate ? args.plan.kickoffDate.toISOString().slice(0, 10) : "n/a"} requiredCompletionDate=${args.plan.requiredCompletionDate.toISOString().slice(0, 10)}`,
  );
  lines.push(
    `retainagePct=${args.plan.retainagePct} retainageStepDownAt=${args.plan.retainageStepDownAt}% retainageStepDownTo=${args.plan.retainageStepDownTo}%`,
  );
  lines.push(
    `coThresholdSingle=$${args.plan.coThresholdSingle} coThresholdCumulativePct=${args.plan.coThresholdCumulativePct}%`,
  );
  lines.push(
    `materialDelayDays=${args.plan.materialDelayDays} cureDaysMonetary=${args.plan.cureDaysMonetary} cureDaysNonMonetary=${args.plan.cureDaysNonMonetary}`,
  );

  lines.push(`## Approved plan elements by discipline`);
  for (const [d, pf] of args.planFormats) {
    lines.push(`### ${d} — ${pf.elements.length} elements`);
    for (const e of pf.elements) {
      const loc = e.location ? ` — at ${e.location}` : "";
      const spec =
        e.spec && e.spec.size > 0
          ? ` spec={${Array.from(e.spec.entries())
              .map(([k, v]) => `${k}=${v}`)
              .join(", ")}}`
          : "";
      lines.push(
        `- elementId="${e.elementId}" kind=${e.kind} identifier="${e.identifier}"${loc}${spec}`,
      );
    }
  }

  lines.push(`## Aggregated observations (best-confidence per element)`);
  if (args.aggregated.size === 0) {
    lines.push(`(none — no photos analyzed)`);
  } else {
    for (const a of args.aggregated.values()) {
      const pct = a.observedPct !== undefined ? ` observedPct=${a.observedPct}` : "";
      lines.push(
        `- elementId="${a.elementId}" observedState=${a.observedState}${pct} confidence=${a.bestConfidence.toFixed(2)} photos=${a.photoCount} evidence="${a.evidence}"`,
      );
    }
  }

  if (args.unapproved.length > 0) {
    lines.push(`## Unapproved observations (not on plans — possible change orders)`);
    for (const u of args.unapproved) lines.push(`- ${u}`);
  }

  lines.push(`## SOV (Schedule of Values)`);
  for (const s of args.plan.sov) {
    const csi = s.csiCode ? ` csi=${s.csiCode}` : "";
    const disc = s.disciplineHint ? ` discipline=${s.disciplineHint}` : "";
    lines.push(
      `- lineNumber=${s.lineNumber} description="${s.description}" scheduledValue=$${s.scheduledValue}${csi}${disc}`,
    );
  }

  return lines.join("\n");
}

export async function runComparisonAndGap(
  projectId: Types.ObjectId | string,
  opts: {
    milestoneId?: Types.ObjectId | string;
    drawId?: Types.ObjectId | string;
  } = {},
) {
  return withAgentRun(
    {
      projectId,
      agentName: AGENT_NAME,
      input: {
        ...(opts.milestoneId ? { milestoneId: String(opts.milestoneId) } : {}),
        ...(opts.drawId ? { drawId: String(opts.drawId) } : {}),
      },
      modelVersion: MODEL_VERSION,
    },
    async (ctx) => {
      const plan = (await FinancePlan.findOne({ projectId }).sort({
        uploadedAt: -1,
      })) as FinancePlanDoc | null;
      if (!plan) throw new Error("no FinancePlan for project");

      let derivedMilestoneId: string | undefined;
      if (opts.drawId && !opts.milestoneId) {
        const draw = await Draw.findOne({ _id: opts.drawId, projectId });
        if (!draw) {
          throw new Error(`draw ${opts.drawId} not on project`);
        }
        // Pick the most-claimed milestone across the draw's confirmed lines
        // (Σ amountThisPeriod), tie-broken by lowest milestone sequence.
        const claimByMilestone = new Map<string, number>();
        for (const line of draw.lines) {
          if (line.approvalStatus === "pending") continue;
          const mid = line.confirmedMilestoneId ?? line.aiSuggestedMilestoneId;
          if (!mid) continue;
          claimByMilestone.set(
            mid,
            (claimByMilestone.get(mid) ?? 0) + (line.amountThisPeriod ?? 0),
          );
        }
        if (claimByMilestone.size > 0) {
          const ranked = Array.from(claimByMilestone.entries())
            .map(([mid, total]) => {
              const m = plan.milestones.find((mm) => String(mm._id) === mid);
              return {
                mid,
                total,
                sequence: m?.sequence ?? Number.POSITIVE_INFINITY,
              };
            })
            .sort((a, b) =>
              b.total !== a.total ? b.total - a.total : a.sequence - b.sequence,
            );
          derivedMilestoneId = ranked[0]?.mid;
        }
      }

      const targetMilestoneId = opts.milestoneId ?? derivedMilestoneId;

      const milestone = targetMilestoneId
        ? plan.milestones.find((m) => String(m._id) === String(targetMilestoneId))
        : plan.milestones
            .slice()
            .sort((a, b) => a.sequence - b.sequence)
            .find((m) => m.status !== "verified" && m.status !== "rejected");
      if (!milestone) {
        throw new Error(
          targetMilestoneId
            ? `milestone ${targetMilestoneId} not on finance plan`
            : "no active milestone on finance plan",
        );
      }

      const planFormats = new Map<Discipline, PlanFormatDoc>();
      for (const d of DISCIPLINES) {
        const pf = (await PlanFormat.findOne({
          projectId,
          discipline: d,
        }).sort({ version: -1 })) as PlanFormatDoc | null;
        if (pf) planFormats.set(d, pf);
      }
      if (planFormats.size === 0) {
        throw new Error("no PlanFormat rows for project");
      }

      const observations = (await Observation.find({
        projectId,
      })) as ObservationDoc[];

      const aggregated = aggregateObservationsPerElement(observations);
      const unapproved = Array.from(
        new Set(
          observations.flatMap((o) => o.unexpectedObservations ?? []),
        ),
      );

      const userText = buildContextPacket({
        milestone,
        plan,
        planFormats,
        aggregated,
        unapproved,
      });

      const messages: ClaudeMessage[] = [
        { role: "user", content: [{ type: "text", text: userText }] },
      ];

      const { data, usage } = await claudeCall<ToolOutput>({
        system: SYSTEM_PROMPT,
        messages,
        tool: {
          name: "emit_gap_report",
          description:
            "Emit the full GapReport — per-element statuses, SOV findings, verdict, narrative.",
          inputSchema: {
            type: "object",
            required: [
              "perElement",
              "sovLineFindings",
              "overallStatus",
              "loanInBalance",
              "narrative",
              "drawVerdict",
            ],
            properties: {
              perElement: {
                type: "array",
                items: {
                  type: "object",
                  required: [
                    "discipline",
                    "elementId",
                    "plannedState",
                    "observedState",
                    "status",
                  ],
                  properties: {
                    discipline: { type: "string", enum: [...DISCIPLINES] },
                    elementId: { type: "string" },
                    plannedState: { type: "string" },
                    observedState: { type: "string" },
                    status: {
                      type: "string",
                      enum: [...PER_ELEMENT_STATUSES],
                    },
                  },
                },
              },
              sovLineFindings: {
                type: "array",
                items: {
                  type: "object",
                  required: [
                    "sovLineNumber",
                    "claimedPct",
                    "observedPct",
                    "variance",
                    "flag",
                  ],
                  properties: {
                    sovLineNumber: { type: "string" },
                    claimedPct: { type: "number", minimum: 0, maximum: 100 },
                    observedPct: { type: "number", minimum: 0, maximum: 100 },
                    variance: { type: "number" },
                    flag: { type: "string", enum: [...SOV_FLAGS] },
                  },
                },
              },
              overallStatus: {
                type: "string",
                enum: [...OVERALL_STATUSES],
              },
              daysOffset: { type: "number" },
              loanInBalance: { type: "boolean" },
              remainingBudget: { type: "number" },
              remainingCost: { type: "number" },
              unapprovedDeviations: {
                type: "array",
                items: { type: "string" },
              },
              narrative: { type: "string" },
              drawVerdict: {
                type: "object",
                required: ["verdict", "reasoning"],
                properties: {
                  verdict: { type: "string", enum: [...DRAW_VERDICTS] },
                  reasoning: { type: "string" },
                  conditions: { type: "array", items: { type: "string" } },
                  missingRequirements: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
            },
          },
          outputSchema: toolOutputSchema,
        },
        model: config.anthropicModel,
        maxTokens: 6144,
      });
      ctx.recordUsage(usage);

      const knownElementIds = new Set<string>();
      for (const pf of planFormats.values()) {
        for (const el of pf.elements) knownElementIds.add(el.elementId);
      }
      const perElementFiltered = data.perElement.filter((p) =>
        knownElementIds.has(p.elementId),
      );
      const perElementDropped = data.perElement.length - perElementFiltered.length;

      const perElementWithCitations = perElementFiltered.map((p) => {
        const agg = aggregated.get(p.elementId);
        return {
          discipline: p.discipline,
          elementId: p.elementId,
          plannedState: p.plannedState,
          observedState: p.observedState,
          status: p.status,
          citations: agg?.photoIds ?? [],
        };
      });

      const sovPhotoMap = new Map<string, Types.ObjectId[]>();
      for (const rc of milestone.requiredCompletion) {
        // best-effort: any photo that observed an element of this discipline
        const photos = new Set<string>();
        for (const agg of aggregated.values()) {
          const hasDiscipline = Array.from(planFormats.entries()).some(
            ([d, pf]) =>
              d === rc.discipline &&
              pf.elements.some((e) => e.elementId === agg.elementId),
          );
          if (hasDiscipline) {
            for (const pid of agg.photoIds) photos.add(String(pid));
          }
        }
        sovPhotoMap.set(rc.elementKindOrId, Array.from(photos).map((s) => s as unknown as Types.ObjectId));
      }

      // Photos by discipline: an SOV line tagged with a disciplineHint
      // gets every photo that observed any element of that discipline. Coarse
      // but deterministic and matches the agent's own SOV scoping logic.
      const photosByDiscipline = new Map<Discipline, Set<string>>();
      for (const agg of aggregated.values()) {
        for (const [d, pf] of planFormats.entries()) {
          if (pf.elements.some((e) => e.elementId === agg.elementId)) {
            if (!photosByDiscipline.has(d)) photosByDiscipline.set(d, new Set());
            for (const pid of agg.photoIds) {
              photosByDiscipline.get(d)!.add(String(pid));
            }
          }
        }
      }
      const photosByLineNumber = new Map<string, Types.ObjectId[]>();
      for (const sov of plan.sov) {
        if (!sov.disciplineHint) continue;
        const photoSet = photosByDiscipline.get(sov.disciplineHint);
        if (!photoSet) continue;
        photosByLineNumber.set(
          sov.lineNumber,
          Array.from(photoSet).map((s) => s as unknown as Types.ObjectId),
        );
      }

      const sovLineFindings = data.sovLineFindings.map((s) => ({
        ...s,
        evidencePhotoIds: photosByLineNumber.get(s.sovLineNumber) ?? [],
      }));

      const report = await GapReport.create({
        projectId,
        milestoneId: milestone._id,
        ...(opts.drawId ? { drawId: opts.drawId } : {}),
        asOf: new Date(),
        perElement: perElementWithCitations,
        sovLineFindings,
        overallStatus: data.overallStatus,
        daysOffset: data.daysOffset,
        loanInBalance: data.loanInBalance,
        remainingBudget: data.remainingBudget,
        remainingCost: data.remainingCost,
        unapprovedDeviations: data.unapprovedDeviations ?? [],
        narrative: data.narrative,
        drawVerdict: data.drawVerdict,
        generatedAt: new Date(),
        modelVersion: MODEL_VERSION,
      });

      return {
        gapReportId: report._id,
        milestoneSequence: milestone.sequence,
        verdict: data.drawVerdict.verdict,
        overallStatus: data.overallStatus,
        perElementCount: perElementWithCitations.length,
        droppedHallucinations: perElementDropped,
        sovFindingCount: sovLineFindings.length,
        unapprovedDeviationCount: (data.unapprovedDeviations ?? []).length,
      };
    },
  );
}
