import type {
  AgentRun,
  Discipline,
  DocumentRecord,
  FinancePlan,
  Milestone,
  PlanClassification,
  PlanFormat,
  PlanFormatList,
  Project,
  UploadFinancePlanResponse,
  UploadPhotosResponse,
  UploadPlansResponse,
} from "@/lib/types";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string) {
    super(`API ${status}: ${body.slice(0, 200)}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return (await res.json()) as T;
}

async function upload<T>(
  path: string,
  files: File[],
  field = "file",
): Promise<T> {
  const fd = new FormData();
  for (const f of files) fd.append(field, f);
  const res = await fetch(`${BASE}${path}`, { method: "POST", body: fd });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return (await res.json()) as T;
}

export const api = {
  health: () => json<{ ok: true }>("/health"),

  listProjects: () => json<Project[]>("/api/projects"),
  getProject: (id: string) => json<Project>(`/api/projects/${id}`),
  createProject: (body: { name: string; address?: string }) =>
    json<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listPlans: (id: string) =>
    json<DocumentRecord[]>(`/api/projects/${id}/plans`),
  uploadPlans: (id: string, files: File[]) =>
    upload<UploadPlansResponse>(`/api/projects/${id}/plans`, files),
  getPlanClassification: (id: string) =>
    json<PlanClassification>(`/api/projects/${id}/plan-classification`),
  getPlanFormats: (id: string) =>
    json<PlanFormatList>(`/api/projects/${id}/plan-format`),
  getPlanFormatFor: (id: string, d: Discipline) =>
    json<PlanFormat>(`/api/projects/${id}/plan-format?discipline=${d}`),

  uploadFinancePlan: (id: string, file: File) =>
    upload<UploadFinancePlanResponse>(
      `/api/projects/${id}/finance-plan`,
      [file],
    ),
  getFinancePlan: (id: string) =>
    json<FinancePlan>(`/api/projects/${id}/finance-plan`),
  getCurrentMilestone: (id: string) =>
    json<Milestone>(`/api/projects/${id}/finance-plan/current-milestone`),

  listPhotos: (id: string) =>
    json<DocumentRecord[]>(`/api/projects/${id}/photos`),
  uploadPhotos: (id: string, files: File[]) =>
    upload<UploadPhotosResponse>(`/api/projects/${id}/photos`, files),
  getPhoto: (projectId: string, photoId: string) =>
    json<DocumentRecord>(`/api/projects/${projectId}/photos/${photoId}`),

  listRuns: (id: string) => json<AgentRun[]>(`/api/projects/${id}/runs`),
  getRun: (id: string, runId: string) =>
    json<AgentRun>(`/api/projects/${id}/runs/${runId}`),
};
