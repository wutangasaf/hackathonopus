import { relativeTime } from "@/lib/time";
import type { Draw, Milestone } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ContextSidebar({
  milestone,
  milestoneLoading,
  draws,
  drawsLoading,
  activeDrawId,
  canStartNewDraw,
  onStartNewDraw,
}: {
  milestone: Milestone | null | undefined;
  milestoneLoading: boolean;
  draws: Draw[] | undefined;
  drawsLoading: boolean;
  activeDrawId?: string;
  canStartNewDraw: boolean;
  onStartNewDraw: () => void;
}) {
  return (
    <aside className="flex flex-col gap-8 lg:sticky lg:top-8 lg:self-start">
      {canStartNewDraw && (
        <button
          type="button"
          onClick={onStartNewDraw}
          className="inline-flex items-center justify-center gap-2 border border-accent bg-bg px-5 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent transition-colors hover:bg-accent hover:text-black"
        >
          Start a new draw ↗
        </button>
      )}

      <section>
        <SidebarLabel>Active milestone</SidebarLabel>
        {milestoneLoading ? (
          <SidebarSkeleton lines={3} />
        ) : milestone ? (
          <MilestoneCard milestone={milestone} />
        ) : (
          <EmptyBlock>
            No active milestone · publish a finance plan first
          </EmptyBlock>
        )}
      </section>

      <section>
        <SidebarLabel>
          Draw history{draws ? ` · ${draws.length}` : ""}
        </SidebarLabel>
        {drawsLoading ? (
          <SidebarSkeleton lines={3} />
        ) : !draws || draws.length === 0 ? (
          <EmptyBlock>No draws submitted yet</EmptyBlock>
        ) : (
          <DrawHistoryList draws={draws} activeDrawId={activeDrawId} />
        )}
      </section>
    </aside>
  );
}

function MilestoneCard({ milestone }: { milestone: Milestone }) {
  const tranche = Math.round(milestone.trancheAmount).toLocaleString();
  return (
    <div className="border border-line bg-bg-1 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted">
        Milestone {milestone.sequence.toString().padStart(2, "0")}
      </div>
      <div className="mt-1.5 text-[14px] font-semibold leading-[1.3] text-fg">
        {milestone.name}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">
        <span>Start</span>
        <span className="text-fg">
          {milestone.plannedStartDate.slice(0, 10)}
        </span>
        <span>Complete</span>
        <span className="text-fg">
          {milestone.plannedCompletionDate.slice(0, 10)}
        </span>
        <span>Tranche</span>
        <span className="tabular-nums text-fg">${tranche}</span>
        <span>Release</span>
        <span className="tabular-nums text-fg">
          {milestone.plannedReleasePct}%
        </span>
      </div>
    </div>
  );
}

function DrawHistoryList({
  draws,
  activeDrawId,
}: {
  draws: Draw[];
  activeDrawId?: string;
}) {
  return (
    <ul className="border border-line bg-bg-1">
      {draws.map((d) => {
        const active = d._id === activeDrawId;
        const amount = d.totalAmountRequested
          ? `$${Math.round(d.totalAmountRequested).toLocaleString()}`
          : "—";
        const when = d.approvedAt ?? d.updatedAt ?? d.createdAt;
        return (
          <li
            key={d._id}
            className={cn(
              "flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0",
              active && "bg-bg-2",
            )}
          >
            <div className="min-w-0">
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg">
                Draw #{d.drawNumber}
                {active && (
                  <span className="ml-2 text-accent">· current</span>
                )}
              </div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">
                {when ? relativeTime(when) : "—"}
              </div>
            </div>
            <div className="text-right">
              <DrawStatusChip status={d.status} />
              <div className="mt-0.5 font-mono text-[10px] tabular-nums text-fg-dim">
                {amount}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function DrawStatusChip({ status }: { status: Draw["status"] }) {
  const label = DRAW_STATUS_LABEL[status] ?? status;
  const cls =
    status === "approved"
      ? "text-success border-success/40"
      : status === "failed" || status === "rejected"
        ? "text-danger border-danger/40"
        : status === "parsing"
          ? "text-accent border-accent/40"
          : "text-fg border-line-strong";
  return (
    <span
      className={cn(
        "inline-flex items-center border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
        cls,
      )}
    >
      {label}
    </span>
  );
}

const DRAW_STATUS_LABEL: Record<Draw["status"], string> = {
  parsing: "Parsing",
  ready_for_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
  failed: "Failed",
};

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
      {children}
    </div>
  );
}

function EmptyBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-line-strong bg-bg-1 px-4 py-4 font-mono text-[11px] uppercase tracking-[0.12em] text-fg-dim">
      {children}
    </div>
  );
}

function SidebarSkeleton({ lines }: { lines: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse bg-bg-1" aria-hidden />
      ))}
    </div>
  );
}
