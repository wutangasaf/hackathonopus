import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import { ApiError } from "@/lib/api";
import { queryKeys } from "@/services/queryKeys";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export type SupervisorSeverity = "low" | "medium" | "high" | "critical";
export type SupervisorRecommendation =
  | "APPROVE"
  | "APPROVE_WITH_CONDITIONS"
  | "HOLD"
  | "REJECT";
export type SupervisorSessionStatus =
  | "running"
  | "idle"
  | "terminated"
  | "failed";

export type SupervisorStreamEvent =
  | { kind: "session_started"; managedSessionId: string; sessionId: string }
  | { kind: "agent_message"; text: string }
  | { kind: "agent_thinking" }
  | {
      kind: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      kind: "tool_result";
      toolUseId: string;
      name: string;
      isError: boolean;
      resultPreview: string;
    }
  | {
      kind: "builtin_tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      kind: "builtin_tool_result";
      toolUseId: string;
      isError: boolean;
      resultPreview: string;
    }
  | { kind: "session_error"; message: string }
  | {
      kind: "session_finished";
      stopReason: "end_turn" | "retries_exhausted" | "requires_action";
    };

export type SupervisorFinding = {
  _id: string;
  sessionId: string;
  projectId: string;
  drawId: string;
  severity: SupervisorSeverity;
  category: string;
  narrative: string;
  evidence: Array<{ kind: string; reference: string; note?: string }>;
  recommendation: SupervisorRecommendation;
  createdAt: string;
  updatedAt: string;
};

export type ReinspectionShot = {
  description: string;
  discipline?: string | null;
  referenceElementId?: string | null;
  angle?: string | null;
  lighting?: string | null;
  safety?: string | null;
};

export type ReinspectionRequest = {
  _id: string;
  sessionId: string;
  projectId: string;
  drawId: string;
  targetLineItems: string[];
  shots: ReinspectionShot[];
  narrative: string;
  dueBy?: string | null;
  status: "pending" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
};

export type SupervisorSession = {
  _id: string;
  projectId: string;
  drawId: string;
  managedSessionId: string;
  agentId: string;
  environmentId: string;
  title: string;
  status: SupervisorSessionStatus;
  error?: string | null;
  startedAt: string;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SupervisorSessionSnapshot = {
  session: SupervisorSession;
  findings: SupervisorFinding[];
  reinspections: ReinspectionRequest[];
};

export type StreamEnvelope =
  | { type: "connected" }
  | { type: "event"; event: SupervisorStreamEvent }
  | { type: "complete"; snapshot: SupervisorSessionSnapshot | null }
  | { type: "error"; message: string };

export async function getSupervisorSession(
  projectId: string,
  sessionId: string,
): Promise<SupervisorSessionSnapshot> {
  const res = await fetch(
    `${BASE}/api/projects/${projectId}/supervisor/sessions/${sessionId}`,
  );
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return (await res.json()) as SupervisorSessionSnapshot;
}

export function useSupervisorSession(
  projectId: string | undefined,
  sessionId: string | undefined,
  options?: Omit<
    UseQueryOptions<SupervisorSessionSnapshot, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  return useQuery<SupervisorSessionSnapshot, ApiError>({
    queryKey: queryKeys.supervisor.session(
      projectId ?? "__none__",
      sessionId ?? "__none__",
    ),
    queryFn: () =>
      getSupervisorSession(projectId as string, sessionId as string),
    enabled: Boolean(projectId && sessionId) && (options?.enabled ?? true),
    ...options,
  });
}

async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEnvelope> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIdx = buffer.indexOf("\n\n");
      while (sepIdx >= 0) {
        const frame = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        sepIdx = buffer.indexOf("\n\n");

        const dataLines = frame
          .split("\n")
          .filter((l) => l.startsWith("data: "))
          .map((l) => l.slice(6));
        if (dataLines.length === 0) continue;
        const payload = dataLines.join("\n");
        try {
          yield JSON.parse(payload) as StreamEnvelope;
        } catch {
          // skip malformed frame
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export type SupervisorInvestigationState = {
  status: "idle" | "connecting" | "running" | "finished" | "errored";
  events: SupervisorStreamEvent[];
  snapshot: SupervisorSessionSnapshot | null;
  error: string | null;
  managedSessionId: string | null;
  sessionId: string | null;
};

const INITIAL_STATE: SupervisorInvestigationState = {
  status: "idle",
  events: [],
  snapshot: null,
  error: null,
  managedSessionId: null,
  sessionId: null,
};

export function useSupervisorInvestigation(
  projectId: string | undefined,
  drawId: string | undefined,
) {
  const [state, setState] = useState<SupervisorInvestigationState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const start = useCallback(async () => {
    if (!projectId || !drawId) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setState({
      status: "connecting",
      events: [],
      snapshot: null,
      error: null,
      managedSessionId: null,
      sessionId: null,
    });

    try {
      const res = await fetch(
        `${BASE}/api/projects/${projectId}/supervisor/investigate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ drawId }),
          signal: ac.signal,
        },
      );
      if (!res.ok || !res.body) {
        const text = res.body ? await res.text() : "";
        throw new ApiError(res.status, text);
      }

      setState((s) => ({ ...s, status: "running" }));

      for await (const envelope of parseSseStream(res.body)) {
        if (ac.signal.aborted) return;
        if (envelope.type === "event") {
          const ev = envelope.event;
          setState((s) => {
            const next: Partial<SupervisorInvestigationState> = {
              events: [...s.events, ev],
            };
            if (ev.kind === "session_started") {
              next.managedSessionId = ev.managedSessionId;
              next.sessionId = ev.sessionId;
            }
            return { ...s, ...next };
          });
        } else if (envelope.type === "complete") {
          setState((s) => ({
            ...s,
            status: "finished",
            snapshot: envelope.snapshot,
          }));
        } else if (envelope.type === "error") {
          setState((s) => ({
            ...s,
            status: "errored",
            error: envelope.message,
          }));
        }
      }
      setState((s) =>
        s.status === "running" || s.status === "connecting"
          ? { ...s, status: "finished" }
          : s,
      );
    } catch (err) {
      if (ac.signal.aborted) return;
      setState((s) => ({
        ...s,
        status: "errored",
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [projectId, drawId]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return { state, start, reset };
}
