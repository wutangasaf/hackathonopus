import { Schema, model, type InferSchemaType, type Types } from "mongoose";
import { DISCIPLINES } from "./planClassification.js";

const planElementSchema = new Schema(
  {
    elementId: { type: String, required: true },
    kind: { type: String, required: true },
    identifier: { type: String, required: true },
    spec: { type: Map, of: String, default: () => new Map() },
    location: { type: String },
    drawingRef: { type: String },
  },
  { _id: false },
);

const planFormatSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    discipline: { type: String, enum: DISCIPLINES, required: true },
    version: { type: Number, default: 1, required: true },
    elements: { type: [planElementSchema], default: [] },
    inspectorChecklist: [{ type: String }],
    scaleNotes: { type: String },
    sourceSheets: [{ type: String }],
    modelVersion: { type: String, required: true },
    extractedAt: { type: Date, default: () => new Date(), required: true },
  },
  { timestamps: true },
);

planFormatSchema.index({ projectId: 1, discipline: 1, version: -1 });

export type PlanFormatDoc = InferSchemaType<typeof planFormatSchema> & {
  _id: Types.ObjectId;
};

export const PlanFormat = model("PlanFormat", planFormatSchema);
