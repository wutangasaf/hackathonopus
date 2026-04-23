import { Link } from "react-router-dom";

import { relativeTime } from "@/lib/time";
import type { AgentRun } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePlans } from "@/services/plans";
import { useLatestRunByAgent } from "@/services/runs";

const AGENTS: {
  name: "PlanClassifier" | "PlanFormatExtractor";
  label: string;
  running: string;
  done: (r: AgentRun) => string;
}[] = [
  {
    name: "PlanClassifier",
    label: "1 · Plan Classifier",
    running: "LABELING PAGES…",
    done: (r) =>
      `DONE · ${relativeTime(r.completedAt ?? r.startedAt)}`,
  },
  {
    name: "PlanFormatExtractor",
    label: "2 · Plan Format",
    running: "BUILDING ELEMENT LIST…",
    done: (r) =>
      `DONE · ${relativeTime(r.completedAt ?? r.startedAt)}`,
  },
];

export function PipelineProgress({ projectId }: { projectId: string }) {
  const plans = usePlans(projectId);
  const { latestByAgent, isLoading } = useLatestRunByAgent(projectId);

  const classifier = latestByAgent.get("PlanClassifier");
  const extractor = latestByAgent.get("PlanFormatExtractor");
  const bothDone =
    classifier?.status === "succeeded" &&
    extractor?.status === "succeeded";
  const anyFailed =
    classifier?.status === "failed" || extractor?.status === "failed";
  const hasPlans = (plans.data?.length ?? 0) > 0;

  if (isLoading && !latestByAgent.size) {
    return null;
  }

  return (
    <div className="border border-line bg-bg-1">
      <div className="flex flex-col divide-y divide-line">
        {AGENTS.map((a) => {
          const run = latestByAgent.get(a.name);
          return <Row key={a.name} meta={a} run={run} hasPlans={hasPlans} />;
        })}
      </div>
      {(bothDone || anyFailed) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-bg px-5 py-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-dim">
            {bothDone ? "Ready to build" : "Pipeline halted"}
          </div>
          {bothDone && (
            <Link
              to={`/projects/${projectId}/gantt`}
              className="inline-flex items-center gap-2 bg-accent px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-colors hover:bg-[#ff8940]"
            >
              Open Gantt Builder ↗
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  meta,
  run,
  hasPlans,
}: {
  meta: (typeof AGENTS)[number];
  run: AgentRun | undefined;
  hasPlans: boolean;
}) {
  let status: "queued" | "running" | "done" | "failed";
  let text: string;
  if (!run) {
    status = hasPlans ? "queued" : "queued";
    text = hasPlans ? "QUEUED…" : "AWAITING UPLOAD";
  } else if (run.status === "running") {
    status = "running";
    text = meta.running;
  } else if (run.status === "succeeded") {
    status = "done";
    text = meta.done(run);
  } else {
    status = "failed";
    text = `FAILED · ${(run.error ?? "").slice(0, 80)}`;
  }

  const dot =
    status === "running"
      ? "bg-warn animate-pulse"
      : status === "done"
        ? "bg-success"
        : status === "failed"
          ? "bg-danger"
          : "border border-fg-muted";

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn("inline-block h-[10px] w-[10px]", dot)}
        />
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg">
          {meta.label}
        </span>
      </div>
      <div
        className={cn(
          "font-mono text-[11px] uppercase tracking-[0.12em]",
          status === "failed"
            ? "text-danger"
            : status === "done"
              ? "text-success"
              : "text-fg-muted",
        )}
      >
        {text}
      </div>
    </div>
  );
}
