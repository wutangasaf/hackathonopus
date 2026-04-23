import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { api, type ApiError } from "@/lib/api";
import type { Project } from "@/lib/types";
import { queryKeys } from "@/services/queryKeys";

export function useProjects(
  options?: Omit<
    UseQueryOptions<Project[], ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<Project[], ApiError>({
    queryKey: queryKeys.projects.list(),
    queryFn: api.listProjects,
    ...options,
  });
}

export function useProject(
  id: string | undefined,
  options?: Omit<
    UseQueryOptions<Project, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  return useQuery<Project, ApiError>({
    queryKey: queryKeys.projects.detail(id ?? "__none__"),
    queryFn: () => api.getProject(id as string),
    enabled: Boolean(id) && (options?.enabled ?? true),
    ...options,
  });
}

export type CreateProjectInput = { name: string; address?: string };

export function useCreateProject(
  options?: UseMutationOptions<Project, ApiError, CreateProjectInput>,
) {
  const qc = useQueryClient();
  return useMutation<Project, ApiError, CreateProjectInput>({
    mutationFn: api.createProject,
    ...options,
    onSuccess: (data, vars, ctx, meta) => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.list() });
      options?.onSuccess?.(data, vars, ctx, meta);
    },
  });
}
