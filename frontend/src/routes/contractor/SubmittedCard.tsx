import { useNavigate } from "react-router-dom";

import type { Draw } from "@/lib/types";
import { useCreateReport } from "@/services/reports";

export function SubmittedCard({
  draw,
  projectId,
  onStartNewDraw,
}: {
  draw: Draw;
  projectId: string;
  onStartNewDraw?: () => void;
}) {
  const navigate = useNavigate();
  const amount = draw.totalAmountRequested ?? 0;
  const submittedAt = draw.approvedAt ?? draw.updatedAt;

  const createReport = useCreateReport(projectId, {
    onSuccess: (rep) => navigate(`/projects/${projectId}/reports/${rep._id}`),
  });

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 border border-line-strong bg-bg-1 px-10 py-14 text-center">
      <span className="inline-flex items-center gap-2 border border-success/40 bg-bg-2 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-success">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        Draw submitted
      </span>
      <div>
        <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-fg-muted">
          Draw #{draw.drawNumber}
        </div>
        <div className="mt-3 font-mono text-[44px] font-semibold tabular-nums tracking-tight text-fg">
          {formatUsd(amount)}
        </div>
        <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-dim">
          requested this period
        </div>
      </div>
      <div className="h-px w-16 bg-line-strong" />
      <div className="flex flex-col items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted">
        <span>Submitted {formatDateTime(submittedAt)}</span>
        <span className="text-fg-dim">Awaiting inspection</span>
      </div>

      <div className="flex w-full flex-col items-center gap-2.5">
        <button
          type="button"
          disabled={createReport.isPending}
          onClick={() => createReport.mutate({ drawId: draw._id })}
          className="inline-flex items-center gap-2 bg-accent px-6 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-colors hover:bg-[#67e8f9] disabled:cursor-not-allowed disabled:bg-accent/60"
        >
          {createReport.isPending
            ? "CRMC drafting verdict…"
            : "Generate verification report ↗"}
        </button>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted">
          Per-line claim vs photos · 30–60s
        </span>
        {createReport.isError && (
          <div className="mt-1 w-full border-l-2 border-danger bg-bg-2 p-3 text-left">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-danger">
              Error · {createReport.error?.status ?? "unknown"}
            </div>
            <p className="mt-1 font-mono text-[11px] text-fg-dim">
              {createReport.error?.body?.slice(0, 200) ??
                "Report generation failed"}
            </p>
          </div>
        )}
      </div>

      {onStartNewDraw && (
        <button
          type="button"
          onClick={onStartNewDraw}
          className="mt-2 inline-flex items-center gap-2 border border-line-strong px-6 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fg transition-colors hover:bg-bg-2"
        >
          Start draw #{draw.drawNumber + 1} ↗
        </button>
      )}
    </div>
  );
}

function formatUsd(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
