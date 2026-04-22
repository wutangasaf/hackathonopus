import type { Types } from "mongoose";
import { AgentRun, type AgentRunDoc } from "../models/agentRun.js";
import type { UsageMeta } from "../lib/claudeCall.js";

export type AgentRunContext = {
  run: AgentRunDoc;
  recordUsage: (usage: UsageMeta) => void;
};

export async function withAgentRun<T>(
  params: {
    projectId: Types.ObjectId | string;
    agentName: string;
    input?: unknown;
    modelVersion?: string;
  },
  fn: (ctx: AgentRunContext) => Promise<T>,
): Promise<{ result: T; run: AgentRunDoc }> {
  const run = (await AgentRun.create({
    projectId: params.projectId,
    agentName: params.agentName,
    status: "running",
    input: params.input,
    modelVersion: params.modelVersion,
    startedAt: new Date(),
  })) as unknown as AgentRunDoc;

  let accumulated: UsageMeta | undefined;
  const ctx: AgentRunContext = {
    run,
    recordUsage(usage: UsageMeta) {
      if (!accumulated) {
        accumulated = { ...usage };
        return;
      }
      accumulated = {
        inputTokens: accumulated.inputTokens + usage.inputTokens,
        outputTokens: accumulated.outputTokens + usage.outputTokens,
        cacheReadTokens: accumulated.cacheReadTokens + usage.cacheReadTokens,
        cacheCreationTokens:
          accumulated.cacheCreationTokens + usage.cacheCreationTokens,
        model: usage.model,
      };
    },
  };

  try {
    const result = await fn(ctx);
    await AgentRun.updateOne(
      { _id: run._id },
      {
        $set: {
          status: "succeeded",
          result,
          usage: accumulated,
          completedAt: new Date(),
        },
      },
    );
    return { result, run };
  } catch (err) {
    await AgentRun.updateOne(
      { _id: run._id },
      {
        $set: {
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
          usage: accumulated,
          completedAt: new Date(),
        },
      },
    );
    throw err;
  }
}

export function recordUsage(ctx: AgentRunContext, usage: UsageMeta): void {
  ctx.recordUsage(usage);
}
