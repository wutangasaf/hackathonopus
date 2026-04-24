import { Chip } from "@/components/blocks/Chip";
import type { PhotoAssessment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePhotoDetail } from "@/services/photos";

export type ShotStatus = "pending" | "passed" | "needs_retake";

export function deriveStatus(
  assessment: PhotoAssessment | null | undefined,
): ShotStatus {
  if (!assessment) return "pending";
  return assessment.quality === "GOOD" ? "passed" : "needs_retake";
}

/**
 * Poll a single photo's Agent 5 assessment until it lands.
 *
 * Agent 5 runs fire-and-forget inside the photos upload route, so the
 * first few fetches after upload typically return `assessment: null`.
 * We poll every 1.5s until the assessment is present OR we've hit the
 * 30s ceiling — then the caller stops by flipping `enabled` off.
 */
export function useAssessmentPolling(
  projectId: string | undefined,
  photoDocumentId: string | undefined,
  enabled: boolean,
) {
  return usePhotoDetail(projectId, photoDocumentId, {
    enabled: Boolean(photoDocumentId) && enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.assessment) return false;
      return 1500;
    },
  });
}

export function AssessmentFeedback({
  assessment,
  loading,
  onRetake,
  className,
}: {
  assessment: PhotoAssessment | null | undefined;
  loading: boolean;
  onRetake?: () => void;
  className?: string;
}) {
  if (loading && !assessment) {
    return (
      <div
        className={cn(
          "border-l-2 border-line-strong bg-bg-1 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-dim",
          className,
        )}
      >
        Agent 5 · assessing photo…
      </div>
    );
  }
  if (!assessment) return null;

  const ok = assessment.quality === "GOOD";

  return (
    <div
      className={cn(
        "border-l-2 bg-bg-1 px-4 py-3",
        ok ? "border-success" : "border-danger",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={ok ? "success" : "danger"}>
          {assessment.quality.replace(/_/g, " ")}
        </Chip>
        {assessment.matchedShotId && (
          <Chip tone="accent">
            Shot {assessment.matchedShotId.slice(-6)}
          </Chip>
        )}
        {typeof assessment.phaseFit === "number" && (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
            Phase fit · {(assessment.phaseFit * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {assessment.issues.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 font-mono text-[11px] leading-[1.55] text-fg-dim">
          {assessment.issues.map((it, i) => (
            <li key={i}>· {it}</li>
          ))}
        </ul>
      )}

      {!ok && assessment.retakeInstructions && (
        <p className="mt-3 text-[13px] leading-[1.45] text-fg">
          {assessment.retakeInstructions}
        </p>
      )}

      {!ok && onRetake && (
        <button
          type="button"
          onClick={onRetake}
          className="mt-3 inline-flex items-center justify-center border border-danger bg-danger/10 px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-danger transition-colors hover:bg-danger/20"
        >
          Retake this shot ↺
        </button>
      )}
    </div>
  );
}

export function ShotStatusPill({
  status,
  size = "sm",
}: {
  status: ShotStatus | undefined;
  size?: "sm" | "xs";
}) {
  if (!status) return null;
  const map: Record<ShotStatus, { label: string; tone: "warn" | "success" | "danger" }> = {
    pending: { label: "Assessing", tone: "warn" },
    passed: { label: "Passed", tone: "success" },
    needs_retake: { label: "Retake", tone: "danger" },
  };
  const { label, tone } = map[status];
  return (
    <span
      className={cn(
        "inline-block border px-[8px] py-[3px] font-mono uppercase tracking-[0.14em]",
        size === "xs" ? "text-[9px]" : "text-[10px]",
        tone === "success" && "border-success/50 text-success",
        tone === "warn" && "border-warn/60 text-warn",
        tone === "danger" && "border-danger/50 text-danger",
      )}
    >
      {label}
    </span>
  );
}
