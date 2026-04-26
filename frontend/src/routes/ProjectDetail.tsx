import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { BlockGrid } from "@/components/blocks/BlockGrid";
import { Chip } from "@/components/blocks/Chip";
import { Eyebrow } from "@/components/blocks/Eyebrow";
import { Container } from "@/components/layout/Container";
import { Nav } from "@/components/layout/Nav";
import { ProjectFlowStepper } from "@/components/ProjectFlowStepper";
import { PhotoGuidance } from "@/components/uploads/PhotoGuidance";
import { PhotosDropzone } from "@/components/uploads/PhotosDropzone";
import { PipelineProgress } from "@/components/uploads/PipelineProgress";
import { PlansDropzone } from "@/components/uploads/PlansDropzone";
import { ApiError } from "@/lib/api";
import { relativeTime } from "@/lib/time";
import {
  photoRawUrl,
  type AgentName,
  type AgentRun,
  type AgentRunStatus,
  type DocumentRecord,
  type FinancePlan,
  type GapReport,
  type PlanClassification,
  type Project,
  type ProjectStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useFinancePlan, useCurrentMilestone } from "@/services/financePlan";
import { useDeletePhoto, usePhotos } from "@/services/photos";
import {
  useDeletePlan,
  usePlanClassification,
  usePlans,
} from "@/services/plans";
import { useProject } from "@/services/projects";
import { useCreateReport, useReports } from "@/services/reports";
import { useLatestRunByAgent } from "@/services/runs";

const TABS = [
  { key: "plans", label: "Plans" },
  { key: "finance", label: "Finance" },
  { key: "photos", label: "Photos" },
  { key: "reports", label: "Reports" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const AGENT_ORDER: AgentName[] = [
  "PlanClassifier",
  "PlanFormatExtractor",
  "PhotoGuidance",
  "PhotoQuality",
  "PhotoToPlanFormat",
  "ComparisonAndGap",
];

const AGENT_LABEL: Record<AgentName, string> = {
  PlanClassifier: "1 · Plan Classifier",
  PlanFormatExtractor: "2 · Plan Format",
  FinancePlanIngester: "3 · Finance Plan (legacy)",
  PhotoGuidance: "4 · Photo Guidance",
  PhotoQuality: "5 · Photo Quality",
  PhotoToPlanFormat: "6 · Photo → Format",
  ComparisonAndGap: "7 · Gap & Verdict",
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<TabKey>("plans");

  const projectQuery = useProject(id);

  return (
    <>
      <Nav />
      <Container className="py-14">
        <ProjectHeader
          project={projectQuery.data}
          isLoading={projectQuery.isLoading}
          isError={projectQuery.isError}
          errorText={projectQuery.error?.message}
        />

        {id && (
          <div className="mt-8">
            <ProjectFlowStepper projectId={id} />
          </div>
        )}

        {id && (
          <div className="mt-8">
            <VerificationBanner
              projectId={id}
              onOpenPhotos={() => setTab("photos")}
            />
          </div>
        )}

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
          <div>
            <TabBar current={tab} onChange={setTab} />
            <div className="mt-8">
              {id && tab === "plans" && <PlansTab projectId={id} />}
              {id && tab === "finance" && <FinanceTab projectId={id} />}
              {id && tab === "photos" && <PhotosTab projectId={id} />}
              {id && tab === "reports" && <ReportsTab projectId={id} />}
            </div>
          </div>
          {id && <AgentsRail projectId={id} />}
        </div>
      </Container>
    </>
  );
}

// ---------- verification banner ----------

function VerificationBanner({
  projectId,
  onOpenPhotos,
}: {
  projectId: string;
  onOpenPhotos: () => void;
}) {
  const milestone = useCurrentMilestone(projectId);
  const photos = usePhotos(projectId);

  if (!milestone.data) return null;
  const m = milestone.data;
  if (m.status === "verified" || m.status === "rejected") return null;

  const now = new Date();
  const start = new Date(m.plannedStartDate);
  const end = new Date(m.plannedCompletionDate);
  const daysUntilStart = Math.ceil(
    (start.getTime() - now.getTime()) / 86_400_000,
  );
  const daysPastEnd = Math.ceil(
    (now.getTime() - end.getTime()) / 86_400_000,
  );
  const photoCount = photos.data?.length ?? 0;

  let tone: "accent" | "warn" | "danger" | "muted";
  let eyebrow: string;
  let heading: string;
  let copy: string;

  if (daysUntilStart > 0) {
    tone = "muted";
    eyebrow = "Upcoming";
    heading = `Milestone ${m.sequence.toString().padStart(2, "0")} · ${m.name}`;
    copy = `Window opens in ${daysUntilStart} day${daysUntilStart === 1 ? "" : "s"}. You can stage photos early — they stay attached to the project.`;
  } else if (daysPastEnd > 0) {
    tone = "danger";
    eyebrow = "Overdue · verify now";
    heading = `Milestone ${m.sequence.toString().padStart(2, "0")} · ${m.name}`;
    copy = `Window closed ${daysPastEnd} day${daysPastEnd === 1 ? "" : "s"} ago. ${photoCount === 0 ? "No photos on file." : `${photoCount} photo${photoCount === 1 ? "" : "s"} on file.`} Capture outstanding shots immediately or the draw holds.`;
  } else {
    tone = photoCount === 0 ? "warn" : "accent";
    eyebrow = "Verify needed";
    heading = `Milestone ${m.sequence.toString().padStart(2, "0")} · ${m.name}`;
    const daysLeft = Math.max(
      1,
      Math.ceil((end.getTime() - now.getTime()) / 86_400_000),
    );
    copy =
      photoCount === 0
        ? `Window open · ${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining. No photos uploaded. The bank won't release $${m.trancheAmount.toLocaleString()} without capture.`
        : `Window open · ${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining. ${photoCount} photo${photoCount === 1 ? "" : "s"} in so far — verify shot list coverage on the Photos tab.`;
  }

  const accent =
    tone === "danger"
      ? "border-danger"
      : tone === "warn"
        ? "border-warn"
        : tone === "accent"
          ? "border-accent"
          : "border-line-strong";
  const eyebrowCls =
    tone === "danger"
      ? "text-danger"
      : tone === "warn"
        ? "text-warn"
        : tone === "accent"
          ? "text-accent"
          : "text-fg-dim";

  return (
    <div
      className={cn(
        "relative flex flex-wrap items-start justify-between gap-6 border border-line-strong bg-bg-1 p-6 lg:p-7",
      )}
    >
      <div
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-0.5", accent)}
      />
      <div className="max-w-2xl">
        <div
          className={cn(
            "inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em]",
            eyebrowCls,
          )}
        >
          <span aria-hidden className={cn("inline-block h-1.5 w-1.5", accent.replace("border-", "bg-"))} />
          {eyebrow}
        </div>
        <h3 className="mt-3 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-fg">
          {heading}
        </h3>
        <p className="mt-2 text-[13px] leading-[1.55] text-fg-dim">{copy}</p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">
          <span>{m.plannedStartDate.slice(0, 10)}</span>
          <span>↓</span>
          <span>{m.plannedCompletionDate.slice(0, 10)}</span>
          <span>· tranche ${m.trancheAmount.toLocaleString()}</span>
          <span>· release {m.plannedReleasePct}%</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenPhotos}
        className="inline-flex shrink-0 items-center gap-2.5 bg-accent px-5 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-all hover:bg-[#67e8f9] hover:shadow-[0_0_0_3px_rgba(34,211,238,0.18)]"
      >
        Open Photos ↗
      </button>
    </div>
  );
}

// ---------- header ----------

function ProjectHeader({
  project,
  isLoading,
  isError,
  errorText,
}: {
  project: Project | undefined;
  isLoading: boolean;
  isError: boolean;
  errorText?: string;
}) {
  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-3 w-40 bg-bg-2" />
        <div className="mt-6 h-12 w-2/3 bg-bg-2" />
        <div className="mt-3 h-3 w-1/3 bg-bg-1" />
      </div>
    );
  }
  if (isError || !project) {
    return (
      <div className="border-l-2 border-danger bg-bg-1 p-5">
        <div className="font-mono text-[10px] uppercase tracking-mono text-danger">
          Project unavailable
        </div>
        <p className="mt-2 font-mono text-[12px] text-fg-dim">
          {errorText ?? "Backend returned an error."}{" "}
          <Link to="/projects" className="underline">
            Back to projects
          </Link>
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-start justify-between gap-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <Eyebrow>Project</Eyebrow>
          <ProjectStatusChip status={project.status} />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
            · Viewing as · Bank / CRMC
          </span>
        </div>
        <h1 className="mt-4 font-extrabold leading-none tracking-tight2 text-fg text-[clamp(32px,4vw,64px)]">
          {project.name}
        </h1>
        <div className="mt-4 flex flex-wrap gap-x-10 gap-y-2 font-mono text-[11px] tracking-mono text-fg-dim">
          <span>
            Address{" "}
            <b className="ml-1 font-medium text-fg">
              {project.address ?? "—"}
            </b>
          </span>
          <span>
            Created{" "}
            <b className="ml-1 font-medium text-fg">
              {relativeTime(project.createdAt)}
            </b>
          </span>
          <span>
            ID{" "}
            <b className="ml-1 font-medium text-fg">
              {project._id.slice(-8)}
            </b>
          </span>
        </div>
      </div>
    </div>
  );
}

function ProjectStatusChip({ status }: { status: ProjectStatus }) {
  const tone =
    status === "ACTIVE" ? "accent" : status === "COMPLETED" ? "success" : "default";
  return <Chip tone={tone}>{status}</Chip>;
}

// ---------- tab bar ----------

function TabBar({
  current,
  onChange,
}: {
  current: TabKey;
  onChange: (k: TabKey) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Project sections"
      className="flex flex-wrap items-center gap-[2px] bg-[var(--line)]"
    >
      {TABS.map((t) => {
        const active = t.key === current;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              "min-w-[120px] px-5 py-3 text-left font-mono text-[11px] uppercase tracking-eyebrow transition-colors",
              active
                ? "bg-bg text-fg"
                : "bg-bg-1 text-fg-dim hover:bg-bg-2 hover:text-fg",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- plans tab ----------

function PlansTab({ projectId }: { projectId: string }) {
  const plans = usePlans(projectId);
  const classification = usePlanClassification(projectId);
  const hasClassification = Boolean(classification.data);

  return (
    <div className="space-y-10">
      <section>
        <SectionLabel>01 · Upload construction plans</SectionLabel>
        <PlansDropzone projectId={projectId} />
      </section>

      <section>
        <SectionLabel>02 · Pipeline progress</SectionLabel>
        <PipelineProgress projectId={projectId} />
      </section>

      <section>
        <SectionLabel>03 · Uploaded plan documents</SectionLabel>
        {plans.isLoading ? (
          <SkeletonRows count={3} />
        ) : plans.isError ? (
          <InlineError message={plans.error?.message ?? "Failed to load plans"} />
        ) : !plans.data || plans.data.length === 0 ? (
          <EmptyRow>NO PLANS UPLOADED · DROP PDFS ABOVE TO BEGIN</EmptyRow>
        ) : (
          <DocumentList projectId={projectId} docs={plans.data} />
        )}
      </section>

      {hasClassification && (
        <section>
          <SectionLabel>04 · Plan classification (Agent 1)</SectionLabel>
          <ClassificationSummary
            state="ready"
            classification={classification.data!}
          />
        </section>
      )}
    </div>
  );
}

function ClassificationSummary({
  state,
  classification,
  errorText,
}: {
  state: "loading" | "error" | "pending" | "ready";
  classification: PlanClassification | null;
  errorText?: string;
}) {
  if (state === "loading") return <SkeletonRows count={1} />;
  if (state === "error")
    return <InlineError message={errorText ?? "Failed to load classification"} />;
  if (state === "pending")
    return (
      <EmptyRow>
        Pipeline hasn&apos;t finished yet. Runs list will show when{" "}
        <code>PlanClassifier</code> and <code>PlanFormatExtractor</code>{" "}
        complete.
      </EmptyRow>
    );

  const byDiscipline = new Map<string, number>();
  for (const sheet of classification!.sheets) {
    byDiscipline.set(
      sheet.discipline,
      (byDiscipline.get(sheet.discipline) ?? 0) + 1,
    );
  }
  return (
    <div className="border border-line bg-bg-1 p-6">
      <div className="flex flex-wrap gap-x-10 gap-y-2 font-mono text-[11px] tracking-mono text-fg-dim">
        <span>
          Sheets <b className="ml-1 font-medium text-fg">{classification!.sheets.length}</b>
        </span>
        <span>
          Version <b className="ml-1 font-medium text-fg">v{classification!.version}</b>
        </span>
        <span>
          Extracted{" "}
          <b className="ml-1 font-medium text-fg">
            {relativeTime(classification!.extractedAt)}
          </b>
        </span>
      </div>
      <BlockGrid className="mt-6 grid-cols-2 lg:grid-cols-4">
        {Array.from(byDiscipline.entries()).map(([discipline, count]) => (
          <div key={discipline} className="bg-bg p-5">
            <div className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-muted">
              {discipline}
            </div>
            <div className="mt-2 text-3xl font-extrabold tracking-tight2">
              {count}
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-mono text-fg-muted">
              sheet{count === 1 ? "" : "s"}
            </div>
          </div>
        ))}
      </BlockGrid>
    </div>
  );
}

// ---------- finance tab ----------

function FinanceTab({ projectId }: { projectId: string }) {
  const finance = useFinancePlan(projectId);
  const classification = usePlanClassification(projectId);
  const current = useCurrentMilestone(projectId, {
    enabled: Boolean(finance.data),
  });

  if (finance.isLoading) return <SkeletonRows count={3} />;
  if (finance.isError)
    return <InlineError message={finance.error?.message ?? "Failed to load finance plan"} />;
  if (!finance.data)
    return (
      <NoFinancePlanCTA
        projectId={projectId}
        sheetCount={classification.data?.sheets.length}
      />
    );

  return (
    <div className="space-y-10">
      <FinancePlanSummary plan={finance.data} />
      <MilestonesTable
        plan={finance.data}
        currentMilestoneId={current.data?._id}
      />
    </div>
  );
}

function NoFinancePlanCTA({
  projectId,
  sheetCount,
}: {
  projectId: string;
  sheetCount: number | undefined;
}) {
  const plansReady = typeof sheetCount === "number" && sheetCount > 0;
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
            "radial-gradient(ellipse at center, rgba(34,211,238,0.08), transparent 65%)",
        }}
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
            <span aria-hidden className="inline-block h-1.5 w-1.5 bg-accent" />
            {plansReady ? "Next · Gantt builder" : "Blocked · upload plans"}
          </div>
          <h3 className="mt-3 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-fg lg:text-[28px]">
            {plansReady ? (
              <>
                No finance plan yet.
                <br className="hidden lg:block" />{" "}
                <span className="text-fg-dim">
                  Define time frames and pin docs per milestone.
                </span>
              </>
            ) : (
              <>
                Upload plans first.
                <br className="hidden lg:block" />{" "}
                <span className="text-fg-dim">
                  The Gantt builder pulls chips from classified sheets.
                </span>
              </>
            )}
          </h3>
          <p className="mt-3 text-[13px] leading-[1.55] text-fg-dim">
            {plansReady
              ? `Agents 1 and 2 finished — ${sheetCount} sheet${sheetCount === 1 ? "" : "s"} classified. In the Gantt builder you set each milestone's window and tranche, then drag the labeled sheets onto the rows that prove them. Publishing creates the finance plan and attaches the docs in one step.`
              : "The Gantt builder needs classified plan sheets to offer as draggable chips. Head to the Plans tab, drop the PDFs, wait for the pipeline, then come back here."}
          </p>
        </div>
        {plansReady ? (
          <Link
            to={`/projects/${projectId}/gantt`}
            className="inline-flex shrink-0 items-center gap-2.5 bg-accent px-6 py-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-all hover:bg-[#67e8f9] hover:shadow-[0_0_0_3px_rgba(34,211,238,0.18)]"
          >
            Open Gantt builder <span aria-hidden>↗</span>
          </Link>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-2.5 border border-line-strong bg-bg-1 px-6 py-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
            Plans tab required
          </span>
        )}
      </div>
    </div>
  );
}

function FinancePlanSummary({ plan }: { plan: FinancePlan }) {
  const stats: { label: string; value: string }[] = [
    { label: "Loan type", value: plan.loanType },
    { label: "Loan amount", value: formatUSD(plan.loanAmount) },
    { label: "Total budget", value: formatUSD(plan.totalBudget) },
    { label: "Retainage", value: `${plan.retainagePct}%` },
    {
      label: "Kickoff",
      value: plan.kickoffDate.slice(0, 10),
    },
    {
      label: "Completion",
      value: plan.requiredCompletionDate.slice(0, 10),
    },
    { label: "Milestones", value: String(plan.milestones.length) },
    { label: "SOV lines", value: String(plan.sov.length) },
  ];
  return (
    <section>
      <SectionLabel>01 · Finance plan</SectionLabel>
      <BlockGrid className="grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-bg p-5">
            <div className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-muted">
              {s.label}
            </div>
            <div className="mt-2 text-lg font-bold tracking-tight2 text-fg">
              {s.value}
            </div>
          </div>
        ))}
      </BlockGrid>
    </section>
  );
}

function MilestonesTable({
  plan,
  currentMilestoneId,
}: {
  plan: FinancePlan;
  currentMilestoneId?: string;
}) {
  return (
    <section>
      <SectionLabel>02 · Milestones</SectionLabel>
      <div className="border border-line">
        <div className="grid grid-cols-[40px_1fr_120px_120px_140px_120px] gap-px border-b border-line-strong bg-bg-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">
          <HeadCell>#</HeadCell>
          <HeadCell>Name</HeadCell>
          <HeadCell>Start</HeadCell>
          <HeadCell>Completion</HeadCell>
          <HeadCell>Tranche</HeadCell>
          <HeadCell>Status</HeadCell>
        </div>
        {plan.milestones.map((m) => {
          const isCurrent = m._id === currentMilestoneId;
          return (
            <div
              key={m._id}
              className={cn(
                "grid grid-cols-[40px_1fr_120px_120px_140px_120px] gap-px border-b border-line last:border-b-0",
                isCurrent ? "bg-bg-2" : "bg-bg-1",
              )}
            >
              <BodyCell>
                <span className="font-mono text-[11px] text-fg-dim">
                  {m.sequence}
                </span>
              </BodyCell>
              <BodyCell>
                <div className="font-medium text-fg">{m.name}</div>
                {isCurrent && (
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-mono text-accent">
                    ◆ current
                  </div>
                )}
              </BodyCell>
              <BodyCell>{m.plannedStartDate.slice(0, 10)}</BodyCell>
              <BodyCell>{m.plannedCompletionDate.slice(0, 10)}</BodyCell>
              <BodyCell>{formatUSD(m.trancheAmount)}</BodyCell>
              <BodyCell>
                <MilestoneStatusChip status={m.status} />
              </BodyCell>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HeadCell({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-3">{children}</div>;
}

function BodyCell({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-4 font-mono text-[12px] text-fg-dim">
      {children}
    </div>
  );
}

function MilestoneStatusChip({
  status,
}: {
  status: FinancePlan["milestones"][number]["status"];
}) {
  const tone: Parameters<typeof Chip>[0]["tone"] =
    status === "verified"
      ? "success"
      : status === "rejected"
        ? "danger"
        : status === "in_progress" || status === "claimed"
          ? "warn"
          : "default";
  return <Chip tone={tone}>{status}</Chip>;
}

// ---------- photos tab ----------

function PhotosTab({ projectId }: { projectId: string }) {
  const photos = usePhotos(projectId);
  const count = photos.data?.length ?? 0;

  return (
    <div className="space-y-10">
      <section>
        <SectionLabel>01 · Photo guidance (Agent 4)</SectionLabel>
        <PhotoGuidance projectId={projectId} />
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionLabel>02 · Upload jobsite photos</SectionLabel>
          <Link
            to={`/inspector/${projectId}`}
            className="inline-flex items-center gap-2 border border-line-strong px-3.5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-fg transition-colors hover:border-accent hover:bg-accent hover:text-black"
          >
            Open inspector capture ↗
          </Link>
        </div>
        <PhotosDropzone projectId={projectId} />
      </section>

      <section>
        <SectionLabel>
          03 · Photo stream{count > 0 ? ` · ${count}` : ""}
        </SectionLabel>
        {photos.isLoading ? (
          <SkeletonRows count={3} />
        ) : photos.isError ? (
          <InlineError
            message={photos.error?.message ?? "Failed to load photos"}
          />
        ) : !photos.data || photos.data.length === 0 ? (
          <EmptyRow>NO PHOTOS YET · UPLOAD TO BEGIN</EmptyRow>
        ) : (
          <PhotoGrid projectId={projectId} docs={photos.data} />
        )}
      </section>
    </div>
  );
}

function PhotoGrid({
  projectId,
  docs,
}: {
  projectId: string;
  docs: DocumentRecord[];
}) {
  const [error, setError] = useState<string | null>(null);
  const del = useDeletePhoto(projectId, {
    onSuccess: () => setError(null),
    onError: (err) => setError(`${err.status} · ${err.body.slice(0, 160)}`),
  });

  async function onDelete(doc: DocumentRecord) {
    if (del.isPending) return;
    if (
      !window.confirm(
        `Delete "${doc.originalFilename}"? This also removes its quality check, observation, and any in-flight analysis.`,
      )
    )
      return;
    setError(null);
    del.mutate({ photoId: doc._id });
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="border-l-2 border-danger bg-bg-1 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-danger">
          Error · {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-[2px] bg-[var(--line)] md:grid-cols-3 lg:grid-cols-4">
        {docs.map((d) => (
          <PhotoTile
            key={d._id}
            projectId={projectId}
            doc={d}
            onDelete={() => onDelete(d)}
            isDeleting={del.isPending && del.variables?.photoId === d._id}
          />
        ))}
      </div>
    </div>
  );
}

function PhotoTile({
  projectId,
  doc,
  onDelete,
  isDeleting,
}: {
  projectId: string;
  doc: DocumentRecord;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const hasGeo = Boolean(doc.exifMeta?.gps);
  const exifVerified = doc.exifMeta?.source === "exif_verified";
  const clientHinted = doc.exifMeta?.source === "client_hinted";
  const exifRecorded = doc.exifMeta?.present === true && !clientHinted;
  const exifMissing =
    doc.exifMeta?.present === false && !clientHinted;

  return (
    <div
      className={cn(
        "group relative block aspect-[4/3] overflow-hidden bg-bg-2",
        isDeleting && "opacity-50",
      )}
    >
      <Link
        to={`/projects/${projectId}/photos/${doc._id}`}
        className="absolute inset-0"
        aria-label={`Open ${doc.originalFilename}`}
      >
        <img
          src={photoRawUrl(projectId, doc._id)}
          alt={doc.originalFilename}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-opacity group-hover:opacity-80"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.78)] via-transparent to-transparent"
        />
      </Link>

      <div className="pointer-events-none absolute left-3 top-3 flex gap-1">
        {exifVerified && (
          <span className="border border-success/40 bg-[rgba(0,0,0,0.55)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-success">
            Exif ✓
          </span>
        )}
        {clientHinted && (
          <span className="border border-warn/40 bg-[rgba(0,0,0,0.55)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-warn">
            Client-hinted
          </span>
        )}
        {hasGeo && !exifVerified && !clientHinted && (
          <span className="border border-success/40 bg-[rgba(0,0,0,0.55)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-success">
            Geo ✓
          </span>
        )}
        {exifRecorded && !hasGeo && (
          <span className="border border-line-strong bg-[rgba(0,0,0,0.55)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-fg-dim">
            Exif
          </span>
        )}
        {exifMissing && (
          <span className="border border-warn/40 bg-[rgba(0,0,0,0.55)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-warn">
            No EXIF
          </span>
        )}
      </div>

      <div className="pointer-events-none absolute right-3 top-3 flex items-start gap-2">
        <span className="pointer-events-none border border-line-strong bg-[rgba(0,0,0,0.55)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-fg-dim opacity-100 transition-opacity group-hover:opacity-0">
          {doc.mimeType.replace("image/", "")}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          disabled={isDeleting}
          aria-label={`Delete ${doc.originalFilename}`}
          title="Delete photo"
          className="pointer-events-auto inline-flex items-center justify-center border border-[rgba(255,255,255,0.2)] bg-[rgba(0,0,0,0.6)] p-1.5 text-fg opacity-0 transition-opacity hover:border-danger hover:text-danger group-hover:opacity-100 disabled:opacity-60"
        >
          <Trash2 className="!size-3.5" strokeWidth={2} />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-3">
        <div className="truncate font-mono text-[11px] uppercase tracking-[0.12em] text-fg">
          {doc.originalFilename}
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">
          {relativeTime(doc.serverReceivedAt)}
        </div>
      </div>
    </div>
  );
}

// ---------- reports tab ----------

function ReportsTab({ projectId }: { projectId: string }) {
  const reports = useReports(projectId);
  const finance = useFinancePlan(projectId);
  const navigate = useNavigate();
  const createReport = useCreateReport(projectId, {
    onSuccess: (rep) => navigate(`/projects/${projectId}/reports/${rep._id}`),
  });

  const canGenerate = Boolean(finance.data && !createReport.isPending);

  return (
    <div className="space-y-10">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SectionLabel>01 · Generate a draw report</SectionLabel>
          <button
            type="button"
            disabled={!canGenerate}
            onClick={() => createReport.mutate({})}
            className="inline-flex items-center gap-2 bg-accent px-5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-colors hover:bg-[#67e8f9] disabled:bg-accent/60 disabled:cursor-not-allowed"
          >
            {createReport.isPending
              ? "CRMC drafting…"
              : "Generate report ↗"}
          </button>
        </div>
        {!finance.data && !finance.isLoading && (
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-fg-dim">
            Publish a finance plan first · Gantt builder → Publish
          </p>
        )}
        {createReport.isPending && (
          <div className="mt-4 border border-line bg-bg-1 p-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
              Agent 7 · Comparison &amp; Gap
            </div>
            <p className="mt-2 text-sm leading-[1.55] text-fg-dim">
              Aggregating plan elements, observations, and finance rules.
              Typically 30–60 seconds. You&apos;ll be taken to the report
              when it&apos;s ready.
            </p>
          </div>
        )}
        {createReport.isError && (
          <div className="mt-4 border-l-2 border-danger bg-bg-1 p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-danger">
              Error · {createReport.error?.status}
            </div>
            <p className="mt-1 font-mono text-[11px] text-fg-dim">
              {createReport.error?.body?.slice(0, 280)}
            </p>
          </div>
        )}
      </section>

      <section>
        <SectionLabel>02 · Prior reports</SectionLabel>
        {reports.isLoading ? (
          <SkeletonRows count={3} />
        ) : reports.isError ? (
          <InlineError
            message={reports.error?.message ?? "Failed to load reports"}
          />
        ) : !reports.data || reports.data.length === 0 ? (
          <EmptyRow>NO REPORTS YET · GENERATE ONE ABOVE</EmptyRow>
        ) : (
          <div className="border border-line">
            {reports.data.map((r) => (
              <ReportRow key={r._id} projectId={projectId} report={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ReportRow({
  projectId,
  report,
}: {
  projectId: string;
  report: GapReport;
}) {
  return (
    <Link
      to={`/projects/${projectId}/reports/${report._id}`}
      className="grid grid-cols-[1fr_auto_auto] items-center gap-6 border-b border-line bg-bg px-5 py-4 transition-colors last:border-b-0 hover:bg-bg-1"
    >
      <div>
        <div className="font-medium text-fg">
          {report.drawVerdict.reasoning.slice(0, 80) || "Gap report"}
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-mono text-fg-muted">
          {report.overallStatus} ·{" "}
          {report.drawId
            ? `Draw ${report.drawId.slice(-6)}`
            : `Milestone ${report.milestoneId.slice(-6)}`}{" "}
          · {relativeTime(report.generatedAt)}
        </div>
      </div>
      <VerdictChip verdict={report.drawVerdict.verdict} />
      <span aria-hidden className="font-mono text-[10px] text-fg-muted">
        ↗
      </span>
    </Link>
  );
}

function VerdictChip({
  verdict,
}: {
  verdict: GapReport["drawVerdict"]["verdict"];
}) {
  const tone: Parameters<typeof Chip>[0]["tone"] =
    verdict === "APPROVE"
      ? "success"
      : verdict === "APPROVE_WITH_CONDITIONS"
        ? "warn"
        : verdict === "HOLD"
          ? "warn"
          : "danger";
  return <Chip tone={tone}>{verdict.replace(/_/g, " ")}</Chip>;
}

// ---------- agents rail ----------

function AgentsRail({ projectId }: { projectId: string }) {
  const { data, latestByAgent, isLoading, isError } =
    useLatestRunByAgent(projectId);

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <SectionLabel>Agents</SectionLabel>
      <div className="border border-line bg-bg-1">
        {AGENT_ORDER.map((name) => {
          const run = latestByAgent.get(name);
          return <AgentRow key={name} name={name} run={run} />;
        })}
      </div>
      <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">
        {isLoading
          ? "Loading runs…"
          : isError
            ? "Runs unavailable"
            : `${data?.length ?? 0} total runs`}
      </div>
      <Link
        to={`/projects/${projectId}/runs`}
        className="mt-3 inline-flex items-center gap-[6px] font-mono text-[10px] uppercase tracking-eyebrow text-fg-dim transition-colors hover:text-fg"
      >
        Open run stream ↗
      </Link>
    </aside>
  );
}

function AgentRow({ name, run }: { name: AgentName; run: AgentRun | undefined }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="truncate font-mono text-[11px] uppercase tracking-mono text-fg">
          {AGENT_LABEL[name]}
        </div>
        <div className="mt-1 truncate font-mono text-[10px] text-fg-dim">
          {run
            ? `${relativeTime(run.startedAt)}${run.modelVersion ? " · " + run.modelVersion : ""}`
            : "no runs"}
        </div>
      </div>
      <AgentStatusDot status={run?.status} />
    </div>
  );
}

function AgentStatusDot({ status }: { status: AgentRunStatus | undefined }) {
  if (!status)
    return (
      <span
        aria-label="idle"
        className="inline-block h-[10px] w-[10px] border border-fg-muted"
      />
    );
  const cls =
    status === "running"
      ? "bg-warn animate-pulse"
      : status === "succeeded"
        ? "bg-success"
        : "bg-danger";
  return (
    <span
      aria-label={status}
      className={cn("inline-block h-[10px] w-[10px]", cls)}
    />
  );
}

// ---------- shared ----------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 font-mono text-[11px] uppercase tracking-eyebrow text-fg-dim">
      {children}
    </div>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse bg-bg-1" aria-hidden />
      ))}
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="border-l-2 border-danger bg-bg-1 p-4 font-mono text-[11px] text-fg-dim">
      {message}
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-line-strong bg-bg-1 p-6 font-mono text-[12px] leading-[1.6] text-fg-dim">
      {children}
    </div>
  );
}

function DocumentList({
  projectId,
  docs,
}: {
  projectId: string;
  docs: DocumentRecord[];
}) {
  const [error, setError] = useState<string | null>(null);
  const del = useDeletePlan(projectId, {
    onSuccess: () => setError(null),
    onError: (err) => setError(parsePlanDeleteError(err)),
  });

  async function onDelete(doc: DocumentRecord) {
    if (del.isPending) return;
    if (
      !window.confirm(
        `Delete "${doc.originalFilename}"? This also removes its classification and cancels any running analysis.`,
      )
    )
      return;
    setError(null);
    del.mutate({ docId: doc._id });
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="border-l-2 border-danger bg-bg-1 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-danger">
          Error · {error}
        </div>
      )}
      <div className="border border-line">
        {docs.map((d) => {
          const pending = del.isPending && del.variables?.docId === d._id;
          return (
            <div
              key={d._id}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-6 border-b border-line bg-bg-1 px-5 py-4 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-fg">
                  {d.originalFilename}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">
                  {d.kind} · {d.mimeType}
                </div>
              </div>
              <span className="font-mono text-[11px] text-fg-dim">
                {relativeTime(d.serverReceivedAt)}
              </span>
              <span className="font-mono text-[11px] text-fg-dim">
                …{d.sha256.slice(-8)}
              </span>
              <button
                type="button"
                onClick={() => onDelete(d)}
                disabled={pending}
                aria-label={`Delete ${d.originalFilename}`}
                title="Delete plan"
                className="inline-flex items-center justify-center border border-line-strong p-2 text-fg-dim transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
              >
                <Trash2 className="!size-3.5" strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function parsePlanDeleteError(err: ApiError): string {
  if (err.status === 409) {
    try {
      const body = JSON.parse(err.body) as { error?: string };
      if (body.error) return body.error;
    } catch {
      // fall through
    }
    return "Document is referenced by a milestone — edit the finance plan first.";
  }
  return `${err.status} · ${err.body.slice(0, 160)}`;
}

function formatUSD(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
