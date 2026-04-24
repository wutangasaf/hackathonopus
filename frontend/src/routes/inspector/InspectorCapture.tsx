import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Eyebrow } from "@/components/blocks/Eyebrow";
import { PhotoGuidance } from "@/components/uploads/PhotoGuidance";
import { useLatestApprovedDraw } from "@/services/draws";
import { usePhotoGuidance, usePhotos } from "@/services/photos";
import { useProject } from "@/services/projects";

import { CapturePanel } from "./CapturePanel";
import { DeviceChooser, type CaptureDevice } from "./DeviceChooser";
import { MobileSheet, MobileShotRunner } from "./MobileShotRunner";

export default function InspectorCapture() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const [device, setDevice] = useState<CaptureDevice>("phone");
  const [selectedShotIndex, setSelectedShotIndex] = useState<number | null>(
    null,
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  const project = useProject(projectId);
  const draw = useLatestApprovedDraw(projectId);
  const guidance = usePhotoGuidance(
    projectId,
    { drawId: draw.data?._id },
    { enabled: Boolean(draw.data?._id) },
  );
  const photos = usePhotos(projectId);

  const shots = guidance.data?.shotList ?? [];

  const shotLabel = useMemo(() => {
    if (selectedShotIndex === null) return undefined;
    const shot = shots[selectedShotIndex];
    return shot
      ? `#${String(selectedShotIndex + 1).padStart(2, "0")} · ${shot.target}`
      : undefined;
  }, [shots, selectedShotIndex]);

  const verifiedCount =
    photos.data?.filter((p) => p.exifMeta?.source === "exif_verified").length ??
    0;
  const hintedCount =
    photos.data?.filter((p) => p.exifMeta?.source === "client_hinted").length ??
    0;
  const totalUploaded = photos.data?.length ?? 0;

  return (
    <>
      {/* Mobile one-shot runner: below md breakpoint */}
      <div className="md:hidden">
        <MobileShotRunner
          project={project.data}
          draw={draw.data ?? undefined}
          shots={shots}
          guidanceLoading={guidance.isLoading}
          capturedCount={totalUploaded}
          clientHintedCount={hintedCount}
          device={device}
          onOpenSheet={() => setSheetOpen(true)}
        />
        <MobileSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          device={device}
          onDeviceChange={setDevice}
          verifiedCount={verifiedCount}
          hintedCount={hintedCount}
        />
      </div>

      {/* Desktop / tablet layout: md and up */}
      <div className="hidden min-h-screen bg-bg text-fg md:block">
        <header className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-8 py-3">
            <div className="min-w-0">
              <Link
                to="/inspector"
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-dim transition-colors hover:text-fg"
              >
                ← Inspector
              </Link>
              <div className="mt-0.5 truncate text-[14px] font-semibold tracking-tight text-fg">
                {project.data?.name ?? "Loading project…"}
              </div>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
              {draw.data
                ? `Draw #${String(draw.data.drawNumber).padStart(2, "0")} · approved`
                : "No approved draw yet"}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1280px] space-y-8 px-8 py-10">
          <section>
            <Eyebrow>Step 01 · Device</Eyebrow>
            <div className="mt-3">
              <DeviceChooser selected={device} onSelect={setDevice} />
            </div>
          </section>

          {device !== "phone" && (
            <div className="border-l-2 border-warn bg-bg-1 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-warn">
              {device === "drone"
                ? "Drone ingestion is on the Q3 roadmap · mock only for now"
                : "IoT sensor ingestion is on the Q3 roadmap · mock only for now"}
            </div>
          )}

          <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
            <div className="space-y-5">
              <div>
                <Eyebrow>Step 02 · Shot list</Eyebrow>
                <p className="mt-2 max-w-xl text-[13px] leading-[1.55] text-fg-dim">
                  Each item below verifies one or more line items from the
                  approved G703. Tap a shot to tag your next capture; the
                  photo is timestamped on upload.
                </p>
              </div>
              <ShotListSelectable
                projectId={projectId}
                selectedIndex={selectedShotIndex}
                onSelect={(i) =>
                  setSelectedShotIndex((prev) => (prev === i ? null : i))
                }
              />
            </div>

            <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
              <section className="border border-line-strong bg-bg-1 p-5">
                <Eyebrow>Step 03 · Capture</Eyebrow>
                <div className="mt-4">
                  <CapturePanel
                    projectId={projectId}
                    shotLabel={shotLabel}
                    disabled={device !== "phone"}
                  />
                </div>
              </section>

              <section className="border border-line bg-bg-1 p-5">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-muted">
                  Capture trust
                </div>
                <dl className="mt-3 space-y-2 font-mono text-[11px] uppercase tracking-[0.12em]">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-success">EXIF verified</dt>
                    <dd className="tabular-nums text-fg">{verifiedCount}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-warn">Client hinted</dt>
                    <dd className="tabular-nums text-fg">{hintedCount}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-[11px] leading-[1.45] text-fg-dim">
                  EXIF-verified photos come from a native camera with the
                  timestamp + GPS baked into the JPEG. Client-hinted photos
                  came through the in-browser webcam path — we trust them
                  enough to index, but the bank sees a weaker chain of
                  custody.
                </p>
              </section>
            </aside>
          </section>
        </main>
      </div>
    </>
  );
}

function ShotListSelectable({
  projectId,
  selectedIndex,
  onSelect,
}: {
  projectId: string;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  const draw = useLatestApprovedDraw(projectId);
  const guidance = usePhotoGuidance(
    projectId,
    { drawId: draw.data?._id },
    { enabled: Boolean(draw.data?._id) },
  );

  if (!draw.data) {
    return <PhotoGuidance projectId={projectId} />;
  }

  const shots = guidance.data?.shotList ?? [];
  if (guidance.isLoading && shots.length === 0) {
    return (
      <div className="border border-line bg-bg-1 p-6 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-dim">
        Building shot list…
      </div>
    );
  }
  if (shots.length === 0) {
    return (
      <div className="border border-dashed border-line-strong bg-bg-1 p-6 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-dim">
        NO SHOTS REQUIRED · NO CLAIMED LINES MATCH UPLOADED PLANS
      </div>
    );
  }

  return (
    <ol className="divide-y divide-line border border-line bg-bg-1">
      {shots.map((shot, i) => {
        const active = selectedIndex === i;
        return (
          <li key={shot.shotId}>
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-pressed={active}
              className={`flex w-full items-start gap-4 px-4 py-4 text-left transition-colors ${
                active ? "bg-bg-2" : "hover:bg-bg-2"
              }`}
            >
              <span className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-muted">
                #{String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold leading-tight text-fg">
                  {shot.target}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">
                  {shot.discipline}
                  {shot.framing ? ` · ${shot.framing}` : ""}
                </div>
                {shot.referenceLineNumbers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {shot.referenceLineNumbers.slice(0, 4).map((ln) => (
                      <span
                        key={ln}
                        className="border border-line-strong bg-bg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-fg-dim"
                      >
                        {ln}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {active && (
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-accent">
                  Selected
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
