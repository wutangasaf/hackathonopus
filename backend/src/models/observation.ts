import { Schema, model, type InferSchemaType, type Types } from "mongoose";
import { DISCIPLINES } from "./planClassification.js";

export const OBSERVED_STATES = [
  "PRESENT",
  "ABSENT",
  "PARTIAL",
  "DEVIATED",
] as const;
export type ObservedState = (typeof OBSERVED_STATES)[number];

const matchedElementSchema = new Schema(
  {
    elementId: { type: String, required: true },
    observedState: { type: String, enum: OBSERVED_STATES, required: true },
    observedPct: { type: Number },
    confidence: { type: Number, required: true },
    evidence: { type: String, required: true },
  },
  { _id: false },
);

const observationSchema = new Schema(
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
      required: true,
      index: true,
    },
    discipline: { type: String, enum: DISCIPLINES, required: true },
    matchedElements: { type: [matchedElementSchema], default: [] },
    unexpectedObservations: [{ type: String }],
    safetyFlags: [{ type: String }],
    modelVersion: { type: String, required: true },
    observedAt: { type: Date, default: () => new Date(), required: true },
  },
  { timestamps: true },
);

export type ObservationDoc = InferSchemaType<typeof observationSchema> & {
  _id: Types.ObjectId;
};

export const Observation = model("Observation", observationSchema);
