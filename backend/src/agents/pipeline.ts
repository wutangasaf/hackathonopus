import type { FastifyBaseLogger } from "fastify";
import type { Types } from "mongoose";
import { runPlanClassifier } from "./planClassifier.js";
import { runPlanFormatExtractor } from "./planFormatExtractor.js";

export async function runPlanPipeline(
  projectId: Types.ObjectId | string,
): Promise<void> {
  await runPlanClassifier(projectId);
  await runPlanFormatExtractor(projectId);
}

export function kickoffPlanPipeline(
  projectId: Types.ObjectId | string,
  logger: FastifyBaseLogger,
): void {
  const startedAt = Date.now();
  logger.info({ projectId: String(projectId) }, "plan pipeline kicked off");
  void runPlanPipeline(projectId)
    .then(() => {
      logger.info(
        {
          projectId: String(projectId),
          durationMs: Date.now() - startedAt,
        },
        "plan pipeline finished",
      );
    })
    .catch((err: unknown) => {
      logger.error(
        {
          projectId: String(projectId),
          err: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        },
        "plan pipeline failed",
      );
    });
}
