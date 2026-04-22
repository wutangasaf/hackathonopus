import { Schema, model, type InferSchemaType, type Types } from "mongoose";
import { DISCIPLINES } from "./planClassification.js";

export const LOAN_TYPES = [
  "residential",
  "commercial_poc",
  "hud_221d4",
  "hybrid",
] as const;
export type LoanType = (typeof LOAN_TYPES)[number];

export const MILESTONE_STATUSES = [
  "pending",
  "in_progress",
  "claimed",
  "verified",
  "rejected",
] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

const cellMappingSchema = new Schema(
  {
    discipline: { type: String, enum: DISCIPLINES, required: true },
    elementKindOrId: { type: String, required: true },
    weight: { type: Number, required: true },
  },
  { _id: false },
);

const sovLineSchema = new Schema(
  {
    lineNumber: { type: String, required: true },
    description: { type: String, required: true },
    csiCode: { type: String },
    scheduledValue: { type: Number, required: true },
    disciplineHint: { type: String, enum: DISCIPLINES },
    zoneHint: { type: String },
    cellMappings: { type: [cellMappingSchema], default: [] },
  },
  { _id: false },
);

const requiredCompletionSchema = new Schema(
  {
    discipline: { type: String, enum: DISCIPLINES, required: true },
    elementKindOrId: { type: String, required: true },
    minPct: { type: Number, required: true },
  },
  { _id: false },
);

const milestoneSchema = new Schema(
  {
    sequence: { type: Number, required: true },
    name: { type: String, required: true },
    plannedCompletionDate: { type: Date, required: true },
    plannedPercentOfLoan: { type: Number, required: true },
    amountReleased: { type: Number, default: 0 },
    requiredCompletion: { type: [requiredCompletionSchema], default: [] },
    requiredDocs: [{ type: String }],
    status: {
      type: String,
      enum: MILESTONE_STATUSES,
      default: "pending",
      required: true,
    },
  },
  { _id: true },
);

const financePlanSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    loanType: { type: String, enum: LOAN_TYPES, required: true },
    loanAmount: { type: Number, required: true },
    totalBudget: { type: Number, required: true },
    currency: { type: String, enum: ["USD"], default: "USD", required: true },
    retainagePct: { type: Number, default: 10 },
    retainageStepDownAt: { type: Number, default: 50 },
    retainageStepDownTo: { type: Number, default: 5 },
    coThresholdSingle: { type: Number, default: 50000 },
    coThresholdCumulativePct: { type: Number, default: 5 },
    materialDelayDays: { type: Number, default: 60 },
    cureDaysMonetary: { type: Number, default: 10 },
    cureDaysNonMonetary: { type: Number, default: 30 },
    requiredCompletionDate: { type: Date, required: true },
    sov: { type: [sovLineSchema], default: [] },
    milestones: { type: [milestoneSchema], default: [] },
    modelVersion: { type: String, required: true },
    uploadedAt: { type: Date, default: () => new Date(), required: true },
  },
  { timestamps: true },
);

export type FinancePlanDoc = InferSchemaType<typeof financePlanSchema> & {
  _id: Types.ObjectId;
};

export const FinancePlan = model("FinancePlan", financePlanSchema);
