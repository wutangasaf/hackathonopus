import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { api, type ApiError } from "@/lib/api";
import type { GapReport } from "@/lib/types";
import { queryKeys } from "@/services/queryKeys";

export function useReports(
  projectId: string | undefined,
  options?: Omit<
    UseQueryOptions<GapReport[], ApiError>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  return useQuery<GapReport[], ApiError>({
    queryKey: queryKeys.reports.list(projectId ?? "__none__"),
    queryFn: () => api.listReports(projectId as string),
    enabled: Boolean(projectId) && (options?.enabled ?? true),
    ...options,
  });
}

export function useReport(
  projectId: string | undefined,
  reportId: string | undefined,
  options?: Omit<
    UseQueryOptions<GapReport, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  return useQuery<GapReport, ApiError>({
    queryKey: queryKeys.reports.detail(
      projectId ?? "__none__",
      reportId ?? "__none__",
    ),
    queryFn: () =>
      api.getReport(projectId as string, reportId as string),
    enabled:
      Boolean(projectId) && Boolean(reportId) && (options?.enabled ?? true),
    ...options,
  });
}

export type CreateReportInput = { milestoneId?: string };

/**
 * Generate a new Gap Report. Synchronous, 30–60s — the UI must show a
 * "CRMC drafting…" skeleton while pending. On success, invalidates the
 * reports list and navigates are typically done by the caller.
 */
export function useCreateReport(
  projectId: string,
  options?: UseMutationOptions<GapReport, ApiError, CreateReportInput>,
) {
  const qc = useQueryClient();
  return useMutation<GapReport, ApiError, CreateReportInput>({
    mutationFn: (input) => api.createReport(projectId, input),
    ...options,
    onSuccess: (data, vars, ctx, meta) => {
      qc.invalidateQueries({
        queryKey: queryKeys.reports.list(projectId),
      });
      options?.onSuccess?.(data, vars, ctx, meta);
    },
  });
}
