import { z } from "zod";
import type { Types } from "mongoose";
import {
  DocumentModel,
  type DocumentDoc,
} from "../models/document.js";
import {
  PlanClassification,
  DISCIPLINES,
  type Discipline,
  type PlanClassificationDoc,
} from "../models/planClassification.js";
import { PlanFormat } from "../models/planFormat.js";
import { renderPdfToPngs } from "../lib/pdfRender.js";
import { claudeCall, type ClaudeMessage } from "../lib/claudeCall.js";
import { withAgentRun } from "./shared.js";
import { config } from "../config.js";

const AGENT_NAME = "PlanFormatExtractor";
const MODEL_VERSION = "plan-format-extractor/v1";

const elementSchema = z.object({
  elementId: z.string().min(1),
  kind: z.string().min(1),
  identifier: z.string().min(1),
  spec: z.record(z.string()).optional(),
  location: z.string().optional(),
  drawingRef: z.string().optional(),
});

const toolOutputSchema = z.object({
  elements: z.array(elementSchema),
  inspectorChecklist: z.array(z.string()),
  scaleNotes: z.string().optional(),
  sourceSheets: z.array(z.string()),
});

type ToolOutput = z.infer<typeof toolOutputSchema>;

type ClassifiedSheet = PlanClassificationDoc["sheets"][number];

function systemPromptFor(discipline: Discipline): string {
  return `You are a senior construction-plan analyst specializing in ${discipline}. You receive rendered pages from an approved construction-plan set that have been tagged as ${discipline} discipline. Extract a "professional-format payload" describing what should exist on-site per these plans:

- elements[]: each a discrete, inspectable thing the plans call for. elementId is your own stable slug (e.g. "col-a1", "wc-03", "outlet-kit-04"). kind is the element type in snake_case ("column", "water_closet", "junction_box", "duplex_receptacle"). identifier is the label as printed on the plan ("C-1A", "WC-03"). spec is a flat map of key→value properties read off the sheet (e.g. {"diameter":"24\\"", "material":"reinforced_concrete"}). location is a short human description tying it to a room or grid ("kitchen north wall near grid B-2"). drawingRef is the sheet label + detail number ("A-201 / 3"). Include each element once; if the plan shows 20 identical elements, emit them once with a count in spec.
- inspectorChecklist[]: short imperatives in the voice of a ${discipline} inspector ("Verify all kitchen outlets within 6ft of sink are GFCI-protected", "Confirm slab thickness 6\\" at footing F-1"). Order by site-walk sequence. 5-30 items.
- scaleNotes: one paragraph on scale conventions, symbol legends, or call-outs worth remembering while walking the site. Optional but preferred.
- sourceSheets: array of the sheet labels you drew from (from the titleblock, e.g. ["E-1", "E-2"]). If sheet labels aren't visible, use "page-<n>".

You MUST call the extract_plan_format tool exactly once. If the pages contain no ${discipline} content (misclassification), emit elements: [], inspectorChecklist: [], and explain in scaleNotes.`;
}

type SelectedPage = {
  documentId: Types.ObjectId;
  pageNumber: number;
  sheetLabel: string;
};

function pickSheetLabel(sheet: ClassifiedSheet, fallbackIndex: number): string {
  const label = sheet.titleblock?.sheetLabel;
  if (label && label.trim().length > 0) return label;
  return `page-${fallbackIndex + 1}`;
}

async function renderSelectedPages(
  docs: DocumentDoc[],
  pages: { documentId: Types.ObjectId; pageNumber: number }[],
): Promise<Buffer[]> {
  const byDoc = new Map<string, number[]>();
  for (const p of pages) {
    const key = p.documentId.toString();
    if (!byDoc.has(key)) byDoc.set(key, []);
    byDoc.get(key)!.push(p.pageNumber);
  }

  const renderedByDoc = new Map<string, Buffer[]>();
  for (const doc of docs) {
    const key = doc._id.toString();
    if (!byDoc.has(key)) continue;
    const all = await renderPdfToPngs(doc.storagePath);
    renderedByDoc.set(key, all);
  }

  const out: Buffer[] = [];
  for (const p of pages) {
    const all = renderedByDoc.get(p.documentId.toString());
    if (!all) continue;
    const png = all[p.pageNumber - 1];
    if (png) out.push(png);
  }
  return out;
}

function buildUserMessages(
  discipline: Discipline,
  pngs: Buffer[],
  sheetLabels: string[],
): ClaudeMessage[] {
  const content: ClaudeMessage["content"] = [
    {
      type: "text",
      text: `${pngs.length} page(s) tagged as ${discipline}. Sheet labels in order: ${sheetLabels.join(", ")}.`,
    },
  ];
  pngs.forEach((png, i) => {
    content.push({
      type: "text",
      text: `--- sheet=${sheetLabels[i] ?? `page-${i + 1}`} ---`,
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

export async function runPlanFormatExtractor(
  projectId: Types.ObjectId | string,
) {
  return withAgentRun(
    {
      projectId,
      agentName: AGENT_NAME,
      modelVersion: MODEL_VERSION,
    },
    async (ctx) => {
      const classification = (await PlanClassification.findOne({
        projectId,
      }).sort({ version: -1 })) as PlanClassificationDoc | null;
      if (!classification) {
        throw new Error(
          "no PlanClassification for project; run PlanClassifier first",
        );
      }

      const docs = (await DocumentModel.find({
        projectId,
        kind: "PLAN",
      })) as unknown as DocumentDoc[];

      const groups = new Map<Discipline, SelectedPage[]>();
      classification.sheets.forEach((sheet, idx) => {
        const d = sheet.discipline as Discipline;
        if (!groups.has(d)) groups.set(d, []);
        groups.get(d)!.push({
          documentId: sheet.documentId,
          pageNumber: sheet.pageNumber,
          sheetLabel: pickSheetLabel(sheet, idx),
        });
      });

      const createdFormats: {
        discipline: Discipline;
        planFormatId: Types.ObjectId;
        elementCount: number;
      }[] = [];

      for (const discipline of DISCIPLINES) {
        const pages = groups.get(discipline);
        if (!pages || pages.length === 0) continue;

        const pngs = await renderSelectedPages(docs, pages);
        if (pngs.length === 0) continue;

        const messages = buildUserMessages(
          discipline,
          pngs,
          pages.map((p) => p.sheetLabel),
        );

        const { data, usage } = await claudeCall<ToolOutput>({
          system: systemPromptFor(discipline),
          messages,
          tool: {
            name: "extract_plan_format",
            description:
              "Emit the discipline-specific professional-format payload (elements + inspector checklist + scale notes + source sheets).",
            inputSchema: {
              type: "object",
              required: ["elements", "inspectorChecklist", "sourceSheets"],
              properties: {
                elements: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["elementId", "kind", "identifier"],
                    properties: {
                      elementId: { type: "string" },
                      kind: { type: "string" },
                      identifier: { type: "string" },
                      spec: {
                        type: "object",
                        additionalProperties: { type: "string" },
                      },
                      location: { type: "string" },
                      drawingRef: { type: "string" },
                    },
                  },
                },
                inspectorChecklist: {
                  type: "array",
                  items: { type: "string" },
                },
                scaleNotes: { type: "string" },
                sourceSheets: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
            outputSchema: toolOutputSchema,
          },
          model: config.anthropicModel,
          maxTokens: 6144,
        });
        ctx.recordUsage(usage);

        const priorVersion = await PlanFormat.findOne({
          projectId,
          discipline,
        })
          .sort({ version: -1 })
          .select("version");
        const nextVersion = (priorVersion?.version ?? 0) + 1;

        const planFormat = await PlanFormat.create({
          projectId,
          discipline,
          version: nextVersion,
          elements: data.elements.map((e) => ({
            elementId: e.elementId,
            kind: e.kind,
            identifier: e.identifier,
            spec: e.spec ? new Map(Object.entries(e.spec)) : new Map(),
            location: e.location,
            drawingRef: e.drawingRef,
          })),
          inspectorChecklist: data.inspectorChecklist,
          scaleNotes: data.scaleNotes,
          sourceSheets: data.sourceSheets,
          modelVersion: MODEL_VERSION,
          extractedAt: new Date(),
        });

        createdFormats.push({
          discipline,
          planFormatId: planFormat._id,
          elementCount: data.elements.length,
        });
      }

      return {
        disciplinesProcessed: createdFormats.map((c) => c.discipline),
        formats: createdFormats,
      };
    },
  );
}
