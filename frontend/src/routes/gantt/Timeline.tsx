import { differenceInDays, format } from "date-fns";

import type { ClassifiedSheet } from "@/lib/types";
import { useGanttStore } from "@/stores/ganttStore";

import { MilestoneRow } from "@/routes/gantt/MilestoneRow";

export function Timeline({
  sheetLookup,
}: {
  sheetLookup: Map<string, ClassifiedSheet>;
}) {
  const kickoffDate = useGanttStore((s) => s.kickoffDate);
  const requiredCompletionDate = useGanttStore(
    (s) => s.requiredCompletionDate,
  );
  const milestones = useGanttStore((s) => s.milestones);
  const selectedLocalId = useGanttStore((s) => s.selectedLocalId);
  const select = useGanttStore((s) => s.select);

  const kickoff = new Date(kickoffDate);
  const completion = new Date(requiredCompletionDate);
  const totalDays = Math.max(1, differenceInDays(completion, kickoff));

  const ticks = Array.from({ length: 5 }).map((_, i) => {
    const t = kickoff.getTime() + (totalDays * 86_400_000 * i) / 4;
    return new Date(t);
  });

  return (
    <div className="border border-line bg-bg">
      <div className="grid grid-cols-[200px_1fr] border-b border-line-strong bg-bg-1">
        <div className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted">
          Milestone
        </div>
        <div className="relative h-10">
          {ticks.map((t, i) => (
            <span
              key={i}
              className="absolute top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-muted"
              style={{ left: `${(i / 4) * 100}%` }}
            >
              {format(t, "MMM d")}
            </span>
          ))}
        </div>
      </div>

      {milestones.map((m) => (
        <MilestoneRow
          key={m.localId}
          localId={m.localId}
          kickoff={kickoff}
          totalDays={totalDays}
          selected={m.localId === selectedLocalId}
          onSelect={() => select(m.localId)}
          sheetLookup={sheetLookup}
        />
      ))}
    </div>
  );
}
