import { Schema, model, type InferSchemaType, type Types } from "mongoose";

export const DISCIPLINES = [
  "ARCHITECTURE",
  "STRUCTURAL",
  "ELECTRICAL",
  "PLUMBING",
] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export const SHEET_ROLES = [
  "PLAN_VIEW",
  "ELEVATION",
  "SECTION",
  "DETAIL",
  "SCHEDULE",
  "OTHER",
] as const;
export type SheetRole = (typeof SHEET_ROLES)[number];

const titleblockSchema = new Schema(
  {
    sheetLabel: { type: String },
    date: { type: String },
    scale: { type: String },
    architect: { type: String },
  },
  { _id: false },
);

const classifiedSheetSchema = new Schema(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },
    pageNumber: { type: Number, required: true },
    discipline: { type: String, enum: DISCIPLINES, required: true },
    sheetRole: { type: String, enum: SHEET_ROLES, required: true },
    titleblock: { type: titleblockSchema, default: () => ({}) },
    notes: { type: String },
  },
  { _id: false },
);

const planClassificationSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    version: { type: Number, default: 1, required: true },
    sheets: { type: [classifiedSheetSchema], default: [] },
    sourceDocumentIds: [{ type: Schema.Types.ObjectId, ref: "Document" }],
    extractedAt: { type: Date, default: () => new Date(), required: true },
    modelVersion: { type: String, required: true },
  },
  { timestamps: true },
);

export type PlanClassificationDoc = InferSchemaType<
  typeof planClassificationSchema
> & { _id: Types.ObjectId };

export const PlanClassification = model(
  "PlanClassification",
  planClassificationSchema,
);
