import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { api, type ApiError } from "@/lib/api";
import type {
  CreateFinancePlanRequest,
  FinancePlan,
  Milestone,
  PatchMilestoneRequest,
} from "@/lib/types";
import { queryKeys } from "@/services/queryKeys";

export function useFinancePlan(
  projectId: string | undefined,
  options?: Omit<
    UseQueryOptions<FinancePlan | null, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  return useQuery<FinancePlan | null, ApiError>({
    queryKey: queryKeys.financePlan.detail(projectId ?? "__none__"),
    queryFn: async () => {
      try {
        return await api.getFinancePlan(projectId as string);
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
    enabled: Boolean(projectId) && (options?.enabled ?? true),
    ...options,
  });
}

/**
 * Current milestone = first milestone whose status ∉ {verified, rejected},
 * ordered by sequence. 404 when no plan or all milestones terminal.
 */
export function useCurrentMilestone(
  projectId: string | undefined,
  options?: Omit<
    UseQueryOptions<Milestone | null, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  return useQuery<Milestone | null, ApiError>({
    queryKey: queryKeys.financePlan.currentMilestone(
      projectId ?? "__none__",
    ),
    queryFn: async () => {
      try {
        return await api.getCurrentMilestone(projectId as string);
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
    enabled: Boolean(projectId) && (options?.enabled ?? true),
    ...options,
  });
}

/** Create (or replace) the finance plan. */
export function useCreateFinancePlan(
  projectId: string,
  options?: UseMutationOptions<
    FinancePlan,
    ApiError,
    CreateFinancePlanRequest
  >,
) {
  const qc = useQueryClient();
  return useMutation<FinancePlan, ApiError, CreateFinancePlanRequest>({
    mutationFn: (body) => api.createFinancePlan(projectId, body),
    ...options,
    onSuccess: (data, vars, ctx, meta) => {
      qc.invalidateQueries({
        queryKey: queryKeys.financePlan.all(projectId),
      });
      options?.onSuccess?.(data, vars, ctx, meta);
    },
  });
}

/** Idempotent PUT. Use from the Gantt form's Save button. */
export function useUpdateFinancePlan(
  projectId: string,
  options?: UseMutationOptions<
    FinancePlan,
    ApiError,
    CreateFinancePlanRequest
  >,
) {
  const qc = useQueryClient();
  return useMutation<FinancePlan, ApiError, CreateFinancePlanRequest>({
    mutationFn: (body) => api.updateFinancePlan(projectId, body),
    ...options,
    onSuccess: (data, vars, ctx, meta) => {
      qc.invalidateQueries({
        queryKey: queryKeys.financePlan.all(projectId),
      });
      options?.onSuccess?.(data, vars, ctx, meta);
    },
  });
}

export type PatchMilestoneInput = {
  milestoneId: string;
  patch: PatchMilestoneRequest;
};

/**
 * Bank marks actuals on a milestone. Optimistically patches the cached
 * FinancePlan's milestones array, so the Gantt re-renders instantly
 * without a round-trip.
 */
export function usePatchMilestone(
  projectId: string,
  options?: UseMutationOptions<Milestone, ApiError, PatchMilestoneInput>,
) {
  const qc = useQueryClient();
  return useMutation<Milestone, ApiError, PatchMilestoneInput>({
    mutationFn: ({ milestoneId, patch }) =>
      api.patchMilestone(projectId, milestoneId, patch),
    ...options,
    onSuccess: (updatedMilestone, vars, ctx, meta) => {
      qc.setQueryData<FinancePlan | null>(
        queryKeys.financePlan.detail(projectId),
        (prev) =>
          prev
            ? {
                ...prev,
                milestones: prev.milestones.map((m) =>
                  m._id === updatedMilestone._id ? updatedMilestone : m,
                ),
              }
            : prev,
      );
      qc.invalidateQueries({
        queryKey: queryKeys.financePlan.currentMilestone(projectId),
      });
      options?.onSuccess?.(updatedMilestone, vars, ctx, meta);
    },
  });
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    (err as { status: number }).status === 404
  );
}
