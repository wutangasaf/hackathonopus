import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "@/lib/api";
import {
  useCreateFinancePlan,
  useUpdateFinancePlan,
} from "@/services/financePlan";
import { useGanttStore, type ValidationResult } from "@/stores/ganttStore";

export function ActionBar({
  projectId,
  planExists,
  validation,
}: {
  projectId: string;
  planExists: boolean;
  validation: ValidationResult;
}) {
  const navigate = useNavigate();
  const toCreateRequest = useGanttStore((s) => s.toCreateRequest);
  const resetScaffold = useGanttStore((s) => s.resetScaffold);
  const loanAmount = useGanttStore((s) => s.loanAmount);
  const totalTranche = loanAmount + validation.trancheDelta;
  const [apiError, setApiError] = useState<string | null>(null);
  const [resetArmed, setResetArmed] = useState(false);

  const createMutation = useCreateFinancePlan(projectId, {
    onSuccess: () => {
      setApiError(null);
      navigate(`/projects/${projectId}`);
    },
    onError: (err: ApiError) =>
      setApiError(`${err.status} · ${err.body.slice(0, 200)}`),
  });
  const updateMutation = useUpdateFinancePlan(projectId, {
    onSuccess: () => {
      setApiError(null);
      navigate(`/projects/${projectId}`);
    },
    onError: (err: ApiError) =>
      setApiError(`${err.status} · ${err.body.slice(0, 200)}`),
  });

  const publishing = createMutation.isPending || updateMutation.isPending;
  const invalid = validation.errors.length > 0;
  const canSave = !invalid && !publishing;

  function onPublish() {
    if (!canSave) return;
    const body = toCreateRequest();
    if (planExists) updateMutation.mutate(body);
    else createMutation.mutate(body);
  }

  function onReset() {
    if (planExists && !resetArmed) {
      setResetArmed(true);
      return;
    }
    const ok = window.confirm(
      "Reset to the 8-phase starter template? This clears your edits and any pinned plan pages.",
    );
    if (!ok) {
      setResetArmed(false);
      return;
    }
    resetScaffold();
    setResetArmed(false);
  }

  const deltaLabel = formatSignedUsd(validation.trancheDelta);
  const deltaTone =
    validation.trancheDelta >= -1 ? "text-success" : "text-danger";

  return (
    <div className="mt-8 border border-line bg-bg-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1 font-mono text-[11px] uppercase tracking-[0.14em]">
          <span className="text-fg-dim">
            {planExists
              ? "Updating existing finance plan"
              : "Publishing new finance plan"}
          </span>
          <span className="text-fg-muted">
            Tranche total{" "}
            <span className="text-fg">
              ${totalTranche.toLocaleString()}
            </span>{" "}
            · Loan{" "}
            <span className="text-fg">${loanAmount.toLocaleString()}</span>{" "}
            · <span className={deltaTone}>Δ {deltaLabel}</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onReset}
            title={
              planExists && !resetArmed
                ? "Click once to discard saved plan, again to reset"
                : "Reset to the 8-phase starter template"
            }
            className="inline-flex items-center gap-2 border border-line-strong px-5 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-dim transition-colors hover:border-fg-muted hover:bg-bg hover:text-fg"
          >
            {planExists && !resetArmed
              ? "Discard saved plan"
              : "Reset to template"}
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={!canSave}
            aria-disabled={!canSave}
            className="inline-flex items-center gap-2 bg-accent px-6 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-colors hover:bg-[#67e8f9] disabled:cursor-not-allowed disabled:bg-accent/40"
          >
            {publishing
              ? "Publishing…"
              : planExists
              ? "Save plan ↗"
              : "Publish plan ↗"}
          </button>
        </div>
      </div>

      {(validation.errors.length > 0 || apiError) && (
        <div className="mt-4 border-l-2 border-danger bg-bg p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-danger">
            Error · cannot {planExists ? "save" : "publish"}
          </div>
          <ul className="mt-2 flex flex-col gap-1 font-mono text-[11px] leading-[1.55] text-fg-dim">
            {validation.errors.map((e, i) => (
              <li key={i}>· {e}</li>
            ))}
            {apiError && <li>· {apiError}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatSignedUsd(n: number): string {
  if (n === 0) return "$0";
  return `${n >= 0 ? "+" : "-"}$${Math.abs(n).toLocaleString()}`;
}
