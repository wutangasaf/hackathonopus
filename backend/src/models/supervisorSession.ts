import { Schema, model, type InferSchemaType, type Types } from "mongoose";

export const SUPERVISOR_SESSION_STATUSES = [
  "running",
  "idle",
  "terminated",
  "failed",
] as const;
export type SupervisorSessionStatus =
  (typeof SUPERVISOR_SESSION_STATUSES)[number];

const supervisorSessionSchema = new Schema(
  {
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
    managedSessionId: { type: String, required: true, index: true },
    agentId: { type: String, required: true },
    environmentId: { type: String, required: true },
    title: { type: String, required: true },
    status: {
      type: String,
      enum: SUPERVISOR_SESSION_STATUSES,
      default: "running",
      required: true,
    },
    error: { type: String },
    startedAt: { type: Date, default: () => new Date(), required: true },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

export type SupervisorSessionDoc = InferSchemaType<
  typeof supervisorSessionSchema
> & { _id: Types.ObjectId };

export const SupervisorSession = model(
  "SupervisorSession",
  supervisorSessionSchema,
);
