import { Link } from "react-router-dom";

import { relativeTime } from "@/lib/time";
import type { AgentRun } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePlanClassification, usePlans } from "@/services/plans";
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
  const classification = usePlanClassification(projectId);
  const { latestByAgent, isLoading } = useLatestRunByAgent(projectId);

  const classifier = latestByAgent.get("PlanClassifier");
  const extractor = latestByAgent.get("PlanFormatExtractor");
  const bothDone =
    classifier?.status === "succeeded" &&
    extractor?.status === "succeeded";
  const anyFailed =
    classifier?.status === "failed" || extractor?.status === "failed";
  const hasPlans = (plans.data?.length ?? 0) > 0;

  if (isLoading && !latestByAgent.size) return null;

  const sheetCount = classification.data?.sheets.length;

  return (
    <div className="space-y-4">
      <div className="border border-line bg-bg-1">
        <div className="flex flex-col divide-y divide-line">
          {AGENTS.map((a) => {
            const run = latestByAgent.get(a.name);
            return <Row key={a.name} meta={a} run={run} hasPlans={hasPlans} />;
          })}
        </div>
      </div>

      {bothDone && <NextStepBanner projectId={projectId} sheetCount={sheetCount} />}

      {anyFailed && (
        <div className="border-l-2 border-danger bg-bg-1 px-5 py-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-danger">
            Pipeline halted
          </div>
          <p className="mt-1 font-mono text-[11px] leading-[1.55] text-fg-dim">
            One of the classification agents failed. Check the run stream
            for the error and re-upload the affected PDFs.
          </p>
        </div>
      )}
    </div>
  );
}

function NextStepBanner({
  projectId,
  sheetCount,
}: {
  projectId: string;
  sheetCount: number | undefined;
}) {
  return (
    <div className="relative overflow-hidden border border-line-strong bg-bg-1 p-6 lg:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-accent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-12 h-64 w-3/5"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,107,26,0.08), transparent 65%)",
        }}
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
            <span aria-hidden className="inline-block h-1.5 w-1.5 bg-accent" />
            Next · Gantt builder
          </div>
          <h3 className="mt-3 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-fg lg:text-[28px]">
            Plans labeled.
            <br className="hidden lg:block" />{" "}
            <span className="text-fg-dim">
              Set time frames and pick docs per milestone.
            </span>
          </h3>
          <p className="mt-3 text-[13px] leading-[1.55] text-fg-dim">
            Agents 1 and 2 are done{typeof sheetCount === "number"
              ? ` — ${sheetCount} sheet${sheetCount === 1 ? "" : "s"} classified across disciplines`
              : ""}. Next, drag the labeled pages onto the right milestones
            and lock in each tranche&apos;s window.
          </p>
        </div>
        <Link
          to={`/projects/${projectId}/gantt`}
          className="inline-flex shrink-0 items-center gap-2.5 bg-accent px-6 py-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-all hover:bg-[#ff8940] hover:shadow-[0_0_0_3px_rgba(255,107,26,0.18)]"
        >
          Open Gantt builder <span aria-hidden>↗</span>
        </Link>
      </div>
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
    status = "queued";
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
          : "border border-fg-dim";

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
              : status === "running"
                ? "text-warn"
                : "text-fg-dim",
        )}
      >
        {text}
      </div>
    </div>
  );
}
