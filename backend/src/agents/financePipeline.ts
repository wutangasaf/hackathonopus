import type { FastifyBaseLogger } from "fastify";
import type { Types } from "mongoose";
import { runFinancePlanIngester } from "./financePlanIngester.js";

export function kickoffFinancePlanPipeline(
  projectId: Types.ObjectId | string,
  logger: FastifyBaseLogger,
): void {
  const startedAt = Date.now();
  logger.info({ projectId: String(projectId) }, "finance pipeline kicked off");
  void runFinancePlanIngester(projectId)
    .then(() => {
      logger.info(
        {
          projectId: String(projectId),
          durationMs: Date.now() - startedAt,
        },
        "finance pipeline finished",
      );
    })
    .catch((err: unknown) => {
      logger.error(
        {
          projectId: String(projectId),
          err: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        },
        "finance pipeline failed",
      );
    });
}
