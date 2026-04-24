import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { addDays, differenceInDays } from "date-fns";
import { useRef, useState } from "react";

import { SHEET_ROLE_LABEL, type ClassifiedSheet, type Discipline } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useGanttStore, type FieldErrorMap } from "@/stores/ganttStore";

import { DISCIPLINE_DOT } from "@/routes/gantt/DocChip";

type DragMode = "move" | "resize-start" | "resize-end";

type MilestoneFieldErrors = FieldErrorMap[string] | undefined;

export function MilestoneRow({
  localId,
  kickoff,
  totalDays,
  selected,
  onSelect,
  sheetLookup,
  fieldErrors,
}: {
  localId: string;
  kickoff: Date;
  totalDays: number;
  selected: boolean;
  onSelect: () => void;
  sheetLookup: Map<string, ClassifiedSheet>;
  fieldErrors: MilestoneFieldErrors;
}) {
  const milestone = useGanttStore((s) =>
    s.milestones.find((m) => m.localId === localId),
  );
  const removeDocRef = useGanttStore((s) => s.removeDocRef);
  const setMilestoneField = useGanttStore((s) => s.setMilestoneField);
  const removeMilestone = useGanttStore((s) => s.removeMilestone);

  // One node serves two roles: a sortable item (for row reorder via the
  // drag handle) and a droppable target (for doc-chip pinning). Dnd-kit
  // gives us both from a single useSortable — the chip drag ends up with
  // `over.id === sortable:<localId>` and we branch on active.data.kind.
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: `sortable:${localId}`,
    data: { kind: "milestone", localId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;

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

  function onDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (milestone!.planDocRefs.length > 0) {
      const ok = window.confirm(
        `Remove "${milestone!.name}"? ${milestone!.planDocRefs.length} pinned plan page${milestone!.planDocRefs.length === 1 ? "" : "s"} will be unpinned.`,
      );
      if (!ok) return;
    }
    removeMilestone(localId);
  }

  const errPct = fieldErrors?.plannedPercentOfLoan;
  const errTranche = fieldErrors?.trancheAmount;
  const errName = fieldErrors?.name;
  const errStart = fieldErrors?.plannedStartDate;
  const errEnd = fieldErrors?.plannedCompletionDate;
  const errDocs = fieldErrors?.planDocRefs;
  const hasError = Boolean(
    errPct || errTranche || errName || errStart || errEnd || errDocs,
  );

  return (
    <div
      ref={setNodeRef}
      onClick={onSelect}
      style={style}
      className={cn(
        "relative grid min-h-[72px] cursor-pointer grid-cols-[220px_1fr] gap-4 border-b border-line transition-colors",
        selected ? "bg-bg-1" : "hover:bg-bg-1",
        isOver && "bg-accent-dim",
        isDragging && "opacity-60",
        hasError && "bg-danger/5",
      )}
    >
      {/* Label column */}
      <div className="flex items-stretch gap-1.5 px-2 py-2">
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Reorder milestone"
          title="Drag to reorder"
          className="flex w-4 cursor-grab items-center justify-center font-mono text-[12px] leading-none text-fg-muted transition-colors hover:text-accent active:cursor-grabbing"
        >
          ⋮⋮
        </button>

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-muted">
              M {String(milestone.sequence).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Remove milestone ${milestone.sequence}`}
              title="Remove milestone"
              className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-muted transition-colors hover:text-danger"
            >
              ✕
            </button>
          </div>

          <input
            type="text"
            value={milestone.name}
            maxLength={80}
            onChange={(e) =>
              setMilestoneField(localId, "name", e.target.value)
            }
            onClick={(e) => e.stopPropagation()}
            onFocus={onSelect}
            className={cn(
              "row-input mt-0.5 text-[14px] font-semibold tracking-tight text-fg",
              errName && "border-b border-danger",
            )}
            placeholder="Phase name"
          />

          <div className="mt-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em]">
            <span className="text-fg-dim">$</span>
            <NumberCell
              value={milestone.trancheAmount}
              step={1000}
              min={0}
              onCommit={(v) => setMilestoneField(localId, "trancheAmount", v)}
              onFocus={onSelect}
              width={80}
              error={Boolean(errTranche)}
              format={(v) => v.toLocaleString()}
            />
            <span className="text-fg-dim">·</span>
            <NumberCell
              value={milestone.plannedPercentOfLoan}
              step={0.1}
              min={0}
              max={100}
              onCommit={(v) =>
                setMilestoneField(localId, "plannedPercentOfLoan", v)
              }
              onFocus={onSelect}
              width={46}
              error={Boolean(errPct)}
              format={(v) => `${v}%`}
              suffix="%"
            />
          </div>

          <div className="mt-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">
            <DateCell
              value={milestone.plannedStartDate}
              error={Boolean(errStart)}
              onCommit={(iso) =>
                setMilestoneField(localId, "plannedStartDate", iso)
              }
              onFocus={onSelect}
              aria="Start date"
            />
            <span className="text-fg-muted">→</span>
            <DateCell
              value={milestone.plannedCompletionDate}
              error={Boolean(errEnd)}
              onCommit={(iso) =>
                setMilestoneField(localId, "plannedCompletionDate", iso)
              }
              onFocus={onSelect}
              aria="Completion date"
            />
          </div>

          {(errPct || errTranche || errName) && (
            <div className="mt-1 font-mono text-[10px] leading-tight text-danger">
              {errName ?? errPct ?? errTranche}
            </div>
          )}
        </div>
      </div>

      {/* Timeline column */}
      <div className="relative px-2 py-3">
        <div aria-hidden className="absolute inset-x-2 top-1/2 h-px bg-bg-3" />
        <TrancheBar
          localId={localId}
          startDate={milestone.plannedStartDate}
          endDate={milestone.plannedCompletionDate}
          totalDays={totalDays}
          offsetPct={offsetPct}
          widthPct={widthPct}
          selected={selected}
          hasError={hasError}
          onSelect={onSelect}
        />

        {(errStart || errEnd || errDocs) && (
          <div className="absolute inset-x-2 bottom-1 font-mono text-[10px] uppercase tracking-[0.1em] text-danger">
            {errStart ?? errEnd ?? errDocs}
          </div>
        )}

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
                <span
                  key={`${ref.documentId}-${primary}`}
                  className="group flex items-center gap-1.5 border border-line-strong bg-bg-1 pl-2 pr-1 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim"
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
                  {role && <span className="text-fg-muted">· {role}</span>}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeDocRef(localId, ref.documentId);
                    }}
                    title="Unpin"
                    aria-label={`Unpin ${primary}`}
                    className="ml-1 px-1 text-fg-muted transition-colors hover:text-danger"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .row-input {
          width: 100%;
          background: transparent;
          border: 0;
          padding: 0;
          color: inherit;
          font: inherit;
          letter-spacing: inherit;
        }
        .row-input:focus {
          outline: none;
          box-shadow: inset 0 -1px 0 var(--accent);
        }
      `}</style>
    </div>
  );
}

function TrancheBar({
  localId,
  startDate,
  endDate,
  totalDays,
  offsetPct,
  widthPct,
  selected,
  hasError,
  onSelect,
}: {
  localId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  offsetPct: number;
  widthPct: number;
  selected: boolean;
  hasError: boolean;
  onSelect: () => void;
}) {
  const setMilestoneField = useGanttStore((s) => s.setMilestoneField);
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<DragMode | null>(null);

  function beginDrag(mode: DragMode, e: React.PointerEvent) {
    // Don't bubble into the row's click (avoids fighting select semantics).
    e.preventDefault();
    e.stopPropagation();
    onSelect();

    const bar = barRef.current;
    const rail = bar?.parentElement;
    if (!bar || !rail) return;

    // Rail drawing width matches the 1-px track (`inset-x-2` on the parent).
    const railWidth = rail.getBoundingClientRect().width - 16;
    if (railWidth <= 0 || totalDays <= 0) return;
    const pxPerDay = railWidth / totalDays;

    const startX = e.clientX;
    const baseStart = new Date(startDate);
    const baseEnd = new Date(endDate);
    setDragging(mode);

    let lastDelta = 0;
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dDays = Math.round(dx / pxPerDay);
      if (dDays === lastDelta) return;
      lastDelta = dDays;

      if (mode === "move") {
        setMilestoneField(
          localId,
          "plannedStartDate",
          addDays(baseStart, dDays).toISOString(),
        );
        setMilestoneField(
          localId,
          "plannedCompletionDate",
          addDays(baseEnd, dDays).toISOString(),
        );
      } else if (mode === "resize-start") {
        const nextStart = addDays(baseStart, dDays);
        // Never cross the end date; minimum 1-day width.
        if (nextStart >= addDays(baseEnd, -1)) return;
        setMilestoneField(
          localId,
          "plannedStartDate",
          nextStart.toISOString(),
        );
      } else {
        const nextEnd = addDays(baseEnd, dDays);
        if (nextEnd <= addDays(baseStart, 1)) return;
        setMilestoneField(
          localId,
          "plannedCompletionDate",
          nextEnd.toISOString(),
        );
      }
    };

    const stop = () => {
      setDragging(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  return (
    <div
      ref={barRef}
      onPointerDown={(e) => beginDrag("move", e)}
      role="slider"
      aria-label="Drag to reschedule milestone"
      className={cn(
        "absolute top-1/2 h-5 -translate-y-1/2 touch-none select-none border",
        dragging === "move" ? "cursor-grabbing" : "cursor-grab",
        hasError
          ? "border-danger bg-danger/20"
          : selected
          ? "border-accent bg-accent/20"
          : "border-line-strong bg-bg-2 hover:border-accent/60",
      )}
      style={{ left: `${offsetPct}%`, width: `${widthPct}%` }}
    >
      {/* Left edge: resize start date */}
      <div
        onPointerDown={(e) => beginDrag("resize-start", e)}
        role="slider"
        aria-label="Drag to change start date"
        title="Drag to change start date"
        className={cn(
          "absolute inset-y-0 left-0 w-1.5 cursor-ew-resize",
          hasError ? "bg-danger" : "bg-accent",
        )}
      />
      {/* Right edge: resize completion date */}
      <div
        onPointerDown={(e) => beginDrag("resize-end", e)}
        role="slider"
        aria-label="Drag to change completion date"
        title="Drag to change completion date"
        className={cn(
          "absolute inset-y-0 right-0 w-1.5 cursor-ew-resize transition-colors",
          hasError
            ? "bg-danger/60"
            : "bg-line-strong hover:bg-accent",
        )}
      />
    </div>
  );
}

function NumberCell({
  value,
  step,
  min,
  max,
  width,
  format,
  suffix,
  error,
  onCommit,
  onFocus,
}: {
  value: number;
  step: number;
  min?: number;
  max?: number;
  width: number;
  format: (v: number) => string;
  suffix?: string;
  error?: boolean;
  onCommit: (v: number) => void;
  onFocus?: () => void;
}) {
  // While unfocused, display the upstream value (so cascaded recomputes
  // show through). While focused, display the user's unparsed draft.
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? format(value);
  const allowDecimal = step < 1;
  const sanitize = (raw: string) =>
    allowDecimal
      ? raw.replace(/[^0-9.,]/g, "").replace(/(\..*?)\./g, "$1")
      : raw.replace(/[^0-9,]/g, "");

  return (
    <input
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      value={display}
      onChange={(e) => setDraft(sanitize(e.target.value))}
      onClick={(e) => e.stopPropagation()}
      onFocus={() => {
        setDraft(format(value));
        onFocus?.();
      }}
      onBlur={() => {
        if (draft === null) return;
        const parsed = Number(draft.replace(/[,\s]/g, ""));
        if (Number.isFinite(parsed)) {
          const clamped = Math.min(
            max ?? Number.POSITIVE_INFINITY,
            Math.max(min ?? Number.NEGATIVE_INFINITY, parsed),
          );
          const rounded =
            step >= 1 ? Math.round(clamped) : Math.round(clamped * 10) / 10;
          onCommit(rounded);
        }
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(null);
          (e.target as HTMLInputElement).blur();
        }
      }}
      style={{ width }}
      className={cn(
        "row-input text-fg",
        error && "text-danger",
      )}
      aria-label={suffix === "%" ? "Percent of loan" : "Amount"}
      title={suffix ? `${display}${suffix}` : display}
    />
  );
}

function DateCell({
  value,
  error,
  onCommit,
  onFocus,
  aria,
}: {
  value: string;
  error?: boolean;
  onCommit: (iso: string) => void;
  onFocus?: () => void;
  aria: string;
}) {
  const d = new Date(value);
  const inputValue = Number.isNaN(d.getTime())
    ? ""
    : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  return (
    <input
      type="date"
      value={inputValue}
      onChange={(e) => {
        const v = e.target.value;
        if (!v) return;
        const [y, m, day] = v.split("-").map(Number);
        if (!y || !m || !day) return;
        const base = Number.isNaN(d.getTime()) ? new Date() : new Date(d);
        base.setUTCFullYear(y, m - 1, day);
        onCommit(base.toISOString());
      }}
      onClick={(e) => e.stopPropagation()}
      onFocus={onFocus}
      style={{ width: 110 }}
      className={cn(
        "row-input text-fg",
        error && "text-danger",
      )}
      aria-label={aria}
    />
  );
}
