import type {
  AgentRun,
  CreateFinancePlanRequest,
  Discipline,
  DocumentRecord,
  Draw,
  DrawLine,
  FinancePlan,
  GapReport,
  Milestone,
  PatchDrawLineRequest,
  PatchMilestoneRequest,
  PhotoDetailResponse,
  PhotoGuidance,
  PlanClassification,
  PlanFormat,
  PlanFormatList,
  Project,
  UploadPhotosResponse,
  UploadPlansResponse,
} from "@/lib/types";

// Empty default: Vite dev proxies /api and /health to the backend in
// vite.config.ts. For deployed builds, set VITE_API_BASE_URL to an
// absolute backend URL.
const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

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

async function noContent(path: string, init?: RequestInit): Promise<void> {
  const res = await fetch(`${BASE}${path}`, init);
  if (res.status === 204) return;
  if (!res.ok) throw new ApiError(res.status, await res.text());
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

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number | boolean] =>
      entry[1] !== undefined,
  );
  if (entries.length === 0) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of entries) sp.set(k, String(v));
  return `?${sp.toString()}`;
}

export const api = {
  health: () => json<{ ok: true }>("/health"),

  // Projects
  listProjects: () => json<Project[]>("/api/projects"),
  getProject: (id: string) => json<Project>(`/api/projects/${id}`),
  createProject: (body: { name: string; address?: string }) =>
    json<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Plans
  listPlans: (id: string) =>
    json<DocumentRecord[]>(`/api/projects/${id}/plans`),
  uploadPlans: (id: string, files: File[]) =>
    upload<UploadPlansResponse>(`/api/projects/${id}/plans`, files),
  deletePlan: (id: string, docId: string) =>
    noContent(`/api/projects/${id}/plans/${docId}`, { method: "DELETE" }),
  getPlanClassification: (id: string) =>
    json<PlanClassification>(`/api/projects/${id}/plan-classification`),
  getPlanFormats: (id: string) =>
    json<PlanFormatList>(`/api/projects/${id}/plan-format`),
  getPlanFormatFor: (id: string, d: Discipline) =>
    json<PlanFormat>(`/api/projects/${id}/plan-format?discipline=${d}`),

  // Finance plan
  createFinancePlan: (id: string, body: CreateFinancePlanRequest) =>
    json<FinancePlan>(`/api/projects/${id}/finance-plan`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateFinancePlan: (id: string, body: CreateFinancePlanRequest) =>
    json<FinancePlan>(`/api/projects/${id}/finance-plan`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  patchMilestone: (
    id: string,
    milestoneId: string,
    patch: PatchMilestoneRequest,
  ) =>
    json<Milestone>(
      `/api/projects/${id}/finance-plan/milestones/${milestoneId}`,
      {
        method: "PATCH",
        body: JSON.stringify(patch),
      },
    ),
  getFinancePlan: (id: string) =>
    json<FinancePlan>(`/api/projects/${id}/finance-plan`),
  getCurrentMilestone: (id: string) =>
    json<Milestone>(`/api/projects/${id}/finance-plan/current-milestone`),

  // Photo guidance (Agent 4)
  getPhotoGuidance: (
    id: string,
    opts: { drawId?: string; regenerate?: boolean } = {},
  ) =>
    json<PhotoGuidance>(
      `/api/projects/${id}/photo-guidance${qs({
        drawId: opts.drawId,
        regenerate: opts.regenerate ? 1 : undefined,
      })}`,
    ),

  // Photos
  listPhotos: (id: string) =>
    json<DocumentRecord[]>(`/api/projects/${id}/photos`),
  uploadPhotos: async (
    id: string,
    files: File[],
    hint?: {
      capturedAt?: string;
      lat?: number;
      lon?: number;
      captureSource?:
        | "phone_camera"
        | "desktop_camera"
        | "native_upload"
        | "drone"
        | "iot";
    },
  ): Promise<UploadPhotosResponse> => {
    const fd = new FormData();
    // Append sidecar fields BEFORE files — Fastify processes multipart
    // parts in stream order and our backend needs the hint populated
    // before it ingests each file.
    if (hint?.capturedAt) fd.append("capturedAt", hint.capturedAt);
    if (typeof hint?.lat === "number") fd.append("lat", String(hint.lat));
    if (typeof hint?.lon === "number") fd.append("lon", String(hint.lon));
    if (hint?.captureSource) fd.append("captureSource", hint.captureSource);
    for (const f of files) fd.append("file", f);
    const res = await fetch(`${BASE}/api/projects/${id}/photos`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return (await res.json()) as UploadPhotosResponse;
  },
  getPhoto: (projectId: string, photoId: string) =>
    json<PhotoDetailResponse>(
      `/api/projects/${projectId}/photos/${photoId}`,
    ),
  deletePhoto: (id: string, photoId: string) =>
    noContent(`/api/projects/${id}/photos/${photoId}`, { method: "DELETE" }),

  // Draw reports (Agent 7)
  createReport: (id: string, opts: { milestoneId?: string } = {}) =>
    json<GapReport>(
      `/api/projects/${id}/reports${qs({ milestoneId: opts.milestoneId })}`,
      { method: "POST", body: "{}" },
    ),
  listReports: (id: string) =>
    json<GapReport[]>(`/api/projects/${id}/reports`),
  getReport: (id: string, reportId: string) =>
    json<GapReport>(`/api/projects/${id}/reports/${reportId}`),

  // Draws (contractor-facing G703 upload → review → approve)
  uploadDraw: async (
    id: string,
    body: {
      g703: File;
      g702?: File;
      periodStart?: string;
      periodEnd?: string;
    },
  ): Promise<Draw> => {
    const fd = new FormData();
    fd.append("g703", body.g703);
    if (body.g702) fd.append("g702", body.g702);
    if (body.periodStart) fd.append("periodStart", body.periodStart);
    if (body.periodEnd) fd.append("periodEnd", body.periodEnd);
    const res = await fetch(`${BASE}/api/projects/${id}/draws`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return (await res.json()) as Draw;
  },
  listDraws: (id: string) => json<Draw[]>(`/api/projects/${id}/draws`),
  getDraw: (id: string, drawId: string) =>
    json<Draw>(`/api/projects/${id}/draws/${drawId}`),
  patchDrawLine: (
    id: string,
    drawId: string,
    lineIndex: number,
    patch: PatchDrawLineRequest,
  ) =>
    json<DrawLine>(
      `/api/projects/${id}/draws/${drawId}/lines/${lineIndex}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    ),
  approveDraw: (id: string, drawId: string) =>
    json<Draw>(`/api/projects/${id}/draws/${drawId}/approve`, {
      method: "POST",
      body: "{}",
    }),

  // Agent runs
  listRuns: (id: string) => json<AgentRun[]>(`/api/projects/${id}/runs`),
  getRun: (id: string, runId: string) =>
    json<AgentRun>(`/api/projects/${id}/runs/${runId}`),
};
