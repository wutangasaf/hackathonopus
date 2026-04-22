import { Schema, model, type InferSchemaType, type Types } from "mongoose";

export const PHOTO_QUALITIES = ["GOOD", "NEEDS_RETAKE"] as const;
export type PhotoQuality = (typeof PHOTO_QUALITIES)[number];

const photoAssessmentSchema = new Schema(
  {
    photoDocumentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      index: true,
    },
    quality: { type: String, enum: PHOTO_QUALITIES, required: true },
    discipline: {
      type: String,
      enum: ["ARCHITECTURE", "STRUCTURAL", "ELECTRICAL", "PLUMBING"],
    },
    issues: [{ type: String }],
    retakeInstructions: { type: String },
    phaseFit: { type: Number },
    matchedShotId: { type: String },
    modelVersion: { type: String, required: true },
  },
  { timestamps: true },
);

export type PhotoAssessmentDoc = InferSchemaType<
  typeof photoAssessmentSchema
> & { _id: Types.ObjectId };

export const PhotoAssessment = model("PhotoAssessment", photoAssessmentSchema);
