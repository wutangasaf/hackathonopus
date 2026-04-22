import { Schema, model, type InferSchemaType, type Types } from "mongoose";

export const PROJECT_STATUSES = ["SETUP", "ACTIVE", "COMPLETED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

const projectSchema = new Schema(
  {
    name: { type: String, required: true },
    address: { type: String },
    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: "SETUP",
      required: true,
    },
    currentMilestoneId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
);

export type ProjectDoc = InferSchemaType<typeof projectSchema> & {
  _id: Types.ObjectId;
};

export const Project = model("Project", projectSchema);
