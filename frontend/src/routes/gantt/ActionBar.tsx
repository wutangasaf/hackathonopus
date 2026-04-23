import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "@/lib/api";
import {
  useCreateFinancePlan,
  useUpdateFinancePlan,
} from "@/services/financePlan";
import { useGanttStore } from "@/stores/ganttStore";

export function ActionBar({
  projectId,
  planExists,
  knownPlanDocIds,
}: {
  projectId: string;
  planExists: boolean;
  knownPlanDocIds: string[];
}) {
  const navigate = useNavigate();
  const toCreateRequest = useGanttStore((s) => s.toCreateRequest);
  const validate = useGanttStore((s) => s.validate);
  const [localErrors, setLocalErrors] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

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

  const publishing =
    createMutation.isPending || updateMutation.isPending;

  function onPublish() {
    const errs = validate(knownPlanDocIds);
    setLocalErrors(errs);
    if (errs.length > 0) return;
    const body = toCreateRequest();
    if (planExists) updateMutation.mutate(body);
    else createMutation.mutate(body);
  }

  return (
    <div className="mt-8 border border-line bg-bg-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-dim">
          {planExists ? "Updating existing finance plan" : "Publishing new finance plan"}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center gap-2 border border-line-strong px-6 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-muted"
          >
            Save draft (local)
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={publishing}
            className="inline-flex items-center gap-2 bg-accent px-6 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-colors hover:bg-[#ff8940] disabled:bg-accent/60"
          >
            {publishing ? "Publishing…" : "Publish plan ↗"}
          </button>
        </div>
      </div>

      {(localErrors.length > 0 || apiError) && (
        <div className="mt-4 border-l-2 border-danger bg-bg p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-danger">
            Error · cannot publish
          </div>
          <ul className="mt-2 flex flex-col gap-1 font-mono text-[11px] leading-[1.55] text-fg-dim">
            {localErrors.map((e, i) => (
              <li key={i}>· {e}</li>
            ))}
            {apiError && <li>· {apiError}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
