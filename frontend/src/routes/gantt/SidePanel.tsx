import {
  SHEET_ROLE_LABEL,
  type ClassifiedSheet,
  type Discipline,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useGanttStore } from "@/stores/ganttStore";

import { DISCIPLINE_DOT } from "@/routes/gantt/DocChip";

export function SidePanel({
  sheetLookup,
}: {
  sheetLookup: Map<string, ClassifiedSheet>;
}) {
  const milestone = useGanttStore((s) =>
    s.selectedLocalId
      ? s.milestones.find((m) => m.localId === s.selectedLocalId)
      : undefined,
  );
  const setMilestoneField = useGanttStore((s) => s.setMilestoneField);
  const removeDocRef = useGanttStore((s) => s.removeDocRef);

  if (!milestone) {
    return (
      <aside className="border border-line bg-bg-1 p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-dim">
          Select a milestone
        </div>
        <p className="mt-3 text-sm leading-[1.55] text-fg-muted">
          Click a row on the timeline to edit its dates, tranche, release
          percent, or the plan pages pinned to it.
        </p>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col gap-5 border border-line bg-bg-1 p-5">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-dim">
          Milestone {String(milestone.sequence).padStart(2, "0")}
        </div>
        <input
          type="text"
          value={milestone.name}
          onChange={(e) =>
            setMilestoneField(milestone.localId, "name", e.target.value)
          }
          className="mt-2 w-full border-0 bg-transparent text-[20px] font-extrabold tracking-tight text-fg focus:outline-none"
        />
      </div>

      <Field label="Start">
        <input
          type="date"
          value={milestone.plannedStartDate.slice(0, 10)}
          onChange={(e) =>
            setMilestoneField(
              milestone.localId,
              "plannedStartDate",
              new Date(e.target.value + "T00:00:00Z").toISOString(),
            )
          }
          className="mono-input"
        />
      </Field>

      <Field label="Completion">
        <input
          type="date"
          value={milestone.plannedCompletionDate.slice(0, 10)}
          onChange={(e) =>
            setMilestoneField(
              milestone.localId,
              "plannedCompletionDate",
              new Date(e.target.value + "T00:00:00Z").toISOString(),
            )
          }
          className="mono-input"
        />
      </Field>

      <Field label="Tranche amount ($)">
        <input
          type="number"
          min={0}
          step={1000}
          value={milestone.trancheAmount}
          onChange={(e) =>
            setMilestoneField(
              milestone.localId,
              "trancheAmount",
              Number(e.target.value) || 0,
            )
          }
          className="mono-input"
        />
      </Field>

      <Field label="Planned % of loan">
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={milestone.plannedPercentOfLoan}
          onChange={(e) =>
            setMilestoneField(
              milestone.localId,
              "plannedPercentOfLoan",
              Number(e.target.value) || 0,
            )
          }
          className="mono-input"
        />
      </Field>

      <Field label="Release % on pass">
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={milestone.plannedReleasePct}
          onChange={(e) =>
            setMilestoneField(
              milestone.localId,
              "plannedReleasePct",
              Number(e.target.value) || 0,
            )
          }
          className="mono-input"
        />
      </Field>

      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-dim">
          Pinned plan pages · {milestone.planDocRefs.length}
        </div>
        {milestone.planDocRefs.length === 0 ? (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-muted">
            Drag chips from the palette onto this row.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-[2px] bg-[var(--line)]">
            {milestone.planDocRefs.map((ref) => {
              const sheet = ref.notes ? sheetLookup.get(ref.notes) : undefined;
              const primary =
                ref.sheetLabels?.[0] ??
                sheet?.titleblock?.sheetLabel ??
                (sheet ? `p.${sheet.pageNumber}` : `…${ref.documentId.slice(-4)}`);
              const role = sheet ? SHEET_ROLE_LABEL[sheet.sheetRole] : null;
              const discipline: Discipline | undefined = sheet?.discipline;
              return (
                <li
                  key={`${ref.documentId}-${primary}`}
                  className="group flex items-start gap-2 bg-bg px-3 py-2"
                >
                  {discipline && (
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1 inline-block h-1.5 w-1.5 flex-none",
                        DISCIPLINE_DOT[discipline],
                      )}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg">
                      {primary}
                      {role && (
                        <span className="text-fg-muted"> · {role}</span>
                      )}
                    </div>
                    {sheet?.notes && (
                      <div className="mt-1 text-[11px] leading-[1.45] text-fg-muted">
                        {sheet.notes}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDocRef(milestone.localId, ref.documentId)}
                    className="self-start font-mono text-[10px] uppercase tracking-[0.12em] text-fg-muted transition-colors hover:text-danger"
                    aria-label="Remove pinned page"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <style>{`
        .mono-input {
          width: 100%;
          padding: 8px 10px;
          background: var(--bg);
          border: 1px solid var(--line-strong);
          color: var(--fg);
          font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace;
          font-size: 12px;
          letter-spacing: 0.04em;
        }
        .mono-input:focus {
          outline: 2px solid var(--accent);
          outline-offset: 1px;
        }
      `}</style>
    </aside>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
        {label}
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
