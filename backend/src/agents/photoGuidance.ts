import { z } from "zod";
import type { Types } from "mongoose";
import { FinancePlan, type FinancePlanDoc } from "../models/financePlan.js";
import { Draw, type DrawDoc } from "../models/draw.js";
import {
  PlanFormat,
  type PlanFormatDoc,
} from "../models/planFormat.js";
import { DISCIPLINES, type Discipline } from "../models/planClassification.js";
import { PhotoGuidance } from "../models/photoGuidance.js";
import { claudeCall, type ClaudeMessage } from "../lib/claudeCall.js";
import { withAgentRun } from "./shared.js";
import { config } from "../config.js";

const AGENT_NAME = "PhotoGuidance";
const MODEL_VERSION = "photo-guidance/v2";

const shotSchema = z.object({
  shotId: z.string().min(1),
  discipline: z.enum(DISCIPLINES),
  target: z.string().min(1),
  framing: z.string().min(1),
  angle: z.string().min(1),
  lighting: z.string().min(1),
  safety: z.string().optional(),
  referenceElementIds: z.array(z.string()).optional(),
  referenceLineNumbers: z.array(z.string()).optional(),
});

const toolOutputSchema = z.object({
  shotList: z.array(shotSchema),
});

type ToolOutput = z.infer<typeof toolOutputSchema>;

const SYSTEM_PROMPT = `You are a senior construction inspection coordinator producing a photo shot list for a field inspector with a mobile phone. The contractor has submitted a G703 draw request claiming specific percent-complete values against specific SOV line items this period. Your shot list must let the inspector verify those claims in one site walk.

For each shot:
- shotId: stable slug you choose (e.g. "plumb-lav-01", "struct-footing-ne-corner"). Unique within the list.
- discipline: one of ${DISCIPLINES.join(", ")}. Must match the element(s) being verified.
- target: specific, concrete subject that verifies a claimed line ("north-east footing at grid A-1 for line 03-110", "lavatory rough-in at vanity lav-01 for line 22-420"). Reference the element identifier and the SOV line number when helpful.
- framing: "wide" / "medium" / "close" / "macro" — pick based on what the inspector must see.
- angle: "perpendicular" / "45° down" / "overhead" / "elevation" — what will make features readable.
- lighting: "daylight preferred" / "flash OK" / "avoid backlight" / "high-contrast scene" — actionable, not vague.
- safety: optional, only when the shot requires specific PPE or caution ("from outside enclosure — do not enter live-wired panel").
- referenceElementIds: elementId values from the provided PlanFormat elements that this shot verifies.
- referenceLineNumbers: the SOV/G703 line numbers this shot verifies. REQUIRED — every shot must cite at least one claimed line.

Rules:
- One shot per claimed line where the line's discipline has a matching PlanFormat. If multiple claimed lines can be captured in one frame (same wall, same enclosure), combine them in referenceLineNumbers.
- Ignore claimed lines whose discipline has no PlanFormat available — you cannot ground them in plan elements.
- 5–20 shots total. Order by site-walk sequence (outside → in, bottom → up), not by discipline.
- Never invent an element that isn't in the PlanFormat input.
- Do not emit shots for lines with pctThisPeriod=0.
- Do not include generic "site safety walk" shots.

You MUST call the generate_shot_list tool exactly once.`;

type PlanFormatLite = {
  discipline: Discipline;
  elements: { elementId: string; kind: string; identifier: string; location?: string }[];
};

type ClaimedLine = {
  lineNumber: string;
  description: string;
  csiCode?: string;
  pctThisPeriod: number;
  pctCumulative: number;
  amountThisPeriod: number;
  confirmedMilestoneId: string;
  discipline?: Discipline;
};

type MilestoneLite = {
  milestoneId: string;
  sequence: number;
  name: string;
  plannedPercentOfLoan: number;
};

function buildUserContent(
  draw: DrawDoc,
  claimedLines: ClaimedLine[],
  milestones: MilestoneLite[],
  planFormats: PlanFormatLite[],
): string {
  const lines: string[] = [];
  lines.push(
    `## Active draw request\ndrawNumber=${draw.drawNumber} periodStart=${draw.periodStart.toISOString().slice(0, 10)} periodEnd=${draw.periodEnd.toISOString().slice(0, 10)} contractor="${draw.contractor.companyName}"`,
  );

  lines.push(`## Claimed lines this period (what the inspector must verify)`);
  for (const l of claimedLines) {
    const csi = l.csiCode ? ` csi=${l.csiCode}` : "";
    const disc = l.discipline ? ` discipline=${l.discipline}` : "";
    lines.push(
      `- lineNumber=${l.lineNumber}${csi}${disc} pctThisPeriod=${l.pctThisPeriod} pctCumulative=${l.pctCumulative} amountThisPeriod=${l.amountThisPeriod} milestoneId=${l.confirmedMilestoneId} description="${l.description}"`,
    );
  }

  lines.push(`## Milestones touched by this draw`);
  for (const m of milestones) {
    lines.push(
      `- milestoneId=${m.milestoneId} sequence=${m.sequence} name="${m.name}" plannedPercentOfLoan=${m.plannedPercentOfLoan}`,
    );
  }

  lines.push(`## PlanFormat elements by discipline (use these to ground shot targets)`);
  for (const pf of planFormats) {
    lines.push(`### ${pf.discipline} (${pf.elements.length} elements)`);
    for (const el of pf.elements) {
      const loc = el.location ? ` — at ${el.location}` : "";
      lines.push(
        `- elementId="${el.elementId}" kind=${el.kind} identifier="${el.identifier}"${loc}`,
      );
    }
  }
  return lines.join("\n");
}

export async function runPhotoGuidance(
  projectId: Types.ObjectId | string,
  drawId: Types.ObjectId | string,
) {
  return withAgentRun(
    {
      projectId,
      agentName: AGENT_NAME,
      input: { drawId: String(drawId) },
      modelVersion: MODEL_VERSION,
    },
    async (ctx) => {
      const draw = (await Draw.findOne({
        _id: drawId,
        projectId,
      })) as DrawDoc | null;
      if (!draw) throw new Error(`draw ${drawId} not found for project`);
      if (draw.status !== "approved") {
        throw new Error(
          `draw ${drawId} not approved yet (status=${draw.status}) — contractor must approve before guidance`,
        );
      }

      const reviewedLines = draw.lines.filter(
        (l) =>
          l.approvalStatus !== "pending" &&
          !!l.confirmedMilestoneId &&
          l.pctThisPeriod > 0,
      );

      if (reviewedLines.length === 0) {
        await PhotoGuidance.deleteMany({ projectId, drawId });
        const row = await PhotoGuidance.create({
          projectId,
          drawId,
          shotList: [],
          generatedAt: new Date(),
          modelVersion: MODEL_VERSION,
        });
        return { photoGuidanceId: row._id, shotCount: 0 };
      }

      const plan = (await FinancePlan.findOne({ projectId }).sort({
        uploadedAt: -1,
      })) as FinancePlanDoc | null;
      if (!plan) throw new Error("no finance plan for project");

      const touchedMilestoneIds = new Set(
        reviewedLines.map((l) => String(l.confirmedMilestoneId)),
      );
      const touchedMilestones = plan.milestones.filter((m) =>
        touchedMilestoneIds.has(String(m._id)),
      );

      const milestonesLite: MilestoneLite[] = touchedMilestones.map((m) => ({
        milestoneId: String(m._id),
        sequence: m.sequence,
        name: m.name,
        plannedPercentOfLoan: m.plannedPercentOfLoan,
      }));

      const neededDisciplines = new Set<Discipline>();
      for (const m of touchedMilestones) {
        for (const rc of m.requiredCompletion) {
          neededDisciplines.add(rc.discipline as Discipline);
        }
      }
      for (const l of reviewedLines) {
        if (l.aiSuggestedDiscipline) {
          neededDisciplines.add(l.aiSuggestedDiscipline as Discipline);
        }
      }

      const planFormats: PlanFormatLite[] = [];
      for (const d of neededDisciplines) {
        const pf = (await PlanFormat.findOne({ projectId, discipline: d })
          .sort({ version: -1 })) as PlanFormatDoc | null;
        if (!pf) continue;
        planFormats.push({
          discipline: d,
          elements: pf.elements.map((e) => ({
            elementId: e.elementId,
            kind: e.kind,
            identifier: e.identifier,
            location: e.location ?? undefined,
          })),
        });
      }

      if (planFormats.length === 0) {
        await PhotoGuidance.deleteMany({ projectId, drawId });
        const row = await PhotoGuidance.create({
          projectId,
          drawId,
          shotList: [],
          generatedAt: new Date(),
          modelVersion: MODEL_VERSION,
        });
        return { photoGuidanceId: row._id, shotCount: 0 };
      }

      const availableDisciplines = new Set<Discipline>(
        planFormats.map((pf) => pf.discipline),
      );
      const claimedLines: ClaimedLine[] = reviewedLines.map((l) => ({
        lineNumber: l.lineNumber,
        description: l.description,
        csiCode: l.csiCode ?? undefined,
        pctThisPeriod: l.pctThisPeriod,
        pctCumulative: l.pctCumulative,
        amountThisPeriod: l.amountThisPeriod,
        confirmedMilestoneId: String(l.confirmedMilestoneId),
        discipline:
          l.aiSuggestedDiscipline &&
          availableDisciplines.has(l.aiSuggestedDiscipline as Discipline)
            ? (l.aiSuggestedDiscipline as Discipline)
            : undefined,
      }));

      const userText = buildUserContent(
        draw,
        claimedLines,
        milestonesLite,
        planFormats,
      );
      const messages: ClaudeMessage[] = [
        { role: "user", content: [{ type: "text", text: userText }] },
      ];

      const { data, usage } = await claudeCall<ToolOutput>({
        system: SYSTEM_PROMPT,
        messages,
        tool: {
          name: "generate_shot_list",
          description: "Emit a shot list the inspector should capture.",
          inputSchema: {
            type: "object",
            required: ["shotList"],
            properties: {
              shotList: {
                type: "array",
                items: {
                  type: "object",
                  required: [
                    "shotId",
                    "discipline",
                    "target",
                    "framing",
                    "angle",
                    "lighting",
                    "referenceLineNumbers",
                  ],
                  properties: {
                    shotId: { type: "string" },
                    discipline: { type: "string", enum: [...DISCIPLINES] },
                    target: { type: "string" },
                    framing: { type: "string" },
                    angle: { type: "string" },
                    lighting: { type: "string" },
                    safety: { type: "string" },
                    referenceElementIds: {
                      type: "array",
                      items: { type: "string" },
                    },
                    referenceLineNumbers: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          outputSchema: toolOutputSchema,
        },
        model: config.anthropicModel,
        maxTokens: 4096,
      });
      ctx.recordUsage(usage);

      await PhotoGuidance.deleteMany({ projectId, drawId });
      const row = await PhotoGuidance.create({
        projectId,
        drawId,
        shotList: data.shotList.map((s) => ({
          ...s,
          referenceElementIds: s.referenceElementIds ?? [],
          referenceLineNumbers: s.referenceLineNumbers ?? [],
        })),
        generatedAt: new Date(),
        modelVersion: MODEL_VERSION,
      });

      return {
        photoGuidanceId: row._id,
        shotCount: data.shotList.length,
      };
    },
  );
}
