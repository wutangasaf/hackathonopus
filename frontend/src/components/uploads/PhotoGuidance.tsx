import { RefreshCcw } from "lucide-react";

import { Eyebrow } from "@/components/blocks/Eyebrow";
import type { Discipline, PhotoGuidanceShot } from "@/lib/types";
import { DISCIPLINE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCurrentMilestone } from "@/services/financePlan";
import { usePhotoGuidance } from "@/services/photos";
import { queryKeys } from "@/services/queryKeys";
import { useQueryClient } from "@tanstack/react-query";

const DISCIPLINE_DOT: Record<Discipline, string> = {
  ARCHITECTURE: "bg-warn",
  STRUCTURAL: "bg-accent",
  ELECTRICAL: "bg-success",
  PLUMBING: "bg-danger",
};

export function PhotoGuidance({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const currentMilestone = useCurrentMilestone(projectId);
  const milestoneId = currentMilestone.data?._id;

  const guidance = usePhotoGuidance(projectId, { milestoneId });

  const regenerate = usePhotoGuidance(
    projectId,
    { milestoneId, regenerate: true },
    { enabled: false },
  );

  async function onRegenerate() {
    await qc.invalidateQueries({
      queryKey: queryKeys.photos.guidance(projectId, milestoneId),
    });
    await regenerate.refetch();
  }

  // Nothing to guide against.
  if (currentMilestone.isLoading) return null;
  if (!currentMilestone.data) {
    return (
      <div className="border border-dashed border-line-strong bg-bg-1 p-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-dim">
          No active milestone
        </div>
        <p className="mt-2 text-sm leading-[1.55] text-fg-dim">
          Publish a finance plan first. Photo guidance is keyed to the
          project&apos;s current milestone.
        </p>
      </div>
    );
  }

  const shots = guidance.data?.shotList ?? [];
  const loading = guidance.isLoading || regenerate.isFetching;

  return (
    <div className="space-y-5">
      <DeviceBanner milestoneName={currentMilestone.data.name} />

      <div className="border border-line bg-bg-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-strong px-5 py-4">
          <div>
            <Eyebrow>Shot list · {shots.length}</Eyebrow>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-fg-dim">
              Milestone {currentMilestone.data.sequence
                .toString()
                .padStart(2, "0")}{" "}
              · {currentMilestone.data.name}
            </div>
          </div>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 border border-line-strong px-3.5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-fg transition-colors hover:border-fg-dim hover:bg-bg-2 disabled:opacity-50"
          >
            <RefreshCcw
              className={cn("!size-3", loading && "animate-spin")}
              strokeWidth={2}
            />
            {loading ? "Refreshing…" : "Regenerate"}
          </button>
        </header>

        {guidance.isError ? (
          <div className="p-6 font-mono text-[11px] uppercase tracking-[0.14em] text-danger">
            ERROR · {guidance.error?.message ?? "failed to load guidance"}
          </div>
        ) : loading && shots.length === 0 ? (
          <div className="p-6">
            <div className="relative mb-4 h-px overflow-hidden bg-bg-3">
              <div className="h-full w-1/3 animate-[plumbline-progress_1.2s_ease-in-out_infinite] bg-accent" />
            </div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-dim">
              Agent 4 building shot list · 30–60s first call
            </p>
            <style>{`
              @keyframes plumbline-progress {
                0%   { transform: translateX(-100%); }
                50%  { transform: translateX(150%); }
                100% { transform: translateX(350%); }
              }
            `}</style>
          </div>
        ) : shots.length === 0 ? (
          <div className="p-6 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-dim">
            NO SHOTS REQUIRED · BACK WITH THE NEXT MILESTONE
          </div>
        ) : (
          <ol className="divide-y divide-line">
            {shots.map((shot, i) => (
              <ShotRow key={shot.shotId} shot={shot} index={i + 1} />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function DeviceBanner({ milestoneName }: { milestoneName: string }) {
  return (
    <div className="relative overflow-hidden border border-line-strong bg-bg-1 px-6 py-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-accent"
      />
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
            <span aria-hidden className="inline-block h-1.5 w-1.5 bg-accent" />
            Recommended device
          </div>
          <div className="mt-2 text-[18px] font-bold tracking-[-0.01em] text-fg">
            iPhone camera · native app · HEIC on
          </div>
          <p className="mt-2 text-[13px] leading-[1.55] text-fg-dim">
            Default camera preserves timestamp + GPS EXIF end-to-end. Don&apos;t
            route through screenshots, Airdrop-compressed copies, or chat apps
            — those strip metadata and Plumbline will mark the capture{" "}
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-warn">
              NO EXIF
            </span>
            .
          </p>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
          Shooting for · {milestoneName}
        </div>
      </div>
    </div>
  );
}

function ShotRow({ shot, index }: { shot: PhotoGuidanceShot; index: number }) {
  return (
    <li className="grid grid-cols-[40px_1fr] gap-5 px-5 py-5">
      <div className="flex flex-col items-start gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-muted">
          #{String(index).padStart(2, "0")}
        </span>
        <span
          aria-hidden
          className={cn(
            "inline-block h-2 w-2",
            DISCIPLINE_DOT[shot.discipline],
          )}
          title={DISCIPLINE_LABEL[shot.discipline]}
        />
      </div>

      <div>
        <div className="text-[15px] font-semibold leading-tight text-fg">
          {shot.target}
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">
          {DISCIPLINE_LABEL[shot.discipline]} · shot {shot.shotId.slice(-6)}
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {shot.framing && <Spec label="Framing">{shot.framing}</Spec>}
          {shot.angle && <Spec label="Angle">{shot.angle}</Spec>}
          {shot.lighting && <Spec label="Lighting">{shot.lighting}</Spec>}
          {shot.safety && <Spec label="Safety" tone="warn">{shot.safety}</Spec>}
        </dl>

        {shot.referenceElementIds.length > 0 && (
          <div className="mt-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
              Elements this shot verifies
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {shot.referenceElementIds.map((id) => (
                <span
                  key={id}
                  className="border border-line-strong bg-bg px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim"
                >
                  {id}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function Spec({
  label,
  tone,
  children,
}: {
  label: string;
  tone?: "warn";
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt
        className={cn(
          "font-mono text-[10px] uppercase tracking-[0.14em]",
          tone === "warn" ? "text-warn" : "text-fg-dim",
        )}
      >
        {label}
      </dt>
      <dd className="mt-1 text-[13px] leading-[1.5] text-fg">{children}</dd>
    </div>
  );
}
