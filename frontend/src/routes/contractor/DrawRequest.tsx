import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import {
  G703Dropzone,
  type G703DropzoneSubmit,
} from "@/components/uploads/G703Dropzone";
import { ApiError } from "@/lib/api";
import type { Draw } from "@/lib/types";
import {
  useApproveDraw,
  useCreateDraw,
  useDraw,
  useDraws,
  useInProgressDraws,
  usePatchDrawLine,
} from "@/services/draws";
import { useCurrentMilestone, useFinancePlan } from "@/services/financePlan";
import { useProject } from "@/services/projects";

import { InvestigationPanel } from "@/components/supervisor/InvestigationPanel";

import { ContextSidebar } from "./ContextSidebar";
import { DrawActionBar } from "./DrawActionBar";
import { DrawHeaderStrip } from "./DrawHeaderStrip";
import { ReviewTable } from "./ReviewTable";
import { SubmittedCard } from "./SubmittedCard";
import { useDrawReview } from "./useDrawReview";

type Phase =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "parsing"; draw: Draw }
  | { kind: "review"; draw: Draw }
  | { kind: "submitting"; draw: Draw }
  | { kind: "submitted"; draw: Draw }
  | { kind: "failed"; draw: Draw };

function phaseFromDraw(
  draw: Draw | undefined,
  createPending: boolean,
  approvePending: boolean,
): Phase {
  if (createPending) return { kind: "uploading" };
  if (!draw) return { kind: "idle" };
  if (draw.status === "parsing") return { kind: "parsing", draw };
  if (draw.status === "failed" || draw.status === "rejected") {
    return { kind: "failed", draw };
  }
  if (draw.status === "approved") {
    return approvePending
      ? { kind: "submitting", draw }
      : { kind: "submitted", draw };
  }
  return approvePending
    ? { kind: "submitting", draw }
    : { kind: "review", draw };
}

export default function DrawRequest() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const [drawId, setDrawId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [patchError, setPatchError] = useState<string | null>(null);
  const [pendingLineIndex, setPendingLineIndex] = useState<number | null>(null);
  const [investigationOpen, setInvestigationOpen] = useState(false);

  const project = useProject(projectId);
  const financePlan = useFinancePlan(projectId);

  // Resume flow: if the user lands on the route with no local drawId,
  // look for an in-progress draw on the project and adopt it.
  const inProgress = useInProgressDraws(projectId, {
    enabled: Boolean(projectId) && drawId === null,
  });
  useEffect(() => {
    if (drawId !== null) return;
    const list = inProgress.data;
    if (list && list.length > 0) {
      setDrawId(list[0]._id);
    }
  }, [drawId, inProgress.data]);

  const createDraw = useCreateDraw(projectId, {
    onSuccess: (draw) => {
      setUploadError(null);
      setDrawId(draw._id);
    },
    onError: (err: ApiError) =>
      setUploadError(`${err.status} · ${err.body.slice(0, 200)}`),
  });

  const draw = useDraw(projectId, drawId ?? undefined);

  const approve = useApproveDraw(projectId, drawId ?? "", {
    onSuccess: () => setApproveError(null),
    onError: (err: ApiError) =>
      setApproveError(`${err.status} · ${err.body.slice(0, 200)}`),
  });

  const patchLine = usePatchDrawLine(projectId, drawId ?? "", {
    onSuccess: () => {
      setPatchError(null);
      setPendingLineIndex(null);
    },
    onError: (err: ApiError) => {
      setPatchError(`${err.status} · ${err.body.slice(0, 200)}`);
      setPendingLineIndex(null);
    },
  });

  const resumingDraw = Boolean(drawId) && !draw.data && !draw.isError;
  const phase = useMemo(
    () =>
      phaseFromDraw(draw.data, createDraw.isPending, approve.isPending),
    [draw.data, createDraw.isPending, approve.isPending],
  );

  const activeDraw =
    phase.kind === "idle" || phase.kind === "uploading" ? undefined : phase.draw;
  const counters = useDrawReview(activeDraw);

  function handleUpload(files: G703DropzoneSubmit) {
    if (!projectId) return;
    createDraw.mutate(files);
  }

  function handleConfirm(lineIndex: number) {
    if (!drawId) return;
    setPendingLineIndex(lineIndex);
    patchLine.mutate({
      lineIndex,
      patch: { approvalStatus: "confirmed" },
    });
  }

  function handleOverride(lineIndex: number, confirmedMilestoneId: string) {
    if (!drawId) return;
    setPendingLineIndex(lineIndex);
    patchLine.mutate({
      lineIndex,
      patch: { approvalStatus: "overridden", confirmedMilestoneId },
    });
  }

  function handleTryAgain() {
    setDrawId(null);
    setUploadError(null);
    setApproveError(null);
    setPatchError(null);
    createDraw.reset();
  }

  function handleApprove() {
    if (!drawId || !counters.canApprove) return;
    approve.mutate();
  }

  const projectName = project.data?.name;
  const milestones = financePlan.data?.milestones ?? [];
  const drawFetchError =
    draw.error && drawId
      ? `Couldn't load draw · ${draw.error.status} ${draw.error.body.slice(0, 120)}`
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <DrawHeaderStrip
        projectName={projectName}
        drawNumber={activeDraw?.drawNumber}
      />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-[1280px] px-8 py-10">
          {phase.kind === "idle" && (
            <IdleShell
              resuming={
                (inProgress.isPending && drawId === null) || resumingDraw
              }
              hasFinancePlan={Boolean(financePlan.data)}
              onSubmit={handleUpload}
              uploading={false}
              error={uploadError ?? undefined}
            />
          )}

          {phase.kind === "uploading" && (
            <IdleShell
              resuming={false}
              hasFinancePlan={Boolean(financePlan.data)}
              onSubmit={handleUpload}
              uploading
              error={undefined}
            />
          )}

          {phase.kind === "parsing" && <ParsingScreen />}

          {(phase.kind === "review" || phase.kind === "submitting") && (
            <ReviewScreen
              draw={phase.draw}
              milestones={milestones}
              pendingLineIndex={pendingLineIndex}
              onConfirm={handleConfirm}
              onOverride={handleOverride}
              error={patchError}
            />
          )}

          {phase.kind === "submitted" && (
            <>
              <SubmittedCard draw={phase.draw} projectId={projectId} />
              <div className="mx-auto mt-6 flex max-w-xl flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInvestigationOpen(true)}
                  className="inline-flex items-center gap-2 border border-accent bg-bg-1 px-6 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent transition-colors hover:bg-accent hover:text-black"
                >
                  ▸ Run supervisor investigation
                </button>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted">
                  Claude Managed Agents · autonomous inspector
                </div>
              </div>
              {investigationOpen && projectId && (
                <InvestigationPanel
                  projectId={projectId}
                  drawId={phase.draw._id}
                  drawNumber={phase.draw.drawNumber}
                  onClose={() => setInvestigationOpen(false)}
                />
              )}
            </>
          )}

          {phase.kind === "failed" && (
            <FailedScreen draw={phase.draw} onTryAgain={handleTryAgain} />
          )}

          {drawFetchError && (
            <div className="mt-6 border-l-2 border-danger bg-bg-1 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-danger">
              {drawFetchError}
            </div>
          )}
        </div>
      </main>

      {(phase.kind === "review" || phase.kind === "submitting") && (
        <DrawActionBar
          projectId={projectId}
          counters={counters}
          approving={phase.kind === "submitting"}
          onApprove={handleApprove}
          errorText={approveError}
        />
      )}

      <footer className="border-t border-line">
        <div className="mx-auto w-full max-w-[1280px] px-8 py-4 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted">
          Mock draw — not yet wired into the inspection pipeline
        </div>
      </footer>
    </div>
  );
}

function IdleShell({
  resuming,
  hasFinancePlan,
  onSubmit,
  uploading,
  error,
}: {
  resuming: boolean;
  hasFinancePlan: boolean;
  onSubmit: (files: G703DropzoneSubmit) => void;
  uploading: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_var(--accent-glow)]" />
          Step 01 · Upload
        </span>
        <h1 className="text-[32px] font-extrabold leading-[1.05] tracking-tight text-fg">
          Submit a draw request
        </h1>
        <p className="max-w-xl text-[14px] leading-[1.55] text-fg-dim">
          Drop your AIA-G703 schedule of values. Plumbline.ai parses every
          line item and pre-maps it to a milestone on the finance plan.
          You confirm or override before the bank sees it.
        </p>
      </div>

      {!hasFinancePlan && (
        <div className="border-l-2 border-warn bg-bg-1 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-warn">
          This project has no finance plan yet · the backend will reject
          the upload until a master SOV is published.
        </div>
      )}

      {resuming ? (
        <div className="border border-line bg-bg-1 p-10 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-fg-muted">
          Checking for an in-progress draw…
        </div>
      ) : (
        <G703Dropzone
          uploading={uploading}
          error={error}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}

function ParsingScreen() {
  return (
    <div className="space-y-4">
      <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_var(--accent-glow)]" />
        Step 02 · Parsing
      </span>
      <div className="relative min-h-[180px] overflow-hidden border border-line bg-bg-1 p-10">
        <div
          aria-hidden
          className="absolute left-0 right-0 top-0 h-px overflow-hidden bg-bg-3"
        >
          <div className="h-full w-1/3 animate-[plumbline-progress_1.6s_ease-in-out_infinite] bg-accent" />
        </div>
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fg">
          PARSING…
        </div>
        <p className="mt-3 max-w-lg text-[13px] leading-[1.55] text-fg-dim">
          Agent 3 is extracting every row from your G703 and suggesting a
          milestone mapping. Typical G703 takes 15–45 seconds. You can
          leave this page open.
        </p>
      </div>
      <style>{`
        @keyframes plumbline-progress {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(150%); }
          100% { transform: translateX(350%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [aria-hidden] .animate-\\[plumbline-progress_1\\.6s_ease-in-out_infinite\\] {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

function ReviewScreen({
  draw,
  milestones,
  pendingLineIndex,
  onConfirm,
  onOverride,
  error,
}: {
  draw: Draw;
  milestones: import("@/lib/types").Milestone[];
  pendingLineIndex: number | null;
  onConfirm: (lineIndex: number) => void;
  onOverride: (lineIndex: number, confirmedMilestoneId: string) => void;
  error?: string | null;
}) {
  const total = draw.totalAmountRequested ?? 0;
  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_var(--accent-glow)]" />
            Step 03 · Review
          </span>
          <h2 className="text-[24px] font-extrabold tracking-tight text-fg">
            Confirm each line against your finance plan
          </h2>
          <p className="max-w-xl text-[13px] leading-[1.55] text-fg-dim">
            Low-confidence rows are flagged in amber. Pick a different
            milestone from the dropdown to override, or click confirm to
            accept the AI suggestion.
          </p>
        </div>
        <div className="text-right font-mono">
          <div className="text-[10px] uppercase tracking-[0.14em] text-fg-muted">
            Total requested
          </div>
          <div className="mt-1 text-[24px] font-semibold tabular-nums tracking-tight text-fg">
            ${Math.round(total).toLocaleString()}
          </div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-fg-muted">
            {draw.lines.length} lines
          </div>
        </div>
      </div>

      {milestones.length === 0 && (
        <div className="border-l-2 border-warn bg-bg-1 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-warn">
          No milestones on the finance plan · the dropdowns will be empty.
          Publish a plan first.
        </div>
      )}

      <ReviewTable
        lines={draw.lines}
        milestones={milestones}
        pendingLineIndex={pendingLineIndex}
        onConfirm={onConfirm}
        onOverride={onOverride}
      />

      {error && (
        <div className="border-l-2 border-danger bg-bg-1 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-danger">
          ERROR · {error}
        </div>
      )}
    </div>
  );
}

function FailedScreen({
  draw,
  onTryAgain,
}: {
  draw: Draw;
  onTryAgain: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-5 border-l-2 border-danger bg-bg-1 px-8 py-10">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-danger">
        Extraction failed
      </span>
      <h2 className="text-[22px] font-extrabold tracking-tight text-fg">
        We couldn't read your G703
      </h2>
      <p className="text-[13px] leading-[1.55] text-fg-dim">
        {draw.extractorError
          ? draw.extractorError
          : "The parser returned no usable line items. Try re-uploading a clearer copy."}
      </p>
      <button
        type="button"
        onClick={onTryAgain}
        className="inline-flex items-center gap-2 bg-accent px-6 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-colors hover:bg-[#67e8f9]"
      >
        Try again ↗
      </button>
    </div>
  );
}
