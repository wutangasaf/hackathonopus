import { z } from "zod";
import type { Types } from "mongoose";
import { DocumentModel, type DocumentDoc } from "../models/document.js";
import { FinancePlan } from "../models/financePlan.js";
import { DISCIPLINES } from "../models/planClassification.js";
import { Draw, type DrawStatus } from "../models/draw.js";
import { renderPdfToPngs } from "../lib/pdfRender.js";
import { claudeCall, type ClaudeMessage } from "../lib/claudeCall.js";
import { withAgentRun } from "./shared.js";
import { config } from "../config.js";

const AGENT_NAME = "G703Extractor";
const MODEL_VERSION = "g703-extractor/v1";

const extractedLineSchema = z.object({
  lineNumber: z.string().min(1),
  description: z.string().min(1),
  csiCode: z.string().optional(),
  scheduledValue: z.number().nonnegative(),
  pctThisPeriod: z.number().min(0).max(100),
  pctCumulative: z.number().min(0).max(100),
  amountThisPeriod: z.number().nonnegative(),
  aiSuggestedMilestoneId: z.string().optional(),
  aiSuggestedDiscipline: z.enum(DISCIPLINES).optional(),
  aiConfidence: z.number().min(0).max(1),
  aiReasoning: z.string().max(240).optional(),
});

const toolOutputSchema = z.object({
  lines: z.array(extractedLineSchema),
  totalAmountRequested: z.number().nonnegative().optional(),
});

type ToolOutput = z.infer<typeof toolOutputSchema>;

const CSI_KEY = `CSI MasterFormat divisions (use to map csiCode → discipline):
03 Concrete          → STRUCTURAL
04 Masonry           → STRUCTURAL
05 Metals            → STRUCTURAL
06 Wood/Plastics     → STRUCTURAL or ARCHITECTURE
07 Thermal & Moisture→ ARCHITECTURE
08 Openings          → ARCHITECTURE
09 Finishes          → ARCHITECTURE
10–14 Specialties    → ARCHITECTURE
21 Fire Suppression  → PLUMBING
22 Plumbing          → PLUMBING
23 HVAC              → PLUMBING  (we collapse mechanical under PLUMBING for this demo)
26 Electrical        → ELECTRICAL
27 Communications    → ELECTRICAL
28 Electronic Safety → ELECTRICAL
31 Earthwork         → STRUCTURAL
32 Exterior Improv.  → ARCHITECTURE
33 Utilities         → PLUMBING`;

function buildSystemPrompt(params: {
  milestones: Array<{ id: string; sequence: number; name: string }>;
  sovSummary: Array<{
    lineNumber: string;
    description: string;
    scheduledValue: number;
    csiCode?: string;
  }>;
}): string {
  const milestonesText = params.milestones
    .map((m) => `  - id=${m.id}  seq=${m.sequence}  name="${m.name}"`)
    .join("\n");
  const sovText = params.sovSummary
    .slice(0, 200)
    .map(
      (s) =>
        `  - ${s.lineNumber}: ${s.description}  ($${s.scheduledValue.toLocaleString()}${
          s.csiCode ? `, CSI ${s.csiCode}` : ""
        })`,
    )
    .join("\n");

  return `You are a G703 Extraction & Mapping Agent for construction draw requests.

You receive rendered pages of an AIA G703 "Continuation Sheet" (the line-item breakdown of a monthly draw request). For each row on the sheet you must return:
1. The row data as it appears on the G703.
2. Which Gantt milestone on this project the row should bill against (best-effort; optional).
3. A confidence score (0-1) and a one-line reasoning string.

### Primary directive
Extraction is ALWAYS required. For every data row on the continuation sheet (excluding headers and grand-total rows) emit one entry in \`lines\`, regardless of whether project milestones or a master SOV are provided below. Milestone mapping and SOV cross-checking are best-effort context — if either is missing, still extract every row, leave \`aiSuggestedMilestoneId\` unset, and lower \`aiConfidence\` on the mapping. Never return an empty \`lines\` array when the sheet has visible rows.

### CSI grounding
${CSI_KEY}

### Project milestones (pick one id per row when possible)
${milestonesText || "  (none — project has no milestones; leave aiSuggestedMilestoneId empty for every row, but STILL extract every row)"}

### Master SOV on this project (optional cross-check — if present, the G703 should echo these line numbers and scheduled values)
${sovText || "  (no SOV uploaded yet — this is optional context; extract every row from the G703 as printed)"}

### Column interpretation
G703 continuation sheets typically have these columns. Use the real labels where present:
- A  Item No                              → lineNumber
- B  Description of Work                  → description
- C  Scheduled Value                      → scheduledValue (must match master SOV within 1%)
- D  Work Completed — From Previous Application
- E  Work Completed — This Period         → amountThisPeriod (dollars). If only % is shown, derive the dollar amount against Scheduled Value.
- F  Materials Presently Stored
- G  Total Completed and Stored to Date   → together with (H) yields pctCumulative
- H  %  (G ÷ C)                           → pctCumulative directly
- I  Balance to Finish
- J  Retainage

If pctThisPeriod is not printed explicitly, derive it as (amountThisPeriod ÷ scheduledValue) × 100. Round to one decimal.

### Mapping rules
- If csiCode is printed, use it first. CSI 26 (Electrical) → pick the lowest-sequence ELECTRICAL milestone that is not yet 100% complete.
- If no CSI code, match the description semantically against milestone names.
- When two or more milestones plausibly fit, pick the lowest-sequence not-yet-complete one and cap confidence at 0.7.
- When no milestone plausibly fits, omit aiSuggestedMilestoneId, set confidence ≤ 0.3, and explain why in aiReasoning.
- Never invent a milestone id that is not in the list above.
- Never guess a csiCode that is not printed on the sheet.

### Confidence calibration
- 1.0        exact CSI match AND unambiguous description match
- 0.85-0.99  clear discipline match, one plausible milestone
- 0.6-0.85   discipline clear, milestone picked among 2-3 plausibles
- <0.6       guessing; contractor must override

### Rules
- Return every row in sheet order, even rows claiming 0% this period.
- aiReasoning must be ≤ 240 characters, one sentence, citing the evidence (CSI code, keyword, description match).
- Call the extract_and_map tool exactly once.`;
}

function buildUserMessages(pages: Buffer[]): ClaudeMessage[] {
  const content: ClaudeMessage["content"] = [
    {
      type: "text",
      text: `Extract and map every line on the following G703 continuation sheet (${pages.length} page(s)).`,
    },
  ];
  pages.forEach((png, i) => {
    content.push({
      type: "text",
      text: `--- page ${i + 1} of ${pages.length} ---`,
    });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: png.toString("base64"),
      },
    });
  });
  return [{ role: "user", content }];
}

export async function runG703Extractor(params: {
  projectId: Types.ObjectId | string;
  drawId: Types.ObjectId | string;
  g703DocumentId: Types.ObjectId | string;
}) {
  return withAgentRun(
    {
      projectId: params.projectId,
      agentName: AGENT_NAME,
      modelVersion: MODEL_VERSION,
      input: {
        drawId: String(params.drawId),
        g703DocumentId: String(params.g703DocumentId),
      },
    },
    async (ctx) => {
      const doc = (await DocumentModel.findById(
        params.g703DocumentId,
      )) as DocumentDoc | null;
      if (!doc) throw new Error("G703 document not found");
      if (doc.kind !== "DRAW_G703") {
        throw new Error(`expected DRAW_G703 document, got ${doc.kind}`);
      }

      const plan = await FinancePlan.findOne({
        projectId: params.projectId,
      }).sort({ uploadedAt: -1 });
      if (!plan) {
        throw new Error(
          "no FinancePlan on this project — master SOV must be set before a G703 can be parsed",
        );
      }

      const milestones = plan.milestones
        .slice()
        .sort((a, b) => a.sequence - b.sequence)
        .map((m) => ({
          id: String(m._id),
          sequence: m.sequence,
          name: m.name,
        }));

      const sovSummary = plan.sov.map((s) => ({
        lineNumber: s.lineNumber,
        description: s.description,
        scheduledValue: s.scheduledValue,
        csiCode: s.csiCode ?? undefined,
      }));

      const pages = await renderPdfToPngs(doc.storagePath);
      if (pages.length === 0) {
        throw new Error("no pages rendered from G703 document");
      }

      const system = buildSystemPrompt({ milestones, sovSummary });
      const messages = buildUserMessages(pages);

      const { data, usage, raw } = await claudeCall<ToolOutput>({
        system,
        messages,
        tool: {
          name: "extract_and_map",
          description:
            "Emit every line from the G703 continuation sheet with scheduled, this-period, and cumulative values, plus the suggested project milestone for each.",
          inputSchema: {
            type: "object",
            required: ["lines"],
            properties: {
              lines: {
                type: "array",
                description: "One entry per row on the G703 in sheet order.",
                items: {
                  type: "object",
                  required: [
                    "lineNumber",
                    "description",
                    "scheduledValue",
                    "pctThisPeriod",
                    "pctCumulative",
                    "amountThisPeriod",
                    "aiConfidence",
                  ],
                  properties: {
                    lineNumber: { type: "string" },
                    description: { type: "string" },
                    csiCode: { type: "string" },
                    scheduledValue: { type: "number", minimum: 0 },
                    pctThisPeriod: {
                      type: "number",
                      minimum: 0,
                      maximum: 100,
                    },
                    pctCumulative: {
                      type: "number",
                      minimum: 0,
                      maximum: 100,
                    },
                    amountThisPeriod: { type: "number", minimum: 0 },
                    aiSuggestedMilestoneId: { type: "string" },
                    aiSuggestedDiscipline: {
                      type: "string",
                      enum: [...DISCIPLINES],
                    },
                    aiConfidence: {
                      type: "number",
                      minimum: 0,
                      maximum: 1,
                    },
                    aiReasoning: { type: "string", maxLength: 240 },
                  },
                },
              },
              totalAmountRequested: { type: "number", minimum: 0 },
            },
          },
          outputSchema: toolOutputSchema,
        },
        model: config.anthropicModel,
        maxTokens: 8192,
      });
      ctx.recordUsage(usage);

      if (data.lines.length === 0) {
        const modelText = raw.content
          .filter(
            (b): b is Extract<typeof b, { type: "text" }> => b.type === "text",
          )
          .map((b) => b.text)
          .join(" ")
          .trim()
          .slice(0, 400);
        console.warn("[G703Extractor] empty lines returned", {
          drawId: String(params.drawId),
          pageCount: pages.length,
          firstPageBytes: pages[0]?.length ?? 0,
          sovRows: sovSummary.length,
          milestoneCount: milestones.length,
          modelText: modelText || "(model returned no text blocks)",
        });
        const pageHint = `rendered ${pages.length} page${pages.length === 1 ? "" : "s"} from your PDF`;
        throw new Error(
          sovSummary.length === 0
            ? `parser returned no line items (${pageHint}) — this project has no master SOV on its finance plan, so the extractor had nothing to match against`
            : `parser returned no usable line items (${pageHint}) — check that the PDF is an AIA G703 continuation sheet with visible rows, not a cover sheet or photo${modelText ? `. Model note: ${modelText.slice(0, 140)}` : ""}`,
        );
      }

      const linesForDraw = data.lines.map((l) => ({
        ...l,
        approvalStatus: "pending" as const,
      }));

      const totalAmount =
        data.totalAmountRequested ??
        data.lines.reduce((a, l) => a + l.amountThisPeriod, 0);

      await Draw.updateOne(
        { _id: params.drawId },
        {
          $set: {
            status: "ready_for_review" satisfies DrawStatus,
            totalAmountRequested: totalAmount,
            lines: linesForDraw,
            extractorRunId: ctx.run._id,
          },
          $unset: { extractorError: "" },
        },
      );

      return {
        drawId: String(params.drawId),
        lineCount: data.lines.length,
        totalAmountRequested: totalAmount,
      };
    },
  );
}
