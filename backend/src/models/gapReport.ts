import { Schema, model, type InferSchemaType, type Types } from "mongoose";
import { DISCIPLINES } from "./planClassification.js";

export const PER_ELEMENT_STATUSES = [
  "VERIFIED",
  "PARTIAL",
  "MISSING",
  "DEVIATED",
  "UNVERIFIED",
] as const;
export type PerElementStatus = (typeof PER_ELEMENT_STATUSES)[number];

export const SOV_FLAGS = [
  "ok",
  "minor",
  "material",
  "unapproved_scope",
] as const;
export type SovFlag = (typeof SOV_FLAGS)[number];

export const OVERALL_STATUSES = [
  "ON_TRACK",
  "BEHIND",
  "DEVIATION_FOUND",
  "TECHNICAL_DEFAULT_RISK",
] as const;
export type OverallStatus = (typeof OVERALL_STATUSES)[number];

export const DRAW_VERDICTS = [
  "APPROVE",
  "APPROVE_WITH_CONDITIONS",
  "HOLD",
  "REJECT",
] as const;
export type DrawVerdictValue = (typeof DRAW_VERDICTS)[number];

export const OBSERVED_STATES_REPORT = [
  "PRESENT",
  "ABSENT",
  "PARTIAL",
  "DEVIATED",
  "UNKNOWN",
] as const;

const perElementSchema = new Schema(
  {
    discipline: { type: String, enum: DISCIPLINES, required: true },
    elementId: { type: String, required: true },
    plannedState: { type: String, required: true },
    observedState: { type: String, required: true },
    status: { type: String, enum: PER_ELEMENT_STATUSES, required: true },
    citations: [{ type: Schema.Types.ObjectId, ref: "Document" }],
  },
  { _id: false },
);

const sovLineFindingSchema = new Schema(
  {
    sovLineNumber: { type: String, required: true },
    claimedPct: { type: Number, required: true },
    observedPct: { type: Number, required: true },
    variance: { type: Number, required: true },
    flag: { type: String, enum: SOV_FLAGS, required: true },
    evidencePhotoIds: [{ type: Schema.Types.ObjectId, ref: "Document" }],
  },
  { _id: false },
);

const drawVerdictSchema = new Schema(
  {
    verdict: { type: String, enum: DRAW_VERDICTS, required: true },
    reasoning: { type: String, required: true },
    conditions: [{ type: String }],
    missingRequirements: [{ type: String }],
  },
  { _id: false },
);

const gapReportSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    milestoneId: { type: Schema.Types.ObjectId },
    drawId: { type: Schema.Types.ObjectId, ref: "Draw", index: true },
    asOf: { type: Date, required: true },
    perElement: { type: [perElementSchema], default: [] },
    sovLineFindings: { type: [sovLineFindingSchema], default: [] },
    overallStatus: { type: String, enum: OVERALL_STATUSES, required: true },
    daysOffset: { type: Number },
    loanInBalance: { type: Boolean, required: true },
    remainingBudget: { type: Number },
    remainingCost: { type: Number },
    unapprovedDeviations: [{ type: String }],
    narrative: { type: String, required: true },
    drawVerdict: { type: drawVerdictSchema },
    generatedAt: { type: Date, default: () => new Date(), required: true },
    modelVersion: { type: String, required: true },
  },
  { timestamps: true },
);

gapReportSchema.index({ projectId: 1, generatedAt: -1 });

export type GapReportDoc = InferSchemaType<typeof gapReportSchema> & {
  _id: Types.ObjectId;
};

export const GapReport = model("GapReport", gapReportSchema);
