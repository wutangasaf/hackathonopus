import { useMemo } from "react";

import type { Draw } from "@/lib/types";

export const LOW_CONFIDENCE_THRESHOLD = 0.85;

export type DrawReviewCounters = {
  total: number;
  confirmedCount: number;
  pendingCount: number;
  lowConfidencePending: number;
  canApprove: boolean;
};

/**
 * Derives counters for the action bar from the live draw. Kept pure
 * so it re-runs whenever React Query updates the cached Draw.
 */
export function useDrawReview(draw: Draw | undefined): DrawReviewCounters {
  return useMemo(() => {
    if (!draw) {
      return {
        total: 0,
        confirmedCount: 0,
        pendingCount: 0,
        lowConfidencePending: 0,
        canApprove: false,
      };
    }
    let confirmedCount = 0;
    let pendingCount = 0;
    let lowConfidencePending = 0;
    for (const line of draw.lines) {
      if (line.approvalStatus === "pending") {
        pendingCount += 1;
        if (
          typeof line.aiConfidence === "number" &&
          line.aiConfidence < LOW_CONFIDENCE_THRESHOLD
        ) {
          lowConfidencePending += 1;
        }
      } else {
        confirmedCount += 1;
      }
    }
    return {
      total: draw.lines.length,
      confirmedCount,
      pendingCount,
      lowConfidencePending,
      canApprove:
        draw.status === "ready_for_review" &&
        draw.lines.length > 0 &&
        pendingCount === 0,
    };
  }, [draw]);
}
