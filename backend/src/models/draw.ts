import { Schema, model, type InferSchemaType, type Types } from "mongoose";
import { DISCIPLINES } from "./planClassification.js";

export const DRAW_LINE_APPROVAL_STATUSES = [
  "pending",
  "confirmed",
  "overridden",
] as const;
export type DrawLineApprovalStatus =
  (typeof DRAW_LINE_APPROVAL_STATUSES)[number];

export const DRAW_STATUSES = [
  "parsing",
  "ready_for_review",
  "approved",
  "rejected",
  "failed",
] as const;
export type DrawStatus = (typeof DRAW_STATUSES)[number];

const contractorSnapshotSchema = new Schema(
  {
    name: { type: String, required: true },
    companyName: { type: String, required: true },
    licenseNumber: { type: String },
  },
  { _id: false },
);

const drawLineSchema = new Schema(
  {
    lineNumber: { type: String, required: true },
    description: { type: String, required: true },
    csiCode: { type: String },
    scheduledValue: { type: Number, required: true },
    pctThisPeriod: { type: Number, required: true },
    pctCumulative: { type: Number, required: true },
    amountThisPeriod: { type: Number, required: true },
    aiSuggestedMilestoneId: { type: String },
    aiSuggestedDiscipline: { type: String, enum: DISCIPLINES },
    aiConfidence: { type: Number },
    aiReasoning: { type: String },
    confirmedMilestoneId: { type: String },
    approvalStatus: {
      type: String,
      enum: DRAW_LINE_APPROVAL_STATUSES,
      default: "pending",
      required: true,
    },
  },
  { _id: false },
);

const drawSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    drawNumber: { type: Number, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    contractor: { type: contractorSnapshotSchema, required: true },
    g703DocumentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },
    g702DocumentId: { type: Schema.Types.ObjectId, ref: "Document" },
    status: {
      type: String,
      enum: DRAW_STATUSES,
      default: "parsing",
      required: true,
    },
    totalAmountRequested: { type: Number },
    lines: { type: [drawLineSchema], default: [] },
    extractorRunId: { type: Schema.Types.ObjectId, ref: "AgentRun" },
    extractorError: { type: String },
    approvedAt: { type: Date },
  },
  { timestamps: true },
);

drawSchema.index({ projectId: 1, drawNumber: 1 }, { unique: true });

export type DrawDoc = InferSchemaType<typeof drawSchema> & {
  _id: Types.ObjectId;
};

export const Draw = model("Draw", drawSchema);
