import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { differenceInDays, format } from "date-fns";

import type { ClassifiedSheet } from "@/lib/types";
import { useGanttStore, type FieldErrorMap } from "@/stores/ganttStore";

import { MilestoneRow } from "@/routes/gantt/MilestoneRow";

export function Timeline({
  sheetLookup,
  fieldErrors,
}: {
  sheetLookup: Map<string, ClassifiedSheet>;
  fieldErrors: FieldErrorMap;
}) {
  const kickoffDate = useGanttStore((s) => s.kickoffDate);
  const requiredCompletionDate = useGanttStore(
    (s) => s.requiredCompletionDate,
  );
  const milestones = useGanttStore((s) => s.milestones);
  const selectedLocalId = useGanttStore((s) => s.selectedLocalId);
  const select = useGanttStore((s) => s.select);
  const addMilestone = useGanttStore((s) => s.addMilestone);

  const kickoff = new Date(kickoffDate);
  const completion = new Date(requiredCompletionDate);
  const totalDays = Math.max(1, differenceInDays(completion, kickoff));

  const ticks = Array.from({ length: 5 }).map((_, i) => {
    const t = kickoff.getTime() + (totalDays * 86_400_000 * i) / 4;
    return new Date(t);
  });

  const sortableIds = milestones.map((m) => `sortable:${m.localId}`);

  return (
    <div className="border border-line bg-bg">
      <div className="grid grid-cols-[220px_1fr] border-b border-line-strong bg-bg-1">
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

      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        {milestones.map((m) => (
          <MilestoneRow
            key={m.localId}
            localId={m.localId}
            kickoff={kickoff}
            totalDays={totalDays}
            selected={m.localId === selectedLocalId}
            onSelect={() => select(m.localId)}
            sheetLookup={sheetLookup}
            fieldErrors={fieldErrors[m.localId]}
          />
        ))}
      </SortableContext>

      <button
        type="button"
        onClick={() => addMilestone()}
        className="block w-full border-t border-dashed border-line-strong bg-bg-1/40 px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.14em] text-fg-dim transition-colors hover:bg-bg-1 hover:text-accent"
      >
        + Add milestone
      </button>
    </div>
  );
}
