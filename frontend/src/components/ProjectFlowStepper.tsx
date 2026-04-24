import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";
import { useFinancePlan } from "@/services/financePlan";
import { usePlanClassification, usePlans } from "@/services/plans";

type StepState = "done" | "active" | "pending";

type StepProps = {
  index: number;
  label: string;
  hint: string;
  state: StepState;
  href?: string;
};

export function ProjectFlowStepper({ projectId }: { projectId: string }) {
  const plans = usePlans(projectId);
  const classification = usePlanClassification(projectId);
  const financePlan = useFinancePlan(projectId);

  const plansUploaded = (plans.data?.length ?? 0) > 0;
  const sheetCount = classification.data?.sheets.length ?? 0;
  const classificationReady = Boolean(classification.data) && sheetCount > 0;
  const sovPublished = (financePlan.data?.sov.length ?? 0) > 0;

  const step1: StepState = classificationReady ? "done" : "active";
  const step2: StepState = sovPublished
    ? "done"
    : classificationReady
      ? "active"
      : "pending";
  const step3: StepState = sovPublished ? "done" : "pending";

  const step1Hint = classificationReady
    ? `${sheetCount} sheet${sheetCount === 1 ? "" : "s"} classified`
    : plansUploaded
      ? "Agents 1 & 2 running…"
      : "Upload plan PDFs to begin";

  const step2Hint = sovPublished
    ? "SOV published"
    : classificationReady
      ? "Open Gantt builder"
      : "Waiting on plan classification";

  const step3Hint = sovPublished
    ? "Contractor can submit G702/G703"
    : "Unlocks after SOV publish";

  return (
    <div className="border border-line-strong bg-bg-1">
      <div className="grid grid-cols-1 md:grid-cols-3">
        <Step
          index={1}
          label="Plans classified"
          hint={step1Hint}
          state={step1}
        />
        <Step
          index={2}
          label="Publish the SOV"
          hint={step2Hint}
          state={step2}
          href={
            step2 === "active" ? `/projects/${projectId}/gantt` : undefined
          }
        />
        <Step
          index={3}
          label="Ready for contractor draws"
          hint={step3Hint}
          state={step3}
        />
      </div>
    </div>
  );
}

function Step({ index, label, hint, state, href }: StepProps) {
  const stateClass =
    state === "done"
      ? "text-fg"
      : state === "active"
        ? "text-accent"
        : "text-fg-muted";

  const markerClass =
    state === "done"
      ? "border-fg bg-fg text-black"
      : state === "active"
        ? "border-accent bg-accent text-black"
        : "border-line-strong bg-bg-2 text-fg-muted";

  const markerGlyph = state === "done" ? "✓" : String(index).padStart(2, "0");

  const body = (
    <div
      className={cn(
        "flex items-start gap-4 border-l border-line px-6 py-5 md:border-l first:border-l-0 md:first:border-l-0 md:border-t-0 transition-colors",
        state === "active" && "bg-[rgba(255,107,26,0.04)]",
        href && "hover:bg-bg-2",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center border font-mono text-[11px] font-semibold tracking-[0.08em]",
          markerClass,
        )}
      >
        {markerGlyph}
      </span>
      <div className="min-w-0">
        <div
          className={cn(
            "font-mono text-[11px] font-semibold uppercase tracking-[0.16em]",
            stateClass,
          )}
        >
          Step {String(index).padStart(2, "0")} · {label}
        </div>
        <div className="mt-1.5 truncate text-[12px] leading-[1.5] text-fg-dim">
          {hint}
          {href && state === "active" && (
            <span aria-hidden className="ml-1.5 text-accent">
              ↗
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        to={href}
        className="group block focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        {body}
      </Link>
    );
  }
  return body;
}
