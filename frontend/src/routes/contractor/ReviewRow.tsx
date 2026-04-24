import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import type { DrawLine, Milestone } from "@/lib/types";

import { LOW_CONFIDENCE_THRESHOLD } from "./useDrawReview";

export const REVIEW_GRID_COLS =
  "grid-cols-[32px_minmax(220px,1.4fr)_64px_110px_80px_110px_minmax(180px,1.2fr)_96px_minmax(180px,1.1fr)_220px]";

export function ReviewRow({
  index,
  line,
  milestones,
  isPending,
  onConfirm,
  onOverride,
}: {
  index: number;
  line: DrawLine;
  milestones: Milestone[];
  isPending: boolean;
  onConfirm: (lineIndex: number) => void;
  onOverride: (lineIndex: number, confirmedMilestoneId: string) => void;
}) {
  const initialChoice =
    line.confirmedMilestoneId ?? line.aiSuggestedMilestoneId ?? "";
  const [choice, setChoice] = useState<string>(initialChoice);

  useEffect(() => {
    setChoice(line.confirmedMilestoneId ?? line.aiSuggestedMilestoneId ?? "");
  }, [line.confirmedMilestoneId, line.aiSuggestedMilestoneId]);

  const isConfirmed = line.approvalStatus !== "pending";
  const confidence = line.aiConfidence;
  const isLowConfidence =
    typeof confidence === "number" && confidence < LOW_CONFIDENCE_THRESHOLD;

  const confidenceBandClass =
    confidence == null
      ? "bg-fg-muted"
      : confidence >= LOW_CONFIDENCE_THRESHOLD
        ? "bg-accent"
        : confidence >= 0.6
          ? "bg-warn"
          : "bg-danger";

  const aiMilestone = milestones.find(
    (m) => m._id === line.aiSuggestedMilestoneId,
  );
  const aiMilestoneLabel = aiMilestone
    ? `${aiMilestone.sequence}. ${aiMilestone.name}`
    : "—";

  const aiMilestoneId = line.aiSuggestedMilestoneId ?? "";
  const canOverride = Boolean(choice) && choice !== aiMilestoneId;

  function handleConfirm() {
    if (isPending || isConfirmed) return;
    onConfirm(index);
  }

  function handleOverride() {
    if (isPending || isConfirmed || !canOverride) return;
    onOverride(index, choice);
  }

  return (
    <div
      className={cn(
        "grid border-b border-line items-center",
        REVIEW_GRID_COLS,
        isLowConfidence && "border-l-2 border-l-warn",
        isConfirmed && "opacity-60",
      )}
    >
      <div className="px-4 py-3 font-mono text-[11px] tabular-nums text-fg-dim">
        {line.lineNumber}
      </div>
      <div className="px-4 py-3 text-[13px] leading-[1.45] text-fg">
        {line.description}
      </div>
      <div className="px-4 py-3 font-mono text-[11px] tabular-nums text-fg-dim">
        {line.csiCode ?? "—"}
      </div>
      <div className="px-4 py-3 text-right font-mono text-[12px] tabular-nums text-fg">
        {formatUsd(line.scheduledValue)}
      </div>
      <div className="px-4 py-3 text-right font-mono text-[12px] tabular-nums text-fg">
        {formatPct(line.pctThisPeriod)}
      </div>
      <div className="px-4 py-3 text-right font-mono text-[12px] tabular-nums text-fg">
        {formatUsd(line.amountThisPeriod)}
      </div>
      <div className="px-4 py-3">
        <span
          className="inline-flex max-w-full truncate border border-line-strong px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg"
          title={line.aiReasoning ?? undefined}
        >
          {aiMilestoneLabel}
        </span>
      </div>
      <div className="flex flex-col gap-1 px-4 py-3">
        {confidence == null ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted">
            —
          </span>
        ) : (
          <>
            <div className="h-px bg-bg-3">
              <div
                className={cn("h-full", confidenceBandClass)}
                style={{ width: `${Math.round(confidence * 100)}%` }}
              />
            </div>
            <span
              className={cn(
                "font-mono text-[10px] tabular-nums tracking-[0.08em]",
                isLowConfidence ? "text-warn" : "text-fg-dim",
              )}
            >
              {confidence.toFixed(2)}
              {isLowConfidence ? " · LOW" : ""}
            </span>
          </>
        )}
      </div>
      <div className="px-4 py-3">
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          disabled={isPending || isConfirmed}
          className="w-full rounded-none border border-line-strong bg-bg-1 px-2 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-fg focus:border-fg-muted focus:outline-none disabled:opacity-60"
        >
          {milestones.length === 0 && <option value="">—</option>}
          {milestones.map((m) => (
            <option key={m._id} value={m._id}>
              {m.sequence}. {m.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-end gap-2 px-4 py-3">
        {isConfirmed ? (
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-success">
            ✓{" "}
            {line.approvalStatus === "overridden" ? "OVERRIDDEN" : "CONFIRMED"}
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              title={
                isLowConfidence
                  ? "Low confidence · look twice before confirming"
                  : "Confirm the AI suggestion"
              }
              className={cn(
                "inline-flex items-center px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                isLowConfidence
                  ? "bg-warn text-black hover:bg-[#ffc94d]"
                  : "border border-line-strong text-fg hover:border-fg-muted hover:bg-bg-2",
              )}
            >
              {isPending ? "…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={handleOverride}
              disabled={isPending || !canOverride}
              title={
                canOverride
                  ? "Send with your chosen milestone instead"
                  : "Change the dropdown to enable override"
              }
              className="inline-flex items-center border border-fg-muted px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-fg transition-colors hover:bg-bg-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Override
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function formatUsd(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function formatPct(n: number): string {
  return `${Math.round(n)}%`;
}
