import { z } from "zod";
import type { Types } from "mongoose";
import { FinancePlan, type FinancePlanDoc } from "../models/financePlan.js";
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
const MODEL_VERSION = "photo-guidance/v1";

const shotSchema = z.object({
  shotId: z.string().min(1),
  discipline: z.enum(DISCIPLINES),
  target: z.string().min(1),
  framing: z.string().min(1),
  angle: z.string().min(1),
  lighting: z.string().min(1),
  safety: z.string().optional(),
  referenceElementIds: z.array(z.string()).optional(),
});

const toolOutputSchema = z.object({
  shotList: z.array(shotSchema),
});

type ToolOutput = z.infer<typeof toolOutputSchema>;

const SYSTEM_PROMPT = `You are a senior construction inspection coordinator producing a photo shot list for a field inspector with a mobile phone. Given the active draw milestone's completion requirements and the approved plan elements for each required discipline, emit a structured shot list the inspector can execute on a single site walk.

For each shot:
- shotId: stable slug you choose (e.g. "plumb-lav-01", "struct-footing-ne-corner"). Unique within the list.
- discipline: one of ${DISCIPLINES.join(", ")}. Must match the element(s) being verified.
- target: specific, concrete subject ("north-east footing at grid A-1", "lavatory rough-in at vanity lav-01"). Reference the element identifier when helpful.
- framing: "wide" / "medium" / "close" / "macro" — pick based on what the inspector must see.
- angle: "perpendicular" / "45° down" / "overhead" / "elevation" — what will make features readable.
- lighting: "daylight preferred" / "flash OK" / "avoid backlight" / "high-contrast scene" — actionable, not vague.
- safety: optional, only when the shot requires specific PPE or caution ("from outside enclosure — do not enter live-wired panel").
- referenceElementIds: the elementId values from the provided PlanFormat elements that this shot is meant to verify.

Rules:
- Produce one shot per element in requiredCompletion that is ≥ minPct complete-worthy to inspect. If multiple elements can be captured in one frame (same wall, same enclosure), combine them in referenceElementIds.
- 5–20 shots total. Order them by site-walk sequence (outside → in, bottom → up), not by discipline.
- Never invent an element that isn't in the PlanFormat input.
- Do not include general "site safety walk" shots — only shots that verify plan elements relevant to this milestone.

You MUST call the generate_shot_list tool exactly once.`;

type PlanFormatLite = {
  discipline: Discipline;
  elements: { elementId: string; kind: string; identifier: string; location?: string }[];
};

function buildUserContent(
  milestone: FinancePlanDoc["milestones"][number],
  planFormats: PlanFormatLite[],
): string {
  const lines: string[] = [];
  lines.push(
    `## Active milestone\nsequence=${milestone.sequence} name="${milestone.name}" plannedPercentOfLoan=${milestone.plannedPercentOfLoan}`,
  );
  lines.push(`## Required completion targets for this milestone`);
  for (const rc of milestone.requiredCompletion) {
    lines.push(
      `- discipline=${rc.discipline} elementKindOrId="${rc.elementKindOrId}" minPct=${rc.minPct}`,
    );
  }
  if (milestone.requiredDocs.length > 0) {
    lines.push(`## Required docs at draw time (for context only, not shot targets):`);
    for (const d of milestone.requiredDocs) lines.push(`- ${d}`);
  }
  if (milestone.planDocRefs && milestone.planDocRefs.length > 0) {
    lines.push(`## Plan documents this tranche is drawing against (cite sheet labels in shot targets when helpful):`);
    for (const ref of milestone.planDocRefs) {
      const sheets =
        ref.sheetLabels && ref.sheetLabels.length > 0
          ? ` sheets=[${ref.sheetLabels.join(",")}]`
          : "";
      const note = ref.notes ? ` note="${ref.notes}"` : "";
      lines.push(`- documentId=${String(ref.documentId)}${sheets}${note}`);
    }
  }
  lines.push(`## PlanFormat elements by discipline`);
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
  milestoneId: Types.ObjectId | string,
) {
  return withAgentRun(
    {
      projectId,
      agentName: AGENT_NAME,
      input: { milestoneId: String(milestoneId) },
      modelVersion: MODEL_VERSION,
    },
    async (ctx) => {
      const plan = (await FinancePlan.findOne({ projectId }).sort({
        uploadedAt: -1,
      })) as FinancePlanDoc | null;
      if (!plan) throw new Error("no finance plan for project");

      const milestone = plan.milestones.find(
        (m) => String(m._id) === String(milestoneId),
      );
      if (!milestone) {
        throw new Error(`milestone ${milestoneId} not on latest finance plan`);
      }

      const neededDisciplines = new Set<Discipline>(
        milestone.requiredCompletion.map((rc) => rc.discipline as Discipline),
      );
      if (neededDisciplines.size === 0) {
        throw new Error("milestone has no requiredCompletion entries");
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
        throw new Error(
          `no PlanFormat for disciplines required by milestone (${Array.from(neededDisciplines).join(", ")})`,
        );
      }

      const userText = buildUserContent(milestone, planFormats);
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

      await PhotoGuidance.deleteMany({ projectId, milestoneId });
      const row = await PhotoGuidance.create({
        projectId,
        milestoneId,
        shotList: data.shotList.map((s) => ({
          ...s,
          referenceElementIds: s.referenceElementIds ?? [],
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
