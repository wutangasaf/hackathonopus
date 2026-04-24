import { useEffect, useMemo, useRef } from "react";

import {
  useSupervisorInvestigation,
  type ReinspectionRequest,
  type SupervisorFinding,
  type SupervisorStreamEvent,
} from "@/services/supervisor";

export type InvestigationPanelProps = {
  projectId: string;
  drawId: string;
  drawNumber?: number;
  onClose: () => void;
};

const RECOMMENDATION_LABEL: Record<string, string> = {
  APPROVE: "Approve",
  APPROVE_WITH_CONDITIONS: "Approve with conditions",
  HOLD: "Hold · re-inspect",
  REJECT: "Reject",
};

const SEVERITY_COLORS: Record<string, string> = {
  low: "text-fg-dim border-line-strong",
  medium: "text-accent border-accent/50",
  high: "text-accent border-accent",
  critical: "text-danger border-danger",
};

const RECOMMENDATION_COLORS: Record<string, string> = {
  APPROVE: "text-success border-success/50 bg-bg-2",
  APPROVE_WITH_CONDITIONS: "text-accent border-accent/50 bg-bg-2",
  HOLD: "text-accent border-accent bg-bg-2",
  REJECT: "text-danger border-danger bg-bg-2",
};

export function InvestigationPanel(props: InvestigationPanelProps) {
  const { projectId, drawId, drawNumber, onClose } = props;
  const { state, start } = useSupervisorInvestigation(projectId, drawId);

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void start();
  }, [start]);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [state.events.length, state.status]);

  const finding = state.snapshot?.findings[0];
  const reinspection = state.snapshot?.reinspections[0];

  const statusLabel = useMemo(() => {
    switch (state.status) {
      case "idle":
        return "Idle";
      case "connecting":
        return "Connecting…";
      case "running":
        return "Investigating live";
      case "finished":
        return "Idle · complete";
      case "errored":
        return "Error";
    }
  }, [state.status]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="flex-1 bg-black/70"
        onClick={onClose}
        aria-label="Close investigation"
      />
      <aside className="flex h-full w-full max-w-[720px] flex-col border-l border-line-strong bg-bg text-fg shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-line-strong px-6 py-5">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-muted">
              Supervisor · Claude Managed Agents
            </div>
            <h2 className="mt-1 font-mono text-[18px] font-semibold tracking-tight text-fg">
              Draw{drawNumber !== undefined ? ` #${drawNumber}` : ""} · investigation
            </h2>
            <div className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
              <StatusDot status={state.status} />
              <span>{statusLabel}</span>
              {state.managedSessionId && (
                <span className="text-fg-muted">
                  · session {state.managedSessionId.slice(0, 12)}…
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-dim hover:text-fg"
          >
            Close ✕
          </button>
        </header>

        <div ref={scrollerRef} className="flex-1 overflow-y-auto px-6 py-5">
          {finding && (
            <VerdictCard finding={finding} reinspection={reinspection ?? null} />
          )}

          {state.error && (
            <div className="mb-4 border-l-2 border-danger bg-bg-1 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-danger">
              {state.error}
            </div>
          )}

          {state.events.length === 0 && state.status !== "errored" && (
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-muted">
              Waiting for agent…
            </div>
          )}

          <ol className="flex flex-col gap-3">
            {state.events.map((ev, idx) => (
              <EventCard key={idx} event={ev} />
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}

function StatusDot({
  status,
}: {
  status: "idle" | "connecting" | "running" | "finished" | "errored";
}) {
  const cls =
    status === "running" || status === "connecting"
      ? "bg-accent animate-pulse"
      : status === "finished"
        ? "bg-success"
        : status === "errored"
          ? "bg-danger"
          : "bg-fg-muted";
  return <span className={`h-1.5 w-1.5 rounded-full ${cls}`} aria-hidden />;
}

function EventCard({ event }: { event: SupervisorStreamEvent }) {
  if (event.kind === "session_started") {
    return (
      <li className="border-l-2 border-line-strong bg-bg-1 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted">
        Managed session opened
      </li>
    );
  }
  if (event.kind === "agent_thinking") {
    return (
      <li className="px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted">
        · thinking
      </li>
    );
  }
  if (event.kind === "agent_message") {
    return (
      <li className="border-l-2 border-accent bg-bg-1 px-4 py-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-muted">
          Inspector
        </div>
        <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-fg">
          {event.text}
        </p>
      </li>
    );
  }
  if (event.kind === "tool_use") {
    return (
      <li className="border border-line-strong bg-bg-2 px-4 py-3">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-fg-dim">
          <span>Tool call · {event.name}</span>
          <span className="text-fg-muted">{event.id.slice(0, 8)}</span>
        </div>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-fg-dim">
          {safeStringify(event.input)}
        </pre>
      </li>
    );
  }
  if (event.kind === "tool_result") {
    return (
      <li
        className={`border-l-2 bg-bg-1 px-4 py-3 ${
          event.isError ? "border-danger" : "border-success"
        }`}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-muted">
          Result · {event.name} {event.isError && "· error"}
        </div>
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-fg-dim">
          {event.resultPreview}
        </pre>
      </li>
    );
  }
  if (event.kind === "builtin_tool_use") {
    return (
      <li className="border border-line-strong bg-bg-2 px-4 py-3">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-fg-dim">
          <span>Built-in · {event.name}</span>
          <span className="text-fg-muted">{event.id.slice(0, 8)}</span>
        </div>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-fg-dim">
          {safeStringify(event.input)}
        </pre>
      </li>
    );
  }
  if (event.kind === "builtin_tool_result") {
    return (
      <li
        className={`border-l-2 bg-bg-1 px-4 py-3 ${
          event.isError ? "border-danger" : "border-fg-muted"
        }`}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-muted">
          Built-in result {event.isError && "· error"}
        </div>
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-fg-dim">
          {event.resultPreview}
        </pre>
      </li>
    );
  }
  if (event.kind === "session_error") {
    return (
      <li className="border-l-2 border-danger bg-bg-1 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-danger">
        Session error · {event.message}
      </li>
    );
  }
  if (event.kind === "session_finished") {
    return (
      <li className="border-l-2 border-line-strong bg-bg-1 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-muted">
        Session finished · {event.stopReason}
      </li>
    );
  }
  return null;
}

function VerdictCard({
  finding,
  reinspection,
}: {
  finding: SupervisorFinding;
  reinspection: ReinspectionRequest | null;
}) {
  const severityCls =
    SEVERITY_COLORS[finding.severity] ?? "text-fg-dim border-line-strong";
  const recommendationCls =
    RECOMMENDATION_COLORS[finding.recommendation] ??
    "text-fg-dim border-line-strong bg-bg-2";
  return (
    <div className="mb-5 border border-line-strong bg-bg-1">
      <div className="flex items-center justify-between border-b border-line-strong px-4 py-3">
        <span
          className={`inline-flex items-center gap-2 border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] ${severityCls}`}
        >
          Severity · {finding.severity}
        </span>
        <span
          className={`inline-flex items-center gap-2 border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] ${recommendationCls}`}
        >
          {RECOMMENDATION_LABEL[finding.recommendation] ?? finding.recommendation}
        </span>
      </div>
      <div className="px-4 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-muted">
          Category · {finding.category}
        </div>
        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-fg">
          {finding.narrative}
        </p>
        {finding.evidence.length > 0 && (
          <div className="mt-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-muted">
              Evidence
            </div>
            <ul className="mt-2 flex flex-col gap-1 font-mono text-[11px] leading-relaxed text-fg-dim">
              {finding.evidence.map((e, i) => (
                <li key={i}>
                  <span className="text-accent">· {e.kind}</span>{" "}
                  <span className="text-fg">{e.reference}</span>
                  {e.note && <span className="text-fg-muted"> — {e.note}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {reinspection && (
        <div className="border-t border-line-strong px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-muted">
              Re-inspection request · {reinspection.shots.length} shot
              {reinspection.shots.length === 1 ? "" : "s"}
            </span>
            {reinspection.dueBy && (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
                Due {new Date(reinspection.dueBy).toLocaleString()}
              </span>
            )}
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-fg">
            {reinspection.narrative}
          </p>
          <ol className="mt-3 flex flex-col gap-2">
            {reinspection.shots.map((shot, i) => (
              <li
                key={i}
                className="border-l-2 border-accent/60 bg-bg-2 px-3 py-2 font-mono text-[11px] leading-relaxed text-fg"
              >
                <span className="text-fg-muted">
                  Shot {String(i + 1).padStart(2, "0")} ·{" "}
                </span>
                {shot.description}
                {(shot.angle || shot.lighting || shot.safety) && (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.12em] text-fg-muted">
                    {shot.angle && <span>angle · {shot.angle}</span>}
                    {shot.lighting && <span>light · {shot.lighting}</span>}
                    {shot.safety && <span>safety · {shot.safety}</span>}
                  </div>
                )}
              </li>
            ))}
          </ol>
          {reinspection.targetLineItems.length > 0 && (
            <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted">
              Targets · {reinspection.targetLineItems.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
