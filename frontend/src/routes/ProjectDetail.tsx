import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { BlockGrid } from "@/components/blocks/BlockGrid";
import { Chip } from "@/components/blocks/Chip";
import { Eyebrow } from "@/components/blocks/Eyebrow";
import { Container } from "@/components/layout/Container";
import { Nav } from "@/components/layout/Nav";
import { PipelineProgress } from "@/components/uploads/PipelineProgress";
import { PlansDropzone } from "@/components/uploads/PlansDropzone";
import { relativeTime } from "@/lib/time";
import type {
  AgentName,
  AgentRun,
  AgentRunStatus,
  DocumentRecord,
  FinancePlan,
  GapReport,
  PlanClassification,
  Project,
  ProjectStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useFinancePlan, useCurrentMilestone } from "@/services/financePlan";
import { usePhotos } from "@/services/photos";
import { usePlanClassification, usePlans } from "@/services/plans";
import { useProject } from "@/services/projects";
import { useReports } from "@/services/reports";
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
    <div>
      <div className="flex items-center gap-3">
        <Eyebrow>Project</Eyebrow>
        <ProjectStatusChip status={project.status} />
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
          ID <b className="ml-1 font-medium text-fg">{project._id.slice(-8)}</b>
        </span>
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
          <DocumentList docs={plans.data} />
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
  const current = useCurrentMilestone(projectId, {
    enabled: Boolean(finance.data),
  });

  if (finance.isLoading) return <SkeletonRows count={3} />;
  if (finance.isError)
    return <InlineError message={finance.error?.message ?? "Failed to load finance plan"} />;
  if (!finance.data)
    return (
      <EmptyRow>
        No finance plan yet. The Gantt Builder (POST{" "}
        <code>/finance-plan</code>) ships in the next turn; for now you can POST
        the JSON directly.
      </EmptyRow>
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
        <div className="grid grid-cols-[40px_1fr_120px_120px_140px_120px] gap-px border-b border-line bg-bg-1 font-mono text-[10px] uppercase tracking-mono text-fg-muted">
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
                isCurrent ? "bg-bg-1" : "bg-bg",
              )}
            >
              <BodyCell>
                <span className="font-mono text-[11px] text-fg-muted">
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

  return (
    <section>
      <SectionLabel>01 · Uploaded photos</SectionLabel>
      {photos.isLoading ? (
        <SkeletonRows count={3} />
      ) : photos.isError ? (
        <InlineError message={photos.error?.message ?? "Failed to load photos"} />
      ) : !photos.data || photos.data.length === 0 ? (
        <EmptyRow>
          No photos uploaded yet. Photo upload + thumbnail grid land in the next
          turn.
        </EmptyRow>
      ) : (
        <DocumentList docs={photos.data} />
      )}
    </section>
  );
}

// ---------- reports tab ----------

function ReportsTab({ projectId }: { projectId: string }) {
  const reports = useReports(projectId);

  return (
    <section>
      <SectionLabel>01 · Draw reports</SectionLabel>
      {reports.isLoading ? (
        <SkeletonRows count={3} />
      ) : reports.isError ? (
        <InlineError message={reports.error?.message ?? "Failed to load reports"} />
      ) : !reports.data || reports.data.length === 0 ? (
        <EmptyRow>
          No draw reports yet. Agent 7 runs synchronously (30–60 s); trigger one
          from the next-turn UI, or POST <code>/reports</code> now.
        </EmptyRow>
      ) : (
        <div className="border border-line">
          {reports.data.map((r) => (
            <ReportRow key={r._id} projectId={projectId} report={r} />
          ))}
        </div>
      )}
    </section>
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
          {report.overallStatus} · Milestone {report.milestoneId.slice(-6)} ·{" "}
          {relativeTime(report.generatedAt)}
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
      <div className="mt-3 font-mono text-[10px] uppercase tracking-mono text-fg-muted">
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
        <div className="mt-1 truncate font-mono text-[10px] text-fg-muted">
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

function DocumentList({ docs }: { docs: DocumentRecord[] }) {
  return (
    <div className="border border-line">
      {docs.map((d) => (
        <div
          key={d._id}
          className="grid grid-cols-[1fr_auto_auto] items-center gap-6 border-b border-line bg-bg px-5 py-4 last:border-b-0"
        >
          <div className="min-w-0">
            <div className="truncate font-medium text-fg">
              {d.originalFilename}
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-mono text-fg-muted">
              {d.kind} · {d.mimeType}
            </div>
          </div>
          <span className="font-mono text-[10px] text-fg-muted">
            {relativeTime(d.serverReceivedAt)}
          </span>
          <span className="font-mono text-[10px] text-fg-muted">
            …{d.sha256.slice(-8)}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatUSD(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
