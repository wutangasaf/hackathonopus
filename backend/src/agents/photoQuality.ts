import { z } from "zod";
import type { Types } from "mongoose";
import {
  DocumentModel,
  type DocumentDoc,
} from "../models/document.js";
import { loadVisionImage } from "../lib/photoLoad.js";
import {
  PhotoAssessment,
  PHOTO_QUALITIES,
} from "../models/photoAssessment.js";
import {
  PhotoGuidance,
  type PhotoGuidanceDoc,
} from "../models/photoGuidance.js";
import { DISCIPLINES } from "../models/planClassification.js";
import { FinancePlan, type FinancePlanDoc } from "../models/financePlan.js";
import { claudeCall, type ClaudeMessage } from "../lib/claudeCall.js";
import { withAgentRun } from "./shared.js";
import { config } from "../config.js";

const AGENT_NAME = "PhotoQuality";
const MODEL_VERSION = "photo-quality/v1";

const toolOutputSchema = z.object({
  quality: z.enum(PHOTO_QUALITIES),
  discipline: z.enum(DISCIPLINES).optional(),
  matchedShotId: z.string().optional(),
  phaseFit: z.number().min(0).max(1).optional(),
  issues: z.array(z.string()).optional(),
  retakeInstructions: z.string().optional(),
});

type ToolOutput = z.infer<typeof toolOutputSchema>;

const SYSTEM_PROMPT = `You are a photo quality inspector for construction documentation. You receive a phone photo from a construction site and judge whether it is usable for verifying plan elements.

Emit:
- quality: GOOD if the photo is in focus, properly exposed, the subject is clearly identifiable, and an inspector could use it to verify the state of construction. NEEDS_RETAKE if blurry, too dark/bright, obstructed, wrong subject, or the subject is not identifiable.
- discipline: best guess at which discipline the photo belongs to — one of ${DISCIPLINES.join(", ")}. Omit if the photo clearly shows no construction subject.
- matchedShotId: if a shot list is provided in the user message and the photo matches one of the listed shots, emit that shotId. Omit if no shot list or no match.
- phaseFit: 0–1 score for how well the photo fits the expected construction phase/milestone given the shot list context. Omit if no shot list.
- issues: short strings describing what's wrong ("motion_blur", "flash_glare_on_fixture", "subject_partially_occluded_by_tarp"). Empty array if quality=GOOD.
- retakeInstructions: if quality=NEEDS_RETAKE, a one-sentence concrete retake instruction ("Step 1m back, turn off flash, photograph perpendicular to the fixture wall."). Omit if quality=GOOD.

You MUST call the assess_photo tool exactly once.`;

export async function runPhotoQuality(
  photoDocumentId: Types.ObjectId | string,
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
      input: { photoDocumentId: String(photoDocumentId) },
      modelVersion: MODEL_VERSION,
    },
    async (ctx) => {
      const plan = (await FinancePlan.findOne({
        projectId: photoDoc.projectId,
      }).sort({ uploadedAt: -1 })) as FinancePlanDoc | null;

      let guidance: PhotoGuidanceDoc | null = null;
      if (plan) {
        const currentMilestone = plan.milestones
          .slice()
          .sort((a, b) => a.sequence - b.sequence)
          .find((m) => m.status !== "verified" && m.status !== "rejected");
        if (currentMilestone) {
          guidance = (await PhotoGuidance.findOne({
            projectId: photoDoc.projectId,
            milestoneId: currentMilestone._id,
          })) as PhotoGuidanceDoc | null;
        }
      }

      const image = await loadVisionImage(
        photoDoc.storagePath,
        photoDoc.mimeType,
        photoDoc.originalFilename,
      );
      const contextLines: string[] = [];
      contextLines.push(
        `Photo: ${photoDoc.originalFilename} (mimeType=${photoDoc.mimeType}).`,
      );
      if (guidance && guidance.shotList.length > 0) {
        contextLines.push(
          `## Expected shot list for the active milestone (use to compute matchedShotId + phaseFit):`,
        );
        for (const s of guidance.shotList) {
          contextLines.push(
            `- shotId="${s.shotId}" discipline=${s.discipline} target="${s.target}" framing=${s.framing} angle=${s.angle}`,
          );
        }
      } else {
        contextLines.push(
          `No shot list available. Omit matchedShotId and phaseFit.`,
        );
      }

      const messages: ClaudeMessage[] = [
        {
          role: "user",
          content: [
            { type: "text", text: contextLines.join("\n") },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: image.mediaType,
                data: image.buffer.toString("base64"),
              },
            },
          ],
        },
      ];

      const { data, usage } = await claudeCall<ToolOutput>({
        system: SYSTEM_PROMPT,
        messages,
        tool: {
          name: "assess_photo",
          description: "Emit a quality + discipline assessment for the photo.",
          inputSchema: {
            type: "object",
            required: ["quality", "issues"],
            properties: {
              quality: { type: "string", enum: [...PHOTO_QUALITIES] },
              discipline: { type: "string", enum: [...DISCIPLINES] },
              matchedShotId: { type: "string" },
              phaseFit: { type: "number", minimum: 0, maximum: 1 },
              issues: { type: "array", items: { type: "string" } },
              retakeInstructions: { type: "string" },
            },
          },
          outputSchema: toolOutputSchema,
        },
        model: config.anthropicModel,
        maxTokens: 1024,
      });
      ctx.recordUsage(usage);

      await PhotoAssessment.deleteMany({ photoDocumentId });
      const row = await PhotoAssessment.create({
        photoDocumentId,
        projectId: photoDoc.projectId,
        quality: data.quality,
        discipline: data.discipline,
        issues: data.issues ?? [],
        retakeInstructions: data.retakeInstructions,
        phaseFit: data.phaseFit,
        matchedShotId: data.matchedShotId,
        modelVersion: MODEL_VERSION,
      });

      return {
        photoAssessmentId: row._id,
        quality: data.quality,
        discipline: data.discipline,
        matchedShotId: data.matchedShotId,
      };
    },
  );
}
