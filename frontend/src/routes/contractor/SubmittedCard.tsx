import type { Draw } from "@/lib/types";

export function SubmittedCard({
  draw,
  onStartNewDraw,
}: {
  draw: Draw;
  onStartNewDraw?: () => void;
}) {
  const amount = draw.totalAmountRequested ?? 0;
  const submittedAt = draw.approvedAt ?? draw.updatedAt;

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
      {onStartNewDraw && (
        <button
          type="button"
          onClick={onStartNewDraw}
          className="mt-2 inline-flex items-center gap-2 bg-accent px-6 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-colors hover:bg-[#ff8940]"
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
