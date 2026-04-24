import { Link } from "react-router-dom";

import type { DrawReviewCounters } from "./useDrawReview";

export function DrawActionBar({
  projectId,
  counters,
  approving,
  onApprove,
  errorText,
}: {
  projectId: string;
  counters: DrawReviewCounters;
  approving: boolean;
  onApprove: () => void;
  errorText?: string | null;
}) {
  const { total, confirmedCount, lowConfidencePending, canApprove } = counters;

  return (
    <div className="sticky bottom-0 z-10 border-t border-line-strong bg-bg/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-4 px-8 py-4">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-dim">
          <span className="text-fg">
            CONFIRMED {confirmedCount} / {total}
          </span>
          {lowConfidencePending > 0 && (
            <>
              {" · "}
              <span className="text-warn">
                LOW CONFIDENCE {lowConfidencePending} PENDING
              </span>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={`/projects/${projectId}`}
            className="inline-flex items-center border border-line-strong px-5 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-dim transition-colors hover:border-fg-muted hover:bg-bg-2 hover:text-fg"
            title="Progress is saved. Come back to finish."
          >
            Save draft
          </Link>
          <button
            type="button"
            onClick={onApprove}
            disabled={!canApprove || approving}
            aria-disabled={!canApprove || approving}
            className="inline-flex items-center gap-2 bg-accent px-6 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-colors hover:bg-[#ff8940] disabled:cursor-not-allowed disabled:bg-accent/40"
          >
            {approving ? "Submitting…" : "Approve all ↗"}
          </button>
        </div>
      </div>
      {errorText && (
        <div className="border-t border-danger/40 bg-bg-1">
          <div className="mx-auto w-full max-w-[1280px] px-8 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-danger">
            ERROR · {errorText}
          </div>
        </div>
      )}
    </div>
  );
}
