import { Schema, model, type InferSchemaType, type Types } from "mongoose";

export const SUPERVISOR_FINDING_SEVERITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;
export type SupervisorFindingSeverity =
  (typeof SUPERVISOR_FINDING_SEVERITIES)[number];

export const SUPERVISOR_RECOMMENDATIONS = [
  "APPROVE",
  "APPROVE_WITH_CONDITIONS",
  "HOLD",
  "REJECT",
] as const;
export type SupervisorRecommendation =
  (typeof SUPERVISOR_RECOMMENDATIONS)[number];

const findingEvidenceSchema = new Schema(
  {
    kind: { type: String, required: true },
    reference: { type: String, required: true },
    note: { type: String },
  },
  { _id: false },
);

const supervisorFindingSchema = new Schema(
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
    severity: {
      type: String,
      enum: SUPERVISOR_FINDING_SEVERITIES,
      required: true,
    },
    category: { type: String, required: true },
    narrative: { type: String, required: true },
    evidence: { type: [findingEvidenceSchema], default: [] },
    recommendation: {
      type: String,
      enum: SUPERVISOR_RECOMMENDATIONS,
      required: true,
    },
  },
  { timestamps: true },
);

export type SupervisorFindingDoc = InferSchemaType<
  typeof supervisorFindingSchema
> & { _id: Types.ObjectId };

export const SupervisorFinding = model(
  "SupervisorFinding",
  supervisorFindingSchema,
);
