import { Schema, model, type InferSchemaType, type Types } from "mongoose";

const managedAgentsConfigSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    agentId: { type: String },
    agentVersion: { type: Number },
    environmentId: { type: String },
    model: { type: String },
    systemHash: { type: String },
  },
  { timestamps: true },
);

export type ManagedAgentsConfigDoc = InferSchemaType<
  typeof managedAgentsConfigSchema
> & { _id: Types.ObjectId };

export const ManagedAgentsConfig = model(
  "ManagedAgentsConfig",
  managedAgentsConfigSchema,
);
