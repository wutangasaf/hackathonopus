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
 * Photo guidance (Agent 4). Keyed to the approved Draw. First call takes
 * 30–60s while the agent runs; cached calls are <200ms. Pass
 * `regenerate: true` to force a fresh run. 404 (no approved draw) and
 * 409 (draw not yet approved) both surface as `null` so the screen can
 * render an empty state instead of throwing.
 */
export function usePhotoGuidance(
  projectId: string | undefined,
  opts: { drawId?: string; regenerate?: boolean } = {},
  options?: Omit<
    UseQueryOptions<PhotoGuidance | null, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  return useQuery<PhotoGuidance | null, ApiError>({
    queryKey: queryKeys.photos.guidance(
      projectId ?? "__none__",
      opts.drawId,
    ),
    queryFn: async () => {
      try {
        return await api.getPhotoGuidance(projectId as string, opts);
      } catch (err) {
        if (isNotFoundOrConflict(err)) return null;
        throw err;
      }
    },
    // Guidance is expensive on a miss — don't auto-refetch on mount.
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(projectId) && (options?.enabled ?? true),
    ...options,
  });
}

export type PhotoUploadHint = {
  capturedAt?: string;
  lat?: number;
  lon?: number;
  captureSource?:
    | "phone_camera"
    | "desktop_camera"
    | "native_upload"
    | "drone"
    | "iot";
};

export type UploadPhotosInput = { files: File[]; hint?: PhotoUploadHint };

/**
 * Upload site photos. Invalidates the photos list and the runs list
 * (Agents 5/6 kick off fire-and-forget for each new photo). Hint carries
 * client-captured timestamp/GPS so in-browser captures (which have no
 * EXIF baked in) still carry capture metadata.
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
    mutationFn: ({ files, hint }) => api.uploadPhotos(projectId, files, hint),
    ...options,
    onSuccess: (data, vars, ctx, meta) => {
      qc.invalidateQueries({ queryKey: queryKeys.photos.all(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.runs.all(projectId) });
      options?.onSuccess?.(data, vars, ctx, meta);
    },
  });
}

export type DeletePhotoInput = { photoId: string };

/**
 * Delete a photo. Backend removes the file, cascades PhotoAssessment +
 * Observation rows, and cancels any running Agent 5/6 runs on this
 * photo. Invalidates photos subtree (list + detail + guidance) and runs.
 */
export function useDeletePhoto(
  projectId: string,
  options?: UseMutationOptions<void, ApiError, DeletePhotoInput>,
) {
  const qc = useQueryClient();
  return useMutation<void, ApiError, DeletePhotoInput>({
    mutationFn: ({ photoId }) => api.deletePhoto(projectId, photoId),
    ...options,
    onSuccess: (data, vars, ctx, meta) => {
      qc.invalidateQueries({ queryKey: queryKeys.photos.all(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.runs.all(projectId) });
      options?.onSuccess?.(data, vars, ctx, meta);
    },
  });
}

function isNotFoundOrConflict(err: unknown): boolean {
  const s = (err as { status?: number } | null | undefined)?.status;
  return s === 404 || s === 409;
}
