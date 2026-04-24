import { RefreshCcw } from "lucide-react";
import { Link } from "react-router-dom";

import { Eyebrow } from "@/components/blocks/Eyebrow";
import type { Discipline, Draw, PhotoGuidanceShot } from "@/lib/types";
import { DISCIPLINE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLatestApprovedDraw } from "@/services/draws";
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
  const draw = useLatestApprovedDraw(projectId);
  const drawId = draw.data?._id;

  const guidance = usePhotoGuidance(
    projectId,
    { drawId },
    { enabled: Boolean(drawId) },
  );

  const regenerate = usePhotoGuidance(
    projectId,
    { drawId, regenerate: true },
    { enabled: false },
  );

  async function onRegenerate() {
    await qc.invalidateQueries({
      queryKey: queryKeys.photos.guidance(projectId, drawId),
    });
    await regenerate.refetch();
  }

  if (draw.isLoading) return null;

  if (!draw.data) {
    return <AwaitingDrawState projectId={projectId} />;
  }

  // drawId is present, but the hook returned null → 404/409 from the API.
  // Treat the same way as "no approved draw" — the panel has nothing to
  // render yet. This primarily covers stale cache scenarios.
  if (!guidance.isLoading && guidance.data === null) {
    return <AwaitingDrawState projectId={projectId} />;
  }

  const shots = guidance.data?.shotList ?? [];
  const loading = guidance.isLoading || regenerate.isFetching;

  return (
    <div className="space-y-5">
      <DeviceBanner draw={draw.data} />

      <div className="border border-line bg-bg-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-strong px-5 py-4">
          <div>
            <Eyebrow>Shot list · {shots.length}</Eyebrow>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-fg-dim">
              Draw #{String(draw.data.drawNumber).padStart(2, "0")} ·{" "}
              {draw.data.contractor.companyName}
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
            NO SHOTS REQUIRED · NO CLAIMED LINES MATCH UPLOADED PLANS
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

function AwaitingDrawState({ projectId }: { projectId: string }) {
  const contractorUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/contractor/draw-request/${projectId}`
      : `/contractor/draw-request/${projectId}`;

  return (
    <div className="border border-dashed border-line-strong bg-bg-1 p-6">
      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-dim">
        Awaiting contractor draw approval
      </div>
      <p className="mt-2 text-sm leading-[1.55] text-fg-dim">
        Photo guidance is keyed to the approved G703 draw. Send your
        contractor the link below — once they upload a G703 and approve
        every line, Agent 4 builds a shot list here automatically.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <code className="truncate border border-line bg-bg px-3 py-2 font-mono text-[11px] text-fg-dim">
          {contractorUrl}
        </code>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(contractorUrl)}
          className="inline-flex items-center gap-2 border border-line-strong px-3.5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-fg transition-colors hover:border-fg-dim hover:bg-bg-2"
        >
          Copy contractor link
        </button>
        <Link
          to="/contractor"
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim transition-colors hover:text-fg"
        >
          Open contractor portal →
        </Link>
      </div>
    </div>
  );
}

function DeviceBanner({ draw }: { draw: Draw }) {
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
            Capture devices
          </div>
          <div className="mt-2 text-[18px] font-bold tracking-[-0.01em] text-fg">
            Phone native camera · in-browser capture · drone / IoT (preview)
          </div>
          <p className="mt-2 text-[13px] leading-[1.55] text-fg-dim">
            Phone-native shots preserve EXIF and land as{" "}
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-success">
              EXIF ✓
            </span>
            . In-browser captures (webcam) carry a client-sent timestamp +
            GPS sidecar and land as{" "}
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-warn">
              CLIENT-HINTED
            </span>{" "}
            — indexed, but weaker chain of custody. Screenshots and
            chat-compressed copies still land as{" "}
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-warn">
              NO EXIF
            </span>
            .
          </p>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
          Shooting for · DRAW #{String(draw.drawNumber).padStart(2, "0")} ·{" "}
          {draw.contractor.companyName}
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

        {shot.proofOfLocation && (
          <div className="mt-4 border-l-2 border-accent bg-bg-1 px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
              Prove it's this element
            </div>
            <p className="mt-1 text-[13px] leading-[1.45] text-fg">
              {shot.proofOfLocation}
            </p>
          </div>
        )}

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

        {shot.referenceLineNumbers.length > 0 && (
          <div className="mt-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
              Claimed lines this shot verifies
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {shot.referenceLineNumbers.map((ln) => (
                <span
                  key={ln}
                  className="border border-line-strong bg-bg px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim"
                >
                  {ln}
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
