import { Link, useParams } from "react-router-dom";

import { Chip } from "@/components/blocks/Chip";
import { Eyebrow } from "@/components/blocks/Eyebrow";
import { Container } from "@/components/layout/Container";
import { Nav } from "@/components/layout/Nav";
import { relativeTime } from "@/lib/time";
import type { AgentRun, AgentRunStatus, UsageMeta } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useRuns } from "@/services/runs";

export default function Runs() {
  const { id } = useParams<{ id: string }>();
  const runs = useRuns(id);

  const totalTokens = (runs.data ?? []).reduce(
    (acc, r) => acc + totalUsageTokens(r.usage),
    0,
  );
  const running = (runs.data ?? []).filter((r) => r.status === "running").length;

  return (
    <>
      <Nav />
      <Container className="py-14">
        <header className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-8">
          <div>
            <Eyebrow>Project · {id?.slice(-8)}</Eyebrow>
            <h1 className="mt-4 font-extrabold leading-none tracking-tight2 text-fg text-[clamp(32px,4vw,64px)]">
              Agent runs
            </h1>
            <p className="mt-3 max-w-xl font-mono text-[11px] uppercase tracking-mono text-fg-muted">
              Live audit trail of every agent invocation on this project.
              Auto-polls every 5 s while anything is running.
            </p>
          </div>
          <div className="flex gap-10">
            <Stat
              label={running === 1 ? "agent running" : "agents running"}
              value={String(running)}
            />
            <Stat label="runs logged" value={String(runs.data?.length ?? 0)} />
            <Stat label="tokens spent" value={totalTokens.toLocaleString()} />
          </div>
        </header>

        <div className="mt-10">
          {runs.isLoading ? (
            <Skeleton />
          ) : runs.isError ? (
            <div className="border-l-2 border-danger bg-bg-1 p-5">
              <div className="font-mono text-[10px] uppercase tracking-mono text-danger">
                Failed to load runs
              </div>
              <p className="mt-2 font-mono text-[12px] text-fg-dim">
                {runs.error?.message}
              </p>
            </div>
          ) : !runs.data || runs.data.length === 0 ? (
            <div className="border border-dashed border-line-strong bg-bg-1 p-10 text-center">
              <Eyebrow>No runs yet</Eyebrow>
              <p className="mt-4 font-mono text-[12px] text-fg-dim">
                Upload a plan or a photo to kick off the pipeline.
              </p>
              {id && (
                <Link
                  to={`/projects/${id}`}
                  className="mt-6 inline-flex items-center gap-[6px] font-mono text-[10px] uppercase tracking-eyebrow text-fg transition-colors hover:text-accent"
                >
                  Back to project ↗
                </Link>
              )}
            </div>
          ) : (
            <RunsTable runs={runs.data} />
          )}
        </div>
      </Container>
    </>
  );
}

function RunsTable({ runs }: { runs: AgentRun[] }) {
  return (
    <div className="border border-line">
      <div className="hidden grid-cols-[200px_100px_130px_130px_150px_1fr] gap-px border-b border-line bg-bg-1 md:grid">
        <Head>Agent</Head>
        <Head>Status</Head>
        <Head>Started</Head>
        <Head>Duration</Head>
        <Head>Tokens (in / out)</Head>
        <Head>Model / error</Head>
      </div>
      {runs.map((r) => (
        <div
          key={r._id}
          className="grid grid-cols-1 gap-px border-b border-line last:border-b-0 md:grid-cols-[200px_100px_130px_130px_150px_1fr]"
        >
          <Cell>
            <span className="font-medium text-fg">{r.agentName}</span>
          </Cell>
          <Cell>
            <StatusBadge status={r.status} />
          </Cell>
          <Cell>{relativeTime(r.startedAt)}</Cell>
          <Cell>{formatDuration(r.startedAt, r.completedAt)}</Cell>
          <Cell>
            {r.usage ? (
              <span>
                {r.usage.inputTokens.toLocaleString()} /{" "}
                {r.usage.outputTokens.toLocaleString()}
              </span>
            ) : (
              <span className="text-fg-muted">—</span>
            )}
          </Cell>
          <Cell>
            {r.error ? (
              <span className="text-danger">{r.error.slice(0, 80)}</span>
            ) : (
              <span className="text-fg-muted">
                {r.modelVersion ?? r.usage?.model ?? "—"}
              </span>
            )}
          </Cell>
        </div>
      ))}
    </div>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 font-mono text-[10px] uppercase tracking-mono text-fg-muted">
      {children}
    </div>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg px-4 py-3 font-mono text-[12px] text-fg-dim">
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: AgentRunStatus }) {
  const tone =
    status === "running" ? "warn" : status === "succeeded" ? "success" : "danger";
  return (
    <Chip tone={tone} className={cn(status === "running" && "animate-pulse")}>
      {status}
    </Chip>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[24px] font-semibold tracking-tight2 text-fg">
        {value}
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-mono text-fg-muted">
        {label}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse bg-bg-1" aria-hidden />
      ))}
    </div>
  );
}

function totalUsageTokens(u: UsageMeta | undefined): number {
  if (!u) return 0;
  return u.inputTokens + u.outputTokens;
}

function formatDuration(startIso: string, endIso: string | undefined): string {
  if (!endIso) return "—";
  const deltaMs =
    new Date(endIso).getTime() - new Date(startIso).getTime();
  if (Number.isNaN(deltaMs)) return "—";
  if (deltaMs < 1000) return `${deltaMs}ms`;
  const s = Math.round(deltaMs / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}
