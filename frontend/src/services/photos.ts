import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { api, type ApiError } from "@/lib/api";
import type {
  DocumentRecord,
  PhotoDetailResponse,
  PhotoGuidance,
  UploadPhotosResponse,
} from "@/lib/types";
import { queryKeys } from "@/services/queryKeys";

export function usePhotos(
  projectId: string | undefined,
  options?: Omit<
    UseQueryOptions<DocumentRecord[], ApiError>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  return useQuery<DocumentRecord[], ApiError>({
    queryKey: queryKeys.photos.list(projectId ?? "__none__"),
    queryFn: () => api.listPhotos(projectId as string),
    enabled: Boolean(projectId) && (options?.enabled ?? true),
    ...options,
  });
}

/** Single photo with Agent 5 assessment + Agent 6 observation. */
export function usePhotoDetail(
  projectId: string | undefined,
  photoId: string | undefined,
  options?: Omit<
    UseQueryOptions<PhotoDetailResponse, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  return useQuery<PhotoDetailResponse, ApiError>({
    queryKey: queryKeys.photos.detail(
      projectId ?? "__none__",
      photoId ?? "__none__",
    ),
    queryFn: () =>
      api.getPhoto(projectId as string, photoId as string),
    enabled:
      Boolean(projectId) && Boolean(photoId) && (options?.enabled ?? true),
    ...options,
  });
}

/**
 * Photo guidance (Agent 4). First call takes 30–60s while the agent
 * runs; cached calls are <200ms. Pass `regenerate: true` to force a
 * fresh run. 404 when no plan or no active milestone — we surface that
 * as `null` so the screen can render an empty state instead of throwing.
 */
export function usePhotoGuidance(
  projectId: string | undefined,
  opts: { milestoneId?: string; regenerate?: boolean } = {},
  options?: Omit<
    UseQueryOptions<PhotoGuidance | null, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  return useQuery<PhotoGuidance | null, ApiError>({
    queryKey: queryKeys.photos.guidance(
      projectId ?? "__none__",
      opts.milestoneId,
    ),
    queryFn: async () => {
      try {
        return await api.getPhotoGuidance(projectId as string, opts);
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
    // Guidance is expensive on a miss — don't auto-refetch on mount.
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(projectId) && (options?.enabled ?? true),
    ...options,
  });
}

export type UploadPhotosInput = { files: File[] };

/**
 * Upload site photos. Invalidates the photos list and the runs list
 * (Agents 5/6 kick off fire-and-forget for each new photo).
 */
export function useUploadPhotos(
  projectId: string,
  options?: UseMutationOptions<
    UploadPhotosResponse,
    ApiError,
    UploadPhotosInput
  >,
) {
  const qc = useQueryClient();
  return useMutation<UploadPhotosResponse, ApiError, UploadPhotosInput>({
    mutationFn: ({ files }) => api.uploadPhotos(projectId, files),
    ...options,
    onSuccess: (data, vars, ctx, meta) => {
      qc.invalidateQueries({ queryKey: queryKeys.photos.all(projectId) });
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
