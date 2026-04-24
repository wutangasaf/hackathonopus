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
const MODEL_VERSION = "photo-guidance/v3";

const shotSchema = z.object({
  shotId: z.string().min(1),
  discipline: z.enum(DISCIPLINES),
  target: z.string().min(1),
  framing: z.string().min(1),
  angle: z.string().min(1),
  lighting: z.string().min(1),
  safety: z.string().optional(),
  proofOfLocation: z.string().min(1),
  referenceElementIds: z.array(z.string()).optional(),
  referenceLineNumbers: z.array(z.string()).optional(),
});

const toolOutputSchema = z.object({
  shotList: z.array(shotSchema),
});

type ToolOutput = z.infer<typeof toolOutputSchema>;

const SYSTEM_PROMPT = `You are a senior construction inspection coordinator producing a photo shot list for a field inspector with a mobile phone. The contractor has submitted a G703 draw request claiming specific percent-complete values against specific SOV line items this period. Your shot list must let the inspector verify those claims in one site walk, AND give the lender's reviewer enough evidence to believe each photo is of the claimed element (not a similar one or one recycled from a prior draw).

## Output fields (per shot)
- shotId: stable slug you choose (e.g. "plumb-lav-01", "struct-footing-ne-corner"). Unique within the list.
- discipline: one of ${DISCIPLINES.join(", ")}. Must match the element(s) being verified.
- target: specific, concrete subject that verifies a claimed line ("north-east footing at grid A-1 for line 03-110"). Reference the element identifier and the SOV line number when helpful.
- framing: "wide" / "medium" / "close" / "macro" / "wide+close pair" — pick based on what the inspector must see. For dimensional elements, prefer "wide+close pair" to give both context and detail in one shot (submit both frames).
- angle: concrete and actionable. E.g. "perpendicular at 1.5m, phone level", "45° down from ~2m height", "overhead looking straight down", "elevation from outside the wall". Do NOT emit vague single-word angles.
- lighting: concrete and actionable. E.g. "daylight, sun behind camera", "phone flashlight on, no flash", "shoot between 10am–2pm to keep shadows short". Do NOT emit "daylight preferred" with no further direction.
- safety: optional, only when the shot requires specific PPE or caution ("from outside enclosure — do not enter live-wired panel").
- proofOfLocation: REQUIRED. One sentence naming what the inspector must include IN FRAME to prove this photo is of the claimed element and not a lookalike. Examples: "chalked grid A-1 on slab in corner of frame", "stack label 'V-2' sharpied on pipe", "room number '204' on door jamb", "taped G703 line number on plywood behind element". Pick something that cannot be faked by submitting a photo of a different element.
- referenceElementIds: elementId values from the provided PlanFormat elements that this shot verifies.
- referenceLineNumbers: the SOV/G703 line numbers this shot verifies. REQUIRED — every shot must cite at least one claimed line.

## Discipline-specific rules — use these instead of generic guidance
STRUCTURAL: For rebar / formwork / concrete, require a tape measure or ruler in frame so spacing and cover are measurable from the photo. Include a perpendicular + overhead pair where spacing matters. For poured elements, shoot before the pour is covered by subsequent trades. For columns/beams, include the gridline marking so location is unambiguous.

PLUMBING: For rough-in (DWV + supply), shoot from 1.5m perpendicular to the fixture wall; include a ruler or known-height object so stub-out heights are inferrable. For water heaters / mechanical rooms, capture both the fixture and the label/data plate in one frame where possible. For vent stacks, shoot the roof termination AND the stack origin.

ELECTRICAL: Ensure panel labels, circuit numbers, and device tags are legible — prefer a close shot of the label followed by a wide of the whole panel. For device rough-in (outlets/switches), include the box height relative to finished floor with a ruler or tape. Panels: photograph with the dead-front removed AND reinstalled, so wire-fill and the final labelled cover are both evidenced.

ARCHITECTURAL: Include the room-number or grid reference in the first frame (door jamb, taped on wall). For finishes, shoot a wide establishing shot PLUS a close of the finish swatch/transition. Shoot with the natural light source behind the camera, not the subject. For windows/doors, include hardware detail in a second close shot.

## Global rules
- One shot per claimed line where the line's discipline has a matching PlanFormat. If multiple claimed lines can be captured in one frame (same wall, same enclosure), combine them in referenceLineNumbers.
- Ignore claimed lines whose discipline has no PlanFormat available — you cannot ground them in plan elements.
- 5–20 shots total. Order by site-walk sequence (outside → in, bottom → up), not by discipline.
- Never invent an element that isn't in the PlanFormat input.
- Do not emit shots for lines with pctThisPeriod=0.
- Do not include generic "site safety walk" shots.

## Few-shot examples

Example 1 — plumbing rough-in, PARTIAL completion claim:
{
  "shotId": "plumb-lav-01-rough",
  "discipline": "PLUMBING",
  "target": "Lavatory rough-in at vanity LAV-01 in 2nd-floor guest bath, verifying 40% claim on line 22-420",
  "framing": "wide+close pair",
  "angle": "perpendicular at 1.5m, phone level — then macro of stub-out heights",
  "lighting": "phone flashlight on, no flash, shoot mid-day with window light behind camera",
  "proofOfLocation": "tape-measure zeroed at finished floor with room label 'BATH 204' sharpied on sheetrock in frame",
  "referenceElementIds": ["lav-01-roughin"],
  "referenceLineNumbers": ["22-420"]
}

Example 2 — structural footing, PRESENT:
{
  "shotId": "struct-footing-A1",
  "discipline": "STRUCTURAL",
  "target": "NE corner footing at grid A-1, verifying 100% on line 03-110",
  "framing": "wide",
  "angle": "overhead looking straight down, then perpendicular elevation from outside excavation",
  "lighting": "daylight, sun behind camera, between 10am–2pm to keep shadows short",
  "safety": "do not enter excavation — shoot from outside barrier",
  "proofOfLocation": "chalked 'A-1' on plywood form in frame, plus tape measure spanning 1m across rebar for spacing verification",
  "referenceElementIds": ["footing-ne-A1"],
  "referenceLineNumbers": ["03-110"]
}

Example 3 — electrical panel, DEVIATED (wrong breaker count claim):
{
  "shotId": "elec-panel-P2-labels",
  "discipline": "ELECTRICAL",
  "target": "Panel P-2 circuit schedule + wire fill, verifying 75% on line 26-200",
  "framing": "close",
  "angle": "perpendicular at 0.5m to the circuit directory label, then wide with dead-front removed",
  "lighting": "phone flashlight on, no camera flash (creates glare on label polycarbonate)",
  "safety": "from outside panel footprint — do not insert hands; work with panel de-energized only",
  "proofOfLocation": "panel tag 'P-2' visible top-left of door frame, room tag 'MECH 101' on adjacent wall",
  "referenceElementIds": ["panel-p2"],
  "referenceLineNumbers": ["26-200"]
}

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
                    "proofOfLocation",
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
                    proofOfLocation: { type: "string" },
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
