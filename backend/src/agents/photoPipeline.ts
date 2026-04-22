import type { FastifyBaseLogger } from "fastify";
import type { Types } from "mongoose";
import { runPhotoQuality } from "./photoQuality.js";
import { runPhotoToPlanFormat } from "./photoToPlanFormat.js";

export function kickoffPhotoPipeline(
  photoDocumentId: Types.ObjectId | string,
  logger: FastifyBaseLogger,
): void {
  const startedAt = Date.now();
  logger.info(
    { photoDocumentId: String(photoDocumentId) },
    "photo pipeline kicked off",
  );
  void (async () => {
    const quality = await runPhotoQuality(photoDocumentId);
    if (quality.result.quality === "GOOD" && quality.result.discipline) {
      await runPhotoToPlanFormat(
        photoDocumentId,
        quality.result.discipline,
      );
    }
  })()
    .then(() => {
      logger.info(
        {
          photoDocumentId: String(photoDocumentId),
          durationMs: Date.now() - startedAt,
        },
        "photo pipeline finished",
      );
    })
    .catch((err: unknown) => {
      logger.error(
        {
          photoDocumentId: String(photoDocumentId),
          err: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        },
        "photo pipeline failed",
      );
    });
}
