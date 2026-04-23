import { Link, useParams } from "react-router-dom";

import { Chip } from "@/components/blocks/Chip";
import { Eyebrow } from "@/components/blocks/Eyebrow";
import { Container } from "@/components/layout/Container";
import { Nav } from "@/components/layout/Nav";
import { relativeTime } from "@/lib/time";
import type {
  DrawVerdictValue,
  GapReport,
  OverallStatus,
  PerElementStatus,
  SovFlag,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useReport } from "@/services/reports";

export default function Report() {
  const { id, reportId } = useParams<{ id: string; reportId: string }>();
  const report = useReport(id, reportId);

  return (
    <>
      <Nav />
      <Container className="py-12">
        <div className="mb-8 flex flex-wrap items-center gap-6">
          <Link
            to={`/projects/${id}`}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim transition-colors hover:text-fg"
          >
            ← Back to project
          </Link>
          {reportId && (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-muted">
              Report · {reportId.slice(-8)}
            </span>
          )}
        </div>

        {report.isLoading ? (
          <Skeleton />
        ) : report.isError || !report.data ? (
          <div className="border-l-2 border-danger bg-bg-1 p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-danger">
              Error · could not load report
            </div>
            <p className="mt-2 font-mono text-[12px] text-fg-dim">
              {report.error?.message ?? "not found"}
            </p>
          </div>
        ) : (
          <ReportBody report={report.data} />
        )}
      </Container>
    </>
  );
}

function ReportBody({ report }: { report: GapReport }) {
  return (
    <div className="space-y-10">
      <VerdictHeader report={report} />
      <PerElementMatrix report={report} />
      <SovFindings report={report} />
      {report.unapprovedDeviations.length > 0 && (
        <UnapprovedDeviations items={report.unapprovedDeviations} />
      )}
      <Narrative report={report} />
      <VerdictDetails report={report} />
    </div>
  );
}

// ---------- verdict header ----------

function VerdictHeader({ report }: { report: GapReport }) {
  return (
    <section className="border border-line-strong bg-bg-1 p-8">
      <div className="flex flex-wrap items-start justify-between gap-8">
        <div>
          <Eyebrow>Draw verdict</Eyebrow>
          <h1 className="mt-4 text-[clamp(34px,4.4vw,60px)] font-extrabold leading-none tracking-[-0.035em]">
            Milestone {report.milestoneId.slice(-6)}
          </h1>
          <div className="mt-4 flex flex-wrap gap-6 font-mono text-[11px] tracking-[0.1em] text-fg-dim">
            <span>
              Generated{" "}
              <b className="font-medium text-fg">
                {relativeTime(report.generatedAt)}
              </b>
            </span>
            <span>
              Overall{" "}
              <OverallChip status={report.overallStatus} />
            </span>
            {typeof report.daysOffset === "number" && (
              <span>
                Days offset{" "}
                <b
                  className={cn(
                    "ml-1 font-medium",
                    report.daysOffset >= 0 ? "text-fg" : "text-warn",
                  )}
                >
                  {report.daysOffset >= 0
                    ? `+${report.daysOffset}`
                    : report.daysOffset}
                </b>
              </span>
            )}
            <span>
              Loan in balance{" "}
              <b
                className={cn(
                  "ml-1 font-medium",
                  report.loanInBalance ? "text-success" : "text-danger",
                )}
              >
                {report.loanInBalance ? "YES" : "NO"}
              </b>
            </span>
          </div>
        </div>
        <div className="flex min-w-[280px] flex-col items-end gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
            Verdict
          </span>
          <VerdictTag verdict={report.drawVerdict.verdict} />
          {typeof report.remainingBudget === "number" && (
            <span className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-fg-muted">
              Remaining budget
            </span>
          )}
          {typeof report.remainingBudget === "number" && (
            <span className="text-[28px] font-extrabold leading-none tracking-[-0.03em]">
              {formatUSD(report.remainingBudget)}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------- per-element matrix ----------

function PerElementMatrix({ report }: { report: GapReport }) {
  if (report.perElement.length === 0) {
    return (
      <section>
        <Eyebrow>Per-element findings</Eyebrow>
        <div className="mt-4 border border-dashed border-line-strong bg-bg-1 p-6 font-mono text-[11px] uppercase tracking-[0.12em] text-fg-muted">
          No per-element findings on this report.
        </div>
      </section>
    );
  }
  return (
    <section>
      <Eyebrow>Per-element findings · {report.perElement.length}</Eyebrow>
      <div className="mt-4 border border-line">
        <div className="grid grid-cols-[120px_1fr_120px_1fr] gap-px border-b border-line-strong bg-bg-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-muted">
          <HCell>Discipline</HCell>
          <HCell>Element</HCell>
          <HCell>Status</HCell>
          <HCell>Citations</HCell>
        </div>
        {report.perElement.map((pe, i) => (
          <div
            key={`${pe.elementId}-${i}`}
            className="grid grid-cols-[120px_1fr_120px_1fr] gap-px border-b border-line last:border-b-0"
          >
            <Cell>{pe.discipline}</Cell>
            <Cell>
              <div className="font-medium text-fg">{pe.elementId}</div>
              <div className="mt-1 truncate text-fg-muted">
                plan · {pe.plannedState}
              </div>
              <div className="truncate text-fg-muted">
                observed · {String(pe.observedState)}
              </div>
            </Cell>
            <Cell>
              <StatusChip status={pe.status} />
            </Cell>
            <Cell className="whitespace-normal">
              {pe.citations.length === 0 ? (
                <span className="text-fg-muted">—</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {pe.citations.map((c, j) => (
                    <span
                      key={j}
                      className="border border-line-strong px-1.5 py-0.5 text-fg-dim"
                    >
                      …{c.slice(-8)}
                    </span>
                  ))}
                </div>
              )}
            </Cell>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- sov findings ----------

function SovFindings({ report }: { report: GapReport }) {
  if (report.sovLineFindings.length === 0) return null;
  return (
    <section>
      <Eyebrow>G703 line findings · {report.sovLineFindings.length}</Eyebrow>
      <div className="mt-4 border border-line">
        <div className="grid grid-cols-[80px_1fr_100px_100px_100px_100px] gap-px border-b border-line-strong bg-bg-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-muted">
          <HCell>Line</HCell>
          <HCell>Flag</HCell>
          <HCell>Claimed %</HCell>
          <HCell>Observed %</HCell>
          <HCell>Variance</HCell>
          <HCell>Photos</HCell>
        </div>
        {report.sovLineFindings.map((s, i) => (
          <div
            key={`${s.sovLineNumber}-${i}`}
            className="grid grid-cols-[80px_1fr_100px_100px_100px_100px] gap-px border-b border-line last:border-b-0"
          >
            <Cell>
              <span className="font-medium text-fg">{s.sovLineNumber}</span>
            </Cell>
            <Cell>
              <SovFlagChip flag={s.flag} />
            </Cell>
            <Cell>{s.claimedPct}%</Cell>
            <Cell>{s.observedPct}%</Cell>
            <Cell
              className={cn(
                s.variance < 0 ? "text-danger" : "text-fg-dim",
              )}
            >
              {s.variance > 0 ? "+" : ""}
              {s.variance}%
            </Cell>
            <Cell>{s.evidencePhotoIds.length}</Cell>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- unapproved deviations ----------

function UnapprovedDeviations({ items }: { items: string[] }) {
  return (
    <section>
      <Eyebrow>Unapproved scope deviations · {items.length}</Eyebrow>
      <ul className="mt-4 flex flex-col gap-2">
        {items.map((d, i) => (
          <li
            key={i}
            className="border-l-2 border-danger bg-bg-1 p-4 text-sm leading-[1.55] text-fg"
          >
            <span className="mr-3 font-mono text-[10px] uppercase tracking-[0.14em] text-danger">
              Deviation {String(i + 1).padStart(2, "0")}
            </span>
            {d}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- narrative ----------

function Narrative({ report }: { report: GapReport }) {
  return (
    <section>
      <Eyebrow>Narrative · CRMC draft</Eyebrow>
      <div className="mt-4 border-l-2 border-accent bg-bg-1 px-8 py-6">
        <p className="whitespace-pre-wrap text-base leading-[1.7] text-fg">
          {report.narrative}
        </p>
      </div>
    </section>
  );
}

// ---------- verdict reasoning + conditions ----------

function VerdictDetails({ report }: { report: GapReport }) {
  const v = report.drawVerdict;
  return (
    <section>
      <Eyebrow>Verdict reasoning</Eyebrow>
      <div className="mt-4 space-y-5 border border-line-strong bg-bg-1 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <VerdictTag verdict={v.verdict} />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted">
            Model · {report.modelVersion}
          </span>
        </div>
        <p className="text-base leading-[1.65] text-fg">{v.reasoning}</p>

        {v.conditions && v.conditions.length > 0 && (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
              Conditions
            </div>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-fg-dim">
              {v.conditions.map((c, i) => (
                <li key={i}>· {c}</li>
              ))}
            </ul>
          </div>
        )}

        {v.missingRequirements && v.missingRequirements.length > 0 && (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-danger">
              Missing requirements
            </div>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-fg-dim">
              {v.missingRequirements.map((c, i) => (
                <li key={i}>· {c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------- chips + cells ----------

function VerdictTag({ verdict }: { verdict: DrawVerdictValue }) {
  const cls =
    verdict === "APPROVE"
      ? "border-success/40 bg-success/10 text-success"
      : verdict === "APPROVE_WITH_CONDITIONS"
        ? "border-warn/40 bg-warn/10 text-warn"
        : verdict === "HOLD"
          ? "border-warn/40 bg-warn/10 text-warn"
          : "border-danger/40 bg-danger/10 text-danger";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 border px-3.5 py-1.5 font-mono text-[12px] uppercase tracking-[0.14em]",
        cls,
      )}
    >
      {verdict.replace(/_/g, " ")}
    </span>
  );
}

function OverallChip({ status }: { status: OverallStatus }) {
  const tone: Parameters<typeof Chip>[0]["tone"] =
    status === "ON_TRACK"
      ? "success"
      : status === "BEHIND"
        ? "warn"
        : "danger";
  return <Chip tone={tone}>{status.replace(/_/g, " ")}</Chip>;
}

function StatusChip({ status }: { status: PerElementStatus }) {
  const tone: Parameters<typeof Chip>[0]["tone"] =
    status === "VERIFIED"
      ? "success"
      : status === "PARTIAL"
        ? "warn"
        : status === "DEVIATED"
          ? "danger"
          : status === "MISSING"
            ? "danger"
            : "default";
  return <Chip tone={tone}>{status}</Chip>;
}

function SovFlagChip({ flag }: { flag: SovFlag }) {
  const tone: Parameters<typeof Chip>[0]["tone"] =
    flag === "ok"
      ? "success"
      : flag === "minor"
        ? "warn"
        : flag === "material"
          ? "danger"
          : "danger";
  return <Chip tone={tone}>{flag.replace(/_/g, " ")}</Chip>;
}

function HCell({ children }: { children: React.ReactNode }) {
  return <div className="bg-bg-1 px-3 py-2">{children}</div>;
}

function Cell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-bg px-3 py-3 font-mono text-[11px] text-fg-dim",
        className,
      )}
    >
      {children}
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

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="h-36 animate-pulse bg-bg-1" />
      <div className="h-64 animate-pulse bg-bg-1" />
      <div className="h-32 animate-pulse bg-bg-1" />
    </div>
  );
}
