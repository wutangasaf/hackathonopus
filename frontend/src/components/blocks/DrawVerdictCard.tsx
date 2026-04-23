import { cn } from "@/lib/utils";

type Variant = "ok" | "warn" | "dev";

const FILL: Record<Variant, string> = {
  ok: "bg-success",
  warn: "bg-warn",
  dev: "bg-danger",
};

function ProgressRow({
  label,
  pct,
  variant = "ok",
}: {
  label: string;
  pct: number;
  variant?: Variant;
}) {
  return (
    <div
      className="grid items-center gap-3"
      style={{ gridTemplateColumns: "90px 1fr 32px" }}
    >
      <span className="font-mono text-[10px] uppercase tracking-mono text-fg-muted">
        {label}
      </span>
      <span className="relative block h-1.5 overflow-hidden bg-bg-3">
        <i
          className={cn("absolute inset-y-0 left-0", FILL[variant])}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-right font-mono text-[10px] text-fg-dim">
        {pct}%
      </span>
    </div>
  );
}

export function DrawVerdictCard() {
  return (
    <div className="relative" style={{ padding: "12px 0" }} aria-hidden>
      {/* Stacked-paper depth */}
      <div
        className="absolute inset-x-3.5 top-[18px] bottom-2 border border-line bg-bg-1 opacity-70"
        style={{ transform: "rotate(-0.4deg)" }}
      />
      <div
        className="absolute inset-x-3.5 top-[24px] bottom-1 border border-line bg-bg-1 opacity-55"
        style={{ transform: "rotate(0.7deg)" }}
      />

      <div
        className="relative z-10 border border-line-strong p-5"
        style={{
          background:
            "linear-gradient(180deg, var(--bg-1) 0%, #0d0d0d 100%)",
          transform: "rotate(-0.3deg)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.04) inset, 0 30px 80px -30px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,107,26,0.06)",
        }}
      >
        <div className="absolute -left-px inset-y-0 w-0.5 bg-accent" />

        <div className="flex items-center justify-between border-b border-line pb-3.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-dim">
            Draw verdict · GR-0042
          </span>
          <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-success">
            <span
              className="h-[7px] w-[7px] rounded-full bg-success animate-pulse"
              style={{ boxShadow: "0 0 10px rgba(0,217,126,0.7)" }}
            />
            Live
          </span>
        </div>

        <div className="mt-3.5 text-[15px] font-semibold tracking-tight">
          Potwine Passive House
        </div>
        <div className="mt-1.5 font-mono text-[11px] tracking-wider text-fg-dim">
          Milestone 3 — Dry-in · 13 photos · plan v3
        </div>

        <div className="mt-4 text-[44px] font-extrabold tracking-[-0.035em] leading-none">
          $2,000,000
        </div>
        <div className="mt-2 inline-flex items-center gap-2 border border-success/30 bg-success/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-success">
          Approve with conditions
        </div>

        <div className="mt-5 flex flex-col gap-2.5 border-t border-line pt-4">
          <ProgressRow label="Architecture" pct={84} />
          <ProgressRow label="Structural" pct={99} />
          <ProgressRow label="Plumbing" pct={54} variant="warn" />
          <ProgressRow label="Electrical" pct={62} variant="dev" />
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-line pt-3.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">
          <span className="border border-line px-2 py-1 text-fg-dim">
            2 deviations flagged
          </span>
          <span>Generated 04:38</span>
        </div>
      </div>
    </div>
  );
}
