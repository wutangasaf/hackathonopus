import { Schema, model, type InferSchemaType, type Types } from "mongoose";
import { DISCIPLINES } from "./planClassification.js";

export const REINSPECTION_STATUSES = [
  "pending",
  "completed",
  "cancelled",
] as const;
export type ReinspectionStatus = (typeof REINSPECTION_STATUSES)[number];

const reinspectionShotSchema = new Schema(
  {
    description: { type: String, required: true },
    discipline: { type: String, enum: DISCIPLINES },
    referenceElementId: { type: String },
    angle: { type: String },
    lighting: { type: String },
    safety: { type: String },
  },
  { _id: false },
);

const reinspectionRequestSchema = new Schema(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "SupervisorSession",
      required: true,
      index: true,
    },
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
      index: true,
    },
    targetLineItems: { type: [String], default: [] },
    shots: { type: [reinspectionShotSchema], default: [] },
    narrative: { type: String, required: true },
    dueBy: { type: Date },
    status: {
      type: String,
      enum: REINSPECTION_STATUSES,
      default: "pending",
      required: true,
    },
  },
  { timestamps: true },
);

export type ReinspectionRequestDoc = InferSchemaType<
  typeof reinspectionRequestSchema
> & { _id: Types.ObjectId };

export const ReinspectionRequest = model(
  "ReinspectionRequest",
  reinspectionRequestSchema,
);
