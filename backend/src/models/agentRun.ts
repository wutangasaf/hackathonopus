import { Schema, model, type InferSchemaType, type Types } from "mongoose";

const usageSchema = new Schema(
  {
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    cacheReadTokens: { type: Number, default: 0 },
    cacheCreationTokens: { type: Number, default: 0 },
    model: { type: String, required: true },
  },
  { _id: false },
);

const agentRunSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    agentName: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["running", "succeeded", "failed"],
      default: "running",
      required: true,
    },
    input: { type: Schema.Types.Mixed },
    result: { type: Schema.Types.Mixed },
    error: { type: String },
    usage: { type: usageSchema, default: undefined },
    modelVersion: { type: String },
    startedAt: { type: Date, default: () => new Date(), required: true },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

export type AgentRunDoc = InferSchemaType<typeof agentRunSchema> & {
  _id: Types.ObjectId;
};

export const AgentRun = model("AgentRun", agentRunSchema);
