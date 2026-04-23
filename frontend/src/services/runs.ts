import { useMemo } from "react";
import {
  useQuery,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { api, type ApiError } from "@/lib/api";
import type { AgentName, AgentRun } from "@/lib/types";
import { queryKeys } from "@/services/queryKeys";

/**
 * AgentRun stream for a project.
 *
 * By default polls every 5 s while any run is `running`; when the list
 * settles (all terminal), polling stops to save bandwidth. Pass
 * `pollInterval={n}` to override, or `pollInterval={false}` to disable.
 */
export function useRuns(
  projectId: string | undefined,
  {
    pollInterval,
    ...options
  }: Omit<
    UseQueryOptions<AgentRun[], ApiError>,
    "queryKey" | "queryFn" | "enabled" | "refetchInterval"
  > & {
    enabled?: boolean;
    pollInterval?: number | false;
  } = {},
) {
  return useQuery<AgentRun[], ApiError>({
    queryKey: queryKeys.runs.list(projectId ?? "__none__"),
    queryFn: () => api.listRuns(projectId as string),
    enabled: Boolean(projectId) && (options.enabled ?? true),
    refetchInterval: (query) => {
      if (pollInterval === false) return false;
      const explicit = typeof pollInterval === "number" ? pollInterval : 5000;
      const runs = query.state.data;
      if (!runs || runs.length === 0) return explicit;
      return runs.some((r) => r.status === "running") ? explicit : false;
    },
    ...options,
  });
}

export function useRun(
  projectId: string | undefined,
  runId: string | undefined,
  options?: Omit<
    UseQueryOptions<AgentRun, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  return useQuery<AgentRun, ApiError>({
    queryKey: queryKeys.runs.detail(
      projectId ?? "__none__",
      runId ?? "__none__",
    ),
    queryFn: () => api.getRun(projectId as string, runId as string),
    enabled:
      Boolean(projectId) && Boolean(runId) && (options?.enabled ?? true),
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 2500 : false,
    ...options,
  });
}

/**
 * Pick the most recent run per agent name. Useful for a summary panel
 * that shows, for each of the seven agents, the latest status + duration.
 */
export function useLatestRunByAgent(
  projectId: string | undefined,
  opts: { pollInterval?: number | false } = {},
) {
  const { data, ...rest } = useRuns(projectId, opts);
  const latestByAgent = useMemo(() => {
    const out = new Map<AgentName, AgentRun>();
    if (!data) return out;
    // `data` comes back sorted startedAt desc — first occurrence wins.
    for (const run of data) {
      const key = run.agentName as AgentName;
      if (!out.has(key)) out.set(key, run);
    }
    return out;
  }, [data]);
  return { ...rest, data, latestByAgent };
}
