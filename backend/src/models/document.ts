import { Schema, model, type InferSchemaType, type Types } from "mongoose";

export const DOCUMENT_KINDS = [
  "PLAN",
  "FINANCE_PLAN",
  "SCHEDULE",
  "PHOTO",
  "DRAW_G703",
  "DRAW_G702",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

const documentSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    kind: { type: String, enum: DOCUMENT_KINDS, required: true },
    originalFilename: { type: String, required: true },
    storagePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    sha256: { type: String, required: true },
    serverReceivedAt: {
      type: Date,
      default: () => new Date(),
      required: true,
    },
    exifMeta: { type: Schema.Types.Mixed },
    uploaderRef: { type: String },
  },
  { timestamps: true },
);

documentSchema.index({ projectId: 1, sha256: 1 }, { unique: true });

export type DocumentDoc = InferSchemaType<typeof documentSchema> & {
  _id: Types.ObjectId;
};

export const DocumentModel = model("Document", documentSchema);
