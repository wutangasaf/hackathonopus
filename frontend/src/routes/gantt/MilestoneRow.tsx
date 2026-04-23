import { useDroppable } from "@dnd-kit/core";
import { differenceInDays } from "date-fns";

import { SHEET_ROLE_LABEL, type ClassifiedSheet, type Discipline } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useGanttStore } from "@/stores/ganttStore";

import { DISCIPLINE_DOT } from "@/routes/gantt/DocChip";

export function MilestoneRow({
  localId,
  kickoff,
  totalDays,
  selected,
  onSelect,
  sheetLookup,
}: {
  localId: string;
  kickoff: Date;
  totalDays: number;
  selected: boolean;
  onSelect: () => void;
  sheetLookup: Map<string, ClassifiedSheet>;
}) {
  const milestone = useGanttStore((s) =>
    s.milestones.find((m) => m.localId === localId),
  );
  const removeDocRef = useGanttStore((s) => s.removeDocRef);

  const { setNodeRef, isOver } = useDroppable({ id: `milestone:${localId}` });

  if (!milestone) return null;

  const start = new Date(milestone.plannedStartDate);
  const end = new Date(milestone.plannedCompletionDate);
  const offsetPct = Math.max(
    0,
    (differenceInDays(start, kickoff) / totalDays) * 100,
  );
  const widthPct = Math.max(
    2,
    (differenceInDays(end, start) / totalDays) * 100,
  );

  return (
    <div
      ref={setNodeRef}
      onClick={onSelect}
      className={cn(
        "relative grid min-h-[72px] cursor-pointer grid-cols-[200px_1fr] gap-4 border-b border-line transition-colors",
        selected ? "bg-bg-1" : "hover:bg-bg-1",
        isOver && "bg-accent-dim",
      )}
    >
      {/* Label column */}
      <div className="flex flex-col justify-center px-4 py-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-muted">
          M {String(milestone.sequence).padStart(2, "0")}
        </div>
        <div className="mt-0.5 text-[14px] font-semibold tracking-tight text-fg">
          {milestone.name}
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">
          ${milestone.trancheAmount.toLocaleString()} ·{" "}
          {milestone.plannedPercentOfLoan}%
        </div>
      </div>

      {/* Timeline column */}
      <div className="relative px-2 py-3">
        <div aria-hidden className="absolute inset-x-2 top-1/2 h-px bg-bg-3" />
        <div
          className={cn(
            "absolute top-1/2 h-5 -translate-y-1/2 border",
            selected
              ? "border-accent bg-accent/20"
              : "border-line-strong bg-bg-2",
          )}
          style={{ left: `${offsetPct}%`, width: `${widthPct}%` }}
        >
          <div
            className="absolute inset-y-0 left-0 w-0.5 bg-accent"
            aria-hidden
          />
        </div>

        {/* Assigned doc chips */}
        {milestone.planDocRefs.length > 0 && (
          <div className="relative mt-9 flex flex-wrap gap-[6px]">
            {milestone.planDocRefs.map((ref) => {
              const sheet = ref.notes ? sheetLookup.get(ref.notes) : undefined;
              const primary =
                ref.sheetLabels?.[0] ??
                sheet?.titleblock?.sheetLabel ??
                (sheet ? `p.${sheet.pageNumber}` : `…${ref.documentId.slice(-4)}`);
              const role = sheet ? SHEET_ROLE_LABEL[sheet.sheetRole] : null;
              const discipline: Discipline | undefined = sheet?.discipline;
              return (
                <button
                  key={`${ref.documentId}-${primary}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeDocRef(localId, ref.documentId);
                  }}
                  title={
                    sheet
                      ? `${discipline} · ${role}${sheet.notes ? " · " + sheet.notes : ""}`
                      : undefined
                  }
                  className="group flex items-center gap-1.5 border border-line-strong bg-bg-1 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim transition-colors hover:border-danger/50 hover:text-danger"
                >
                  {discipline && (
                    <span
                      aria-hidden
                      className={cn(
                        "inline-block h-1.5 w-1.5",
                        DISCIPLINE_DOT[discipline],
                      )}
                    />
                  )}
                  <span className="text-fg">{primary}</span>
                  {role && (
                    <span className="text-fg-muted">· {role}</span>
                  )}
                  <span className="opacity-0 transition-opacity group-hover:opacity-100">
                    ×
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
