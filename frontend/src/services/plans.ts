import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { api, type ApiError } from "@/lib/api";
import type {
  Discipline,
  DocumentRecord,
  PlanClassification,
  PlanFormat,
  PlanFormatList,
  UploadPlansResponse,
} from "@/lib/types";
import { queryKeys } from "@/services/queryKeys";

/** List of uploaded PLAN documents for this project. */
export function usePlans(
  projectId: string | undefined,
  options?: Omit<
    UseQueryOptions<DocumentRecord[], ApiError>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  return useQuery<DocumentRecord[], ApiError>({
    queryKey: queryKeys.plans.list(projectId ?? "__none__"),
    queryFn: () => api.listPlans(projectId as string),
    enabled: Boolean(projectId) && (options?.enabled ?? true),
    ...options,
  });
}

/**
 * Agent 1 output. Pipeline runs async; backend returns 404 until both
 * PlanClassifier and PlanFormatExtractor succeed, so the hook swallows
 * 404s as `undefined` data and keeps retrying silently.
 */
export function usePlanClassification(
  projectId: string | undefined,
  options?: Omit<
    UseQueryOptions<PlanClassification | null, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  return useQuery<PlanClassification | null, ApiError>({
    queryKey: queryKeys.plans.classification(projectId ?? "__none__"),
    queryFn: async () => {
      try {
        return await api.getPlanClassification(projectId as string);
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
    enabled: Boolean(projectId) && (options?.enabled ?? true),
    ...options,
  });
}

/** Agent 2 output for all disciplines. 404 → null. */
export function usePlanFormats(
  projectId: string | undefined,
  options?: Omit<
    UseQueryOptions<PlanFormatList | null, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  return useQuery<PlanFormatList | null, ApiError>({
    queryKey: queryKeys.plans.formats(projectId ?? "__none__"),
    queryFn: async () => {
      try {
        return await api.getPlanFormats(projectId as string);
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
    enabled: Boolean(projectId) && (options?.enabled ?? true),
    ...options,
  });
}

/** Agent 2 output for a single discipline. */
export function usePlanFormatFor(
  projectId: string | undefined,
  discipline: Discipline | undefined,
  options?: Omit<
    UseQueryOptions<PlanFormat | null, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  return useQuery<PlanFormat | null, ApiError>({
    queryKey: queryKeys.plans.formatFor(
      projectId ?? "__none__",
      discipline ?? "ARCHITECTURE",
    ),
    queryFn: async () => {
      try {
        return await api.getPlanFormatFor(
          projectId as string,
          discipline as Discipline,
        );
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
    enabled:
      Boolean(projectId) && Boolean(discipline) && (options?.enabled ?? true),
    ...options,
  });
}

export type UploadPlansInput = { files: File[] };

/**
 * Upload plan PDFs. On success, invalidates plans list, classification,
 * formats, and the runs list (the pipeline writes AgentRun rows).
 */
export function useUploadPlans(
  projectId: string,
  options?: UseMutationOptions<UploadPlansResponse, ApiError, UploadPlansInput>,
) {
  const qc = useQueryClient();
  return useMutation<UploadPlansResponse, ApiError, UploadPlansInput>({
    mutationFn: ({ files }) => api.uploadPlans(projectId, files),
    ...options,
    onSuccess: (data, vars, ctx, meta) => {
      qc.invalidateQueries({ queryKey: queryKeys.plans.all(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.runs.all(projectId) });
      options?.onSuccess?.(data, vars, ctx, meta);
    },
  });
}

export type DeletePlanInput = { docId: string };

/**
 * Delete a plan PDF. Backend removes the file, scrubs classification
 * entries, and cancels any running Agent 1/2 runs that referenced it.
 * Returns 409 if the doc is pinned in a milestone's planDocRefs —
 * caller must update the finance plan first. Invalidates plans subtree
 * (list + classification + formats) and runs.
 */
export function useDeletePlan(
  projectId: string,
  options?: UseMutationOptions<void, ApiError, DeletePlanInput>,
) {
  const qc = useQueryClient();
  return useMutation<void, ApiError, DeletePlanInput>({
    mutationFn: ({ docId }) => api.deletePlan(projectId, docId),
    ...options,
    onSuccess: (data, vars, ctx, meta) => {
      qc.invalidateQueries({ queryKey: queryKeys.plans.all(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.runs.all(projectId) });
      options?.onSuccess?.(data, vars, ctx, meta);
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
