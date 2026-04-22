import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { Types } from "mongoose";
import {
  DocumentModel,
  type DocumentDoc,
} from "../models/document.js";
import {
  PlanFormat,
  type PlanFormatDoc,
} from "../models/planFormat.js";
import { Observation, OBSERVED_STATES } from "../models/observation.js";
import { DISCIPLINES, type Discipline } from "../models/planClassification.js";
import { claudeCall, type ClaudeMessage } from "../lib/claudeCall.js";
import { withAgentRun } from "./shared.js";
import { config } from "../config.js";

const AGENT_NAME = "PhotoToPlanFormat";
const MODEL_VERSION = "photo-to-plan-format/v1";

const matchedElementSchema = z.object({
  elementId: z.string().min(1),
  observedState: z.enum(OBSERVED_STATES),
  observedPct: z.number().min(0).max(100).optional(),
  confidence: z.number().min(0).max(1),
  evidence: z.string().min(1),
});

const toolOutputSchema = z.object({
  matchedElements: z.array(matchedElementSchema),
  unexpectedObservations: z.array(z.string()).optional(),
  safetyFlags: z.array(z.string()).optional(),
});

type ToolOutput = z.infer<typeof toolOutputSchema>;

function systemPromptFor(discipline: Discipline): string {
  return `You are a senior ${discipline} construction-plan analyst. You receive a phone photo from a construction site plus the approved PlanFormat for ${discipline} — the set of elements that should exist per the approved plans. Your job is to map what you see in the photo to the plan elements.

For each plan element that is visible (or clearly absent/partial/deviated) in the photo, emit a matchedElement with:
- elementId: the exact elementId from the plan. Do NOT invent ids.
- observedState: PRESENT = element is installed and matches the spec; ABSENT = element should be visible here but is not; PARTIAL = present but installation is incomplete (e.g. rough-in only, missing finish); DEVIATED = present but does not match the spec (wrong material, wrong location, wrong dimension).
- observedPct: optional 0–100 estimate of completion for this element (omit unless you have visual evidence — e.g. rough plumbing stubbed but no fixture = ~40%).
- confidence: 0–1. Use ≤ 0.5 if the photo is low quality, the element is partially occluded, or you're inferring from context.
- evidence: one sentence grounded in what you can literally see ("copper stub-out visible 30 cm above floor, capped, no fixture mounted").

Only emit an element if you have visual evidence. Do not hallucinate elements that are off-frame.

Also emit:
- unexpectedObservations: short strings describing things in the photo that are NOT on the plan (e.g. "extra floor drain installed near east wall — not on PLUMBING plan"). These feed the "unapproved scope deviation" flagger downstream — be precise.
- safetyFlags: specific safety issues visible in the photo ("exposed live-wire junction without box", "unguarded floor opening", "ladder >6ft without fall protection"). Empty array if nothing notable.

You MUST call the map_photo_to_plan tool exactly once.`;
}

export async function runPhotoToPlanFormat(
  photoDocumentId: Types.ObjectId | string,
  discipline: Discipline,
) {
  const photoDoc = (await DocumentModel.findOne({
    _id: photoDocumentId,
    kind: "PHOTO",
  })) as DocumentDoc | null;
  if (!photoDoc) throw new Error(`photo document ${photoDocumentId} not found`);

  return withAgentRun(
    {
      projectId: photoDoc.projectId as Types.ObjectId,
      agentName: AGENT_NAME,
      input: { photoDocumentId: String(photoDocumentId), discipline },
      modelVersion: MODEL_VERSION,
    },
    async (ctx) => {
      const pf = (await PlanFormat.findOne({
        projectId: photoDoc.projectId,
        discipline,
      }).sort({ version: -1 })) as PlanFormatDoc | null;
      if (!pf) {
        throw new Error(
          `no PlanFormat for discipline=${discipline} on this project`,
        );
      }

      const elementLines = pf.elements.map((el) => {
        const loc = el.location ? ` — at ${el.location}` : "";
        return `- elementId="${el.elementId}" kind=${el.kind} identifier="${el.identifier}"${loc}`;
      });

      const imageBytes = await readFile(photoDoc.storagePath);
      const mediaType = (
        photoDoc.mimeType.startsWith("image/") ? photoDoc.mimeType : "image/jpeg"
      ) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

      const contextText = [
        `Photo: ${photoDoc.originalFilename}.`,
        `## Approved ${discipline} PlanFormat elements (match against these only):`,
        ...elementLines,
      ].join("\n");

      const messages: ClaudeMessage[] = [
        {
          role: "user",
          content: [
            { type: "text", text: contextText },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBytes.toString("base64"),
              },
            },
          ],
        },
      ];

      const { data, usage } = await claudeCall<ToolOutput>({
        system: systemPromptFor(discipline),
        messages,
        tool: {
          name: "map_photo_to_plan",
          description:
            "Emit per-element observations and any unexpected findings.",
          inputSchema: {
            type: "object",
            required: ["matchedElements"],
            properties: {
              matchedElements: {
                type: "array",
                items: {
                  type: "object",
                  required: [
                    "elementId",
                    "observedState",
                    "confidence",
                    "evidence",
                  ],
                  properties: {
                    elementId: { type: "string" },
                    observedState: {
                      type: "string",
                      enum: [...OBSERVED_STATES],
                    },
                    observedPct: { type: "number", minimum: 0, maximum: 100 },
                    confidence: { type: "number", minimum: 0, maximum: 1 },
                    evidence: { type: "string" },
                  },
                },
              },
              unexpectedObservations: {
                type: "array",
                items: { type: "string" },
              },
              safetyFlags: { type: "array", items: { type: "string" } },
            },
          },
          outputSchema: toolOutputSchema,
        },
        model: config.anthropicModel,
        maxTokens: 2048,
      });
      ctx.recordUsage(usage);

      const knownIds = new Set(pf.elements.map((e) => e.elementId));
      const filtered = data.matchedElements.filter((m) =>
        knownIds.has(m.elementId),
      );
      const dropped = data.matchedElements.length - filtered.length;

      const unexpected = data.unexpectedObservations ?? [];
      const safety = data.safetyFlags ?? [];
      const row = await Observation.create({
        photoDocumentId,
        projectId: photoDoc.projectId,
        discipline,
        matchedElements: filtered,
        unexpectedObservations: unexpected,
        safetyFlags: safety,
        modelVersion: MODEL_VERSION,
        observedAt: new Date(),
      });

      return {
        observationId: row._id,
        matchedCount: filtered.length,
        droppedHallucinations: dropped,
        unexpectedCount: unexpected.length,
        safetyFlagCount: safety.length,
      };
    },
  );
}
