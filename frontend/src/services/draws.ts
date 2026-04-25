import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { api, type ApiError } from "@/lib/api";
import type {
  Draw,
  DrawLine,
  DrawVerification,
  PatchDrawLineRequest,
} from "@/lib/types";
import { queryKeys } from "@/services/queryKeys";

/**
 * Single draw. Polls every 2.5s while status === "parsing" so the
 * UI can walk UPLOADING… → PARSING… → READY TO REVIEW without a
 * manual refetch.
 */
export function useDraw(
  projectId: string | undefined,
  drawId: string | undefined,
  options?: Omit<
    UseQueryOptions<Draw, ApiError>,
    "queryKey" | "queryFn" | "enabled" | "refetchInterval"
  > & { enabled?: boolean },
) {
  return useQuery<Draw, ApiError>({
    queryKey: queryKeys.draws.detail(
      projectId ?? "__none__",
      drawId ?? "__none__",
    ),
    queryFn: () => api.getDraw(projectId as string, drawId as string),
    enabled: Boolean(projectId && drawId) && (options?.enabled ?? true),
    refetchInterval: (query) =>
      query.state.data?.status === "parsing" ? 2500 : false,
    ...options,
  });
}

/**
 * Latest approved Draw on the project, or null if none exists. Agent 4
 * (photo guidance) keys off this — the shot list verifies the most
 * recently approved G703.
 */
export function useLatestApprovedDraw(
  projectId: string | undefined,
  options?: Omit<
    UseQueryOptions<Draw | null, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  return useQuery<Draw | null, ApiError>({
    queryKey: queryKeys.draws.latestApproved(projectId ?? "__none__"),
    queryFn: async () => {
      const all = await api.listDraws(projectId as string);
      const approved = all
        .filter((d) => d.status === "approved")
        .sort((a, b) => {
          const ax = a.approvedAt ?? "";
          const bx = b.approvedAt ?? "";
          if (ax !== bx) return bx.localeCompare(ax);
          return b.drawNumber - a.drawNumber;
        });
      return approved[0] ?? null;
    },
    enabled: Boolean(projectId) && (options?.enabled ?? true),
    ...options,
  });
}

/**
 * Every draw on the project, backend-sorted newest drawNumber first.
 * Used by the contractor sidebar to show draw history regardless of
 * status. `useInProgressDraws` piggybacks on the same query via `select`.
 */
export function useDraws(
  projectId: string | undefined,
  options?: Omit<
    UseQueryOptions<Draw[], ApiError>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  return useQuery<Draw[], ApiError>({
    queryKey: queryKeys.draws.list(projectId ?? "__none__"),
    queryFn: () => api.listDraws(projectId as string),
    enabled: Boolean(projectId) && (options?.enabled ?? true),
    ...options,
  });
}

/**
 * Auto-resume: list all draws on the project, client-side filter to
 * in-progress states, newest-first. Backend doesn't support ?status
 * filtering, so we always fetch the full list.
 */
export function useInProgressDraws(
  projectId: string | undefined,
  options?: Omit<
    UseQueryOptions<Draw[], ApiError>,
    "queryKey" | "queryFn" | "enabled" | "select"
  > & { enabled?: boolean },
) {
  return useQuery<Draw[], ApiError>({
    queryKey: queryKeys.draws.list(projectId ?? "__none__"),
    queryFn: () => api.listDraws(projectId as string),
    enabled: Boolean(projectId) && (options?.enabled ?? true),
    select: (draws) =>
      draws
        .filter(
          (d) => d.status === "parsing" || d.status === "ready_for_review",
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ...options,
  });
}

/**
 * Per-line verdict for a draw: claimed $ vs verified $ vs photo evidence.
 * Pure read endpoint — joins Draw.lines + latest GapReport.sovLineFindings.
 */
export function useDrawVerification(
  projectId: string | undefined,
  drawId: string | undefined,
  options?: Omit<
    UseQueryOptions<DrawVerification, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  return useQuery<DrawVerification, ApiError>({
    queryKey: queryKeys.draws.verification(
      projectId ?? "__none__",
      drawId ?? "__none__",
    ),
    queryFn: () =>
      api.getDrawVerification(projectId as string, drawId as string),
    enabled: Boolean(projectId && drawId) && (options?.enabled ?? true),
    ...options,
  });
}

export type CreateDrawInput = {
  g703: File;
  g702?: File;
  periodStart?: string;
  periodEnd?: string;
};

export function useCreateDraw(
  projectId: string,
  options?: UseMutationOptions<Draw, ApiError, CreateDrawInput>,
) {
  const qc = useQueryClient();
  return useMutation<Draw, ApiError, CreateDrawInput>({
    mutationFn: (body) => api.uploadDraw(projectId, body),
    ...options,
    onSuccess: (draw, vars, ctx, meta) => {
      qc.setQueryData<Draw>(
        queryKeys.draws.detail(projectId, draw._id),
        draw,
      );
      qc.invalidateQueries({ queryKey: queryKeys.draws.list(projectId) });
      options?.onSuccess?.(draw, vars, ctx, meta);
    },
  });
}

export type PatchDrawLineInput = {
  lineIndex: number;
  patch: PatchDrawLineRequest;
};

/**
 * PATCH a single line's approvalStatus. Backend returns the updated
 * line; we splice it into the cached Draw so the UI re-renders from
 * the authoritative server state (no optimistic flicker when backend
 * back-fills confirmedMilestoneId).
 */
export function usePatchDrawLine(
  projectId: string,
  drawId: string,
  options?: UseMutationOptions<DrawLine, ApiError, PatchDrawLineInput>,
) {
  const qc = useQueryClient();
  return useMutation<DrawLine, ApiError, PatchDrawLineInput>({
    mutationFn: ({ lineIndex, patch }) =>
      api.patchDrawLine(projectId, drawId, lineIndex, patch),
    ...options,
    onSuccess: (updatedLine, vars, ctx, meta) => {
      qc.setQueryData<Draw | undefined>(
        queryKeys.draws.detail(projectId, drawId),
        (prev) =>
          prev
            ? {
                ...prev,
                lines: prev.lines.map((l, i) =>
                  i === vars.lineIndex ? updatedLine : l,
                ),
              }
            : prev,
      );
      options?.onSuccess?.(updatedLine, vars, ctx, meta);
    },
  });
}

export function useApproveDraw(
  projectId: string,
  drawId: string,
  options?: UseMutationOptions<Draw, ApiError, void>,
) {
  const qc = useQueryClient();
  return useMutation<Draw, ApiError, void>({
    mutationFn: () => api.approveDraw(projectId, drawId),
    ...options,
    onSuccess: (draw, vars, ctx, meta) => {
      qc.setQueryData<Draw>(
        queryKeys.draws.detail(projectId, drawId),
        draw,
      );
      qc.invalidateQueries({ queryKey: queryKeys.draws.list(projectId) });
      options?.onSuccess?.(draw, vars, ctx, meta);
    },
  });
}
