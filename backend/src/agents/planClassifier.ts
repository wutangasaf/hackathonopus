import { z } from "zod";
import type { Types } from "mongoose";
import { DocumentModel, type DocumentDoc } from "../models/document.js";
import { PlanClassification } from "../models/planClassification.js";
import { DISCIPLINES, SHEET_ROLES } from "../models/planClassification.js";
import { renderPdfToPngs } from "../lib/pdfRender.js";
import { claudeCall, type ClaudeMessage } from "../lib/claudeCall.js";
import { withAgentRun } from "./shared.js";
import { config } from "../config.js";

const AGENT_NAME = "PlanClassifier";
const MODEL_VERSION = "plan-classifier/v2";

const titleblockSchema = z.object({
  sheetLabel: z.string().optional(),
  date: z.string().optional(),
  scale: z.string().optional(),
  architect: z.string().optional(),
});

const classifiedPageSchema = z.object({
  pageIndex: z.number().int().min(0),
  discipline: z.enum(DISCIPLINES),
  sheetRole: z.enum(SHEET_ROLES),
  titleblock: titleblockSchema.optional(),
  notes: z.string().optional(),
});

const toolOutputSchema = z.object({
  pages: z.array(classifiedPageSchema),
});

type ToolOutput = z.infer<typeof toolOutputSchema>;

const SYSTEM_PROMPT = `You are a construction-plan analyst. You receive rendered pages from an approved construction-plan PDF (the owner-approved set). Each page is preceded by a header line that includes the source filename and the page number within that file — treat both as signals.

For each page, classify:

- discipline: one of ${DISCIPLINES.join(", ")}. Use ALL available evidence: the titleblock sheet label prefix (A- → ARCHITECTURE, S- → STRUCTURAL, E- → ELECTRICAL, P- or M-/plumbing fixtures → PLUMBING), the visible drawing content (framing/rebar → STRUCTURAL, one-line/panel schedules/lighting → ELECTRICAL, risers/waste/vent → PLUMBING, floor layouts/rooms/walls → ARCHITECTURE), and the source filename (e.g. "structural.pdf" strongly implies STRUCTURAL for all its pages). Do not collapse everything into ARCHITECTURE — if a page has any structural, electrical, or plumbing content as its primary subject, pick that discipline. Only use ARCHITECTURE when the drawing is genuinely architectural (floor plans, elevations of the building envelope, room layouts, finishes) or when you have strong independent evidence.
- sheetRole: one of ${SHEET_ROLES.join(", ")}. PLAN_VIEW for floor plans, site plans, foundation plans, framing plans, power plans, plumbing plans — anything top-down. ELEVATION for exterior/side views. SECTION for cut-through views. DETAIL for callout details. SCHEDULE for fixture/door/window/panel schedules. OTHER is reserved strictly for cover sheets, title sheets, pure general-notes pages, or index/sheet-list pages — do NOT use OTHER for any page that contains a drawing. If the page has any drawn content at all, pick the best drawing role (default to PLAN_VIEW for top-down views when uncertain).
- titleblock: extract sheetLabel (e.g. "A-101", "E-2", "S-201"), date, scale (e.g. "1/4\\" = 1'-0\\""), architect/firm name. sheetLabel is the most important field — if a sheet code is legible anywhere in the titleblock, you MUST return it. Omit fields that are not legible; never invent or guess a code.
- notes: optional, brief (≤ 120 chars). Use only for things an inspector would care about on this page (ambiguity, damaged scan, unusual discipline mix, titleblock obscured).

You MUST call the classify_pages tool exactly once with one entry per page, in order, using pageIndex that matches the 0-indexed input order I specify below.`;

type PageRef = {
  pageIndex: number;
  documentId: Types.ObjectId;
  documentPageNumber: number;
  originalFilename: string;
  png: Buffer;
};

async function renderAllPlanPages(
  docs: DocumentDoc[],
): Promise<PageRef[]> {
  const out: PageRef[] = [];
  let globalIndex = 0;
  for (const doc of docs) {
    const pngs = await renderPdfToPngs(doc.storagePath);
    pngs.forEach((png, i) => {
      out.push({
        pageIndex: globalIndex++,
        documentId: doc._id,
        documentPageNumber: i + 1,
        originalFilename: doc.originalFilename,
        png,
      });
    });
  }
  return out;
}

function buildUserMessages(pages: PageRef[]): ClaudeMessage[] {
  const content: ClaudeMessage["content"] = [
    {
      type: "text",
      text: `Classify the following ${pages.length} page(s). pageIndex ranges 0..${pages.length - 1}, matching the order of the images below. Each header names the source PDF filename and the 1-indexed page within that file — use both as classification signals alongside the image.`,
    },
  ];
  for (const p of pages) {
    content.push({
      type: "text",
      text: `--- pageIndex=${p.pageIndex} | source="${p.originalFilename}" p.${p.documentPageNumber} ---`,
    });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: p.png.toString("base64"),
      },
    });
  }
  return [{ role: "user", content }];
}

export async function runPlanClassifier(projectId: Types.ObjectId | string) {
  return withAgentRun(
    {
      projectId,
      agentName: AGENT_NAME,
      modelVersion: MODEL_VERSION,
    },
    async (ctx) => {
      const docs = (await DocumentModel.find({
        projectId,
        kind: "PLAN",
      }).sort({ serverReceivedAt: 1 })) as unknown as DocumentDoc[];

      if (docs.length === 0) {
        throw new Error("no PLAN documents for project");
      }

      const pageRefs = await renderAllPlanPages(docs);
      if (pageRefs.length === 0) {
        throw new Error("no pages rendered from PLAN documents");
      }

      const messages = buildUserMessages(pageRefs);

      const { data, usage } = await claudeCall<ToolOutput>({
        system: SYSTEM_PROMPT,
        messages,
        tool: {
          name: "classify_pages",
          description:
            "Emit per-page classifications for a rendered plan PDF. pageIndex must match the 0-indexed order of pages in the input.",
          inputSchema: {
            type: "object",
            required: ["pages"],
            properties: {
              pages: {
                type: "array",
                description: "One entry per page, ordered by pageIndex.",
                items: {
                  type: "object",
                  required: ["pageIndex", "discipline", "sheetRole"],
                  properties: {
                    pageIndex: { type: "integer", minimum: 0 },
                    discipline: {
                      type: "string",
                      enum: [...DISCIPLINES],
                    },
                    sheetRole: {
                      type: "string",
                      enum: [...SHEET_ROLES],
                    },
                    titleblock: {
                      type: "object",
                      properties: {
                        sheetLabel: { type: "string" },
                        date: { type: "string" },
                        scale: { type: "string" },
                        architect: { type: "string" },
                      },
                    },
                    notes: { type: "string" },
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

      const byIndex = new Map(pageRefs.map((p) => [p.pageIndex, p]));
      const sheets = data.pages
        .map((p) => {
          const ref = byIndex.get(p.pageIndex);
          if (!ref) return null;
          return {
            documentId: ref.documentId,
            pageNumber: ref.documentPageNumber,
            discipline: p.discipline,
            sheetRole: p.sheetRole,
            titleblock: p.titleblock ?? {},
            notes: p.notes,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

      const prior = await PlanClassification.findOne({ projectId }).sort({
        version: -1,
      });
      const nextVersion = (prior?.version ?? 0) + 1;

      const classification = await PlanClassification.create({
        projectId,
        version: nextVersion,
        sheets,
        sourceDocumentIds: docs.map((d) => d._id),
        extractedAt: new Date(),
        modelVersion: MODEL_VERSION,
      });

      return {
        planClassificationId: classification._id,
        version: nextVersion,
        sheetCount: sheets.length,
      };
    },
  );
}
