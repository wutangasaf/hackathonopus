import type { Discipline } from "@/lib/types";

/**
 * Centralized query-key factory. Keep every screen's cache keys here so
 * invalidation stays consistent — e.g. uploading a plan invalidates the
 * runs list AND the plan-classification for that project.
 *
 * Rule of thumb: return `readonly unknown[]` so TanStack Query accepts
 * them anywhere a QueryKey is expected.
 */
export const queryKeys = {
  all: ["plumbline"] as const,

  health: () => [...queryKeys.all, "health"] as const,

  projects: {
    all: () => [...queryKeys.all, "projects"] as const,
    list: () => [...queryKeys.projects.all(), "list"] as const,
    detail: (id: string) =>
      [...queryKeys.projects.all(), "detail", id] as const,
  },

  plans: {
    all: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "plans"] as const,
    list: (projectId: string) =>
      [...queryKeys.plans.all(projectId), "list"] as const,
    classification: (projectId: string) =>
      [...queryKeys.plans.all(projectId), "classification"] as const,
    formats: (projectId: string) =>
      [...queryKeys.plans.all(projectId), "formats"] as const,
    formatFor: (projectId: string, discipline: Discipline) =>
      [...queryKeys.plans.all(projectId), "format", discipline] as const,
  },

  financePlan: {
    all: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "finance-plan"] as const,
    detail: (projectId: string) =>
      [...queryKeys.financePlan.all(projectId), "detail"] as const,
    currentMilestone: (projectId: string) =>
      [...queryKeys.financePlan.all(projectId), "current-milestone"] as const,
  },

  photos: {
    all: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "photos"] as const,
    list: (projectId: string) =>
      [...queryKeys.photos.all(projectId), "list"] as const,
    detail: (projectId: string, photoId: string) =>
      [...queryKeys.photos.all(projectId), "detail", photoId] as const,
    guidance: (projectId: string, drawId?: string) =>
      [
        ...queryKeys.photos.all(projectId),
        "guidance",
        drawId ?? "latest-approved",
      ] as const,
  },

  draws: {
    all: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "draws"] as const,
    list: (projectId: string) =>
      [...queryKeys.draws.all(projectId), "list"] as const,
    detail: (projectId: string, drawId: string) =>
      [...queryKeys.draws.all(projectId), "detail", drawId] as const,
    latestApproved: (projectId: string) =>
      [...queryKeys.draws.all(projectId), "latest-approved"] as const,
    verification: (projectId: string, drawId: string) =>
      [...queryKeys.draws.all(projectId), "verification", drawId] as const,
  },

  reports: {
    all: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "reports"] as const,
    list: (projectId: string) =>
      [...queryKeys.reports.all(projectId), "list"] as const,
    detail: (projectId: string, reportId: string) =>
      [...queryKeys.reports.all(projectId), "detail", reportId] as const,
  },

  runs: {
    all: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "runs"] as const,
    list: (projectId: string) =>
      [...queryKeys.runs.all(projectId), "list"] as const,
    detail: (projectId: string, runId: string) =>
      [...queryKeys.runs.all(projectId), "detail", runId] as const,
  },

  supervisor: {
    all: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "supervisor"] as const,
    list: (projectId: string) =>
      [...queryKeys.supervisor.all(projectId), "list"] as const,
    session: (projectId: string, sessionId: string) =>
      [...queryKeys.supervisor.all(projectId), "session", sessionId] as const,
  },
} as const;
