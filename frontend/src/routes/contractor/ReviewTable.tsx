import { cn } from "@/lib/utils";
import type { DrawLine, Milestone } from "@/lib/types";

import { REVIEW_GRID_COLS, ReviewRow } from "./ReviewRow";

const HEADERS: Array<{ label: string; align?: "right" | "left" }> = [
  { label: "#" },
  { label: "Description" },
  { label: "CSI" },
  { label: "Scheduled", align: "right" },
  { label: "% this period", align: "right" },
  { label: "Amount", align: "right" },
  { label: "AI suggested" },
  { label: "Confidence" },
  { label: "Your choice" },
  { label: "Action", align: "right" },
];

export function ReviewTable({
  lines,
  milestones,
  pendingLineIndex,
  onConfirm,
  onOverride,
}: {
  lines: DrawLine[];
  milestones: Milestone[];
  pendingLineIndex: number | null;
  onConfirm: (lineIndex: number) => void;
  onOverride: (lineIndex: number, confirmedMilestoneId: string) => void;
}) {
  const sortedMilestones = [...milestones].sort(
    (a, b) => a.sequence - b.sequence,
  );

  return (
    <div className="overflow-x-auto border border-line">
      <div className="min-w-[1260px]">
        <div
          className={cn(
            "grid border-b border-line-strong bg-bg-1",
            REVIEW_GRID_COLS,
          )}
        >
          {HEADERS.map((h, i) => (
            <div
              key={i}
              className={cn(
                "px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted",
                h.align === "right" && "text-right",
              )}
            >
              {h.label}
            </div>
          ))}
        </div>
        {lines.map((line, i) => (
          <ReviewRow
            key={`${line.lineNumber}-${i}`}
            index={i}
            line={line}
            milestones={sortedMilestones}
            isPending={pendingLineIndex === i}
            onConfirm={onConfirm}
            onOverride={onOverride}
          />
        ))}
        {lines.length === 0 && (
          <div className="px-4 py-6 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-fg-muted">
            No lines extracted
          </div>
        )}
      </div>
    </div>
  );
}
