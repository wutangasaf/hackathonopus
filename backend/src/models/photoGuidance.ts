import { Schema, model, type InferSchemaType, type Types } from "mongoose";
import { DISCIPLINES } from "./planClassification.js";

const shotSchema = new Schema(
  {
    shotId: { type: String, required: true },
    discipline: { type: String, enum: DISCIPLINES, required: true },
    target: { type: String, required: true },
    framing: { type: String, required: true },
    angle: { type: String, required: true },
    lighting: { type: String, required: true },
    safety: { type: String },
    proofOfLocation: { type: String },
    referenceElementIds: [{ type: String }],
    referenceLineNumbers: [{ type: String }],
  },
  { _id: false },
);

const photoGuidanceSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    drawId: {
      type: Schema.Types.ObjectId,
      ref: "Draw",
      required: true,
    },
    shotList: { type: [shotSchema], default: [] },
    generatedAt: { type: Date, default: () => new Date(), required: true },
    modelVersion: { type: String, required: true },
  },
  { timestamps: true },
);

photoGuidanceSchema.index({ projectId: 1, drawId: 1 });

export type PhotoGuidanceDoc = InferSchemaType<typeof photoGuidanceSchema> & {
  _id: Types.ObjectId;
};

export const PhotoGuidance = model("PhotoGuidance", photoGuidanceSchema);
