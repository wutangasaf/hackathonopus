import { ChevronLeft, ChevronRight, Info, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  AssessmentFeedback,
  deriveStatus,
  ShotStatusPill,
  useAssessmentPolling,
  type ShotStatus,
} from "@/components/inspector/AssessmentFeedback";
import { DEMO_JOBSITE_GPS } from "@/lib/hardcoded";
import type { Draw, PhotoGuidanceShot, Project } from "@/lib/types";
import { DISCIPLINE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  useUploadPhotos,
  type PhotoUploadHint,
} from "@/services/photos";

import type { CaptureDevice } from "./DeviceChooser";

type GeoFix = { lat: number; lon: number; source: "live" | "mock" };

async function getGeoFix(timeoutMs = 4000): Promise<GeoFix> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { ...DEMO_JOBSITE_GPS, source: "mock" };
  }
  return new Promise((resolve) => {
    const timer = window.setTimeout(
      () => resolve({ ...DEMO_JOBSITE_GPS, source: "mock" }),
      timeoutMs,
    );
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(timer);
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          source: "live",
        });
      },
      () => {
        window.clearTimeout(timer);
        resolve({ ...DEMO_JOBSITE_GPS, source: "mock" });
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

export function MobileShotRunner({
  project,
  draw,
  shots,
  guidanceLoading,
  capturedCount,
  clientHintedCount,
  device,
  onOpenSheet,
  shotStatus,
  onShotResolved,
}: {
  project: Project | undefined;
  draw: Draw | undefined;
  shots: PhotoGuidanceShot[];
  guidanceLoading: boolean;
  capturedCount: number;
  clientHintedCount: number;
  device: CaptureDevice;
  onOpenSheet: () => void;
  shotStatus: Record<string, ShotStatus>;
  onShotResolved: (shotId: string, status: ShotStatus) => void;
}) {
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "uploading" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [pendingUpload, setPendingUpload] = useState<{
    shotId: string;
    photoDocumentId: string;
  } | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (index >= shots.length && shots.length > 0) setIndex(0);
  }, [shots.length, index]);

  const upload = useUploadPhotos(project?._id ?? "", {
    onSuccess: (res) => {
      const currentShot = shots[index];
      const doc = res.documents[0];
      if (currentShot && doc) {
        onShotResolved(currentShot.shotId, "pending");
        setPendingUpload({
          shotId: currentShot.shotId,
          photoDocumentId: doc._id,
        });
      }
      setStatus({ kind: "idle" });
    },
    onError: (err) =>
      setStatus({
        kind: "error",
        message: `${err.status} · ${err.body.slice(0, 120)}`,
      }),
  });

  const assessmentQuery = useAssessmentPolling(
    project?._id,
    pendingUpload?.photoDocumentId,
    Boolean(pendingUpload),
  );
  const assessment = assessmentQuery.data?.assessment ?? null;

  useEffect(() => {
    if (!pendingUpload) return;
    if (!assessment) return;
    const resolved = deriveStatus(assessment);
    onShotResolved(pendingUpload.shotId, resolved);
    if (resolved === "passed") {
      setIndex((prev) => (prev + 1 < shots.length ? prev + 1 : prev));
    }
    setPendingUpload(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment, pendingUpload?.shotId]);

  const passedCount = useMemo(
    () => Object.values(shotStatus).filter((s) => s === "passed").length,
    [shotStatus],
  );
  const needsRetakeCount = useMemo(
    () => Object.values(shotStatus).filter((s) => s === "needs_retake").length,
    [shotStatus],
  );

  async function sendFile(file: File) {
    if (!project?._id) return;
    setStatus({ kind: "uploading" });
    const geo = await getGeoFix();
    const hint: PhotoUploadHint = {
      capturedAt: new Date().toISOString(),
      lat: geo.lat,
      lon: geo.lon,
      captureSource: "phone_camera",
    };
    upload.mutate({ files: [file], hint });
  }

  function onCameraChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.currentTarget.value = "";
    if (f) sendFile(f);
  }

  const shot = shots[index];
  const uploading = status.kind === "uploading";
  const canGoPrev = index > 0;
  const canGoNext = index < shots.length - 1;
  const awaitingAssessment =
    Boolean(pendingUpload) && pendingUpload?.shotId === shot?.shotId;
  const currentStatus: ShotStatus | undefined = shot
    ? shotStatus[shot.shotId]
    : undefined;
  const activeAssessment =
    awaitingAssessment && shot ? assessment : null;
  const needsRetake = currentStatus === "needs_retake";

  function handleRetake() {
    if (!shot) return;
    cameraRef.current?.click();
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-bg text-fg">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-bg px-4 py-3">
        <Link
          to="/inspector"
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-dim"
        >
          <ChevronLeft className="!size-3" strokeWidth={2} /> Inspector
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[12px] font-semibold tracking-tight text-fg">
            {project?.name ?? "Loading…"}
          </div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
            {draw
              ? `Draw #${String(draw.drawNumber).padStart(2, "0")}`
              : "No approved draw"}
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenSheet}
          aria-label="More options"
          className="inline-flex h-8 w-8 items-center justify-center border border-line-strong text-fg"
        >
          <Info className="!size-4" strokeWidth={2} />
        </button>
      </header>

      <div className="flex items-center gap-3 border-b border-line bg-bg-1 px-4 py-2.5">
        <div className="flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-dim">
            Progress
          </div>
          <div className="mt-0.5 font-mono text-[11px] tabular-nums text-fg">
            {shots.length === 0
              ? "0 shots"
              : `Shot ${String(index + 1).padStart(2, "0")} of ${String(
                  shots.length,
                ).padStart(2, "0")}`}
          </div>
        </div>
        <div className="relative h-1 flex-[2] overflow-hidden bg-bg-3">
          <div
            className="absolute inset-y-0 left-0 bg-success transition-[width]"
            style={{
              width:
                shots.length === 0
                  ? "0%"
                  : `${Math.min(100, (passedCount / shots.length) * 100)}%`,
            }}
          />
          {needsRetakeCount > 0 && (
            <div
              className="absolute inset-y-0 right-0 bg-danger transition-[width]"
              style={{
                width: `${Math.min(
                  100,
                  (needsRetakeCount / shots.length) * 100,
                )}%`,
              }}
            />
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5 font-mono text-[10px] uppercase tracking-[0.14em]">
          <span className="text-success">{passedCount} passed</span>
          {needsRetakeCount > 0 && (
            <span className="text-danger">{needsRetakeCount} retake</span>
          )}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-5">
        {guidanceLoading && shots.length === 0 ? (
          <SkeletonShot />
        ) : shots.length === 0 ? (
          <EmptyShots hasDraw={Boolean(draw)} />
        ) : shot ? (
          <ShotCard shot={shot} index={index} statusPill={currentStatus} />
        ) : null}

        {(awaitingAssessment || needsRetake) && (
          <AssessmentFeedback
            className="mt-4"
            assessment={activeAssessment}
            loading={awaitingAssessment && !activeAssessment}
            onRetake={needsRetake ? handleRetake : undefined}
          />
        )}

        {status.kind === "error" && (
          <div className="mt-4 border-l-2 border-danger bg-bg-1 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-danger">
            {status.message}
          </div>
        )}
      </main>

      <nav className="flex items-center justify-between gap-2 border-t border-line bg-bg px-2 py-2">
        <button
          type="button"
          onClick={() => canGoPrev && setIndex((i) => i - 1)}
          disabled={!canGoPrev}
          aria-label="Previous shot"
          className="inline-flex h-12 w-12 items-center justify-center border border-line-strong text-fg disabled:opacity-30"
        >
          <ChevronLeft className="!size-5" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (needsRetake) handleRetake();
            else cameraRef.current?.click();
          }}
          disabled={
            uploading ||
            awaitingAssessment ||
            !project?._id ||
            shots.length === 0
          }
          className={cn(
            "flex h-14 flex-1 items-center justify-center gap-2 font-mono text-[13px] font-bold uppercase tracking-[0.18em] transition-colors",
            needsRetake
              ? "bg-danger text-black active:bg-danger/80"
              : "bg-accent text-black active:bg-[#67e8f9]",
            (uploading ||
              awaitingAssessment ||
              !project?._id ||
              shots.length === 0) &&
              "bg-accent/40 text-black/50",
          )}
        >
          {uploading
            ? "UPLOADING…"
            : awaitingAssessment
              ? "ASSESSING…"
              : needsRetake
                ? "RETAKE"
                : "TAP TO CAPTURE"}
        </button>
        <button
          type="button"
          onClick={() => canGoNext && setIndex((i) => i + 1)}
          disabled={!canGoNext}
          aria-label="Next shot"
          className="inline-flex h-12 w-12 items-center justify-center border border-line-strong text-fg disabled:opacity-30"
        >
          <ChevronRight className="!size-5" strokeWidth={2} />
        </button>
      </nav>

      <footer className="flex items-center justify-between border-t border-line bg-bg-1 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
        <span>Device · {deviceLabel(device)}</span>
        <span>
          <span className="text-success">{passedCount}</span> passed ·{" "}
          <span className="text-fg-muted">{capturedCount}</span> uploaded ·{" "}
          <span className="text-warn">{clientHintedCount}</span> hinted
        </span>
      </footer>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*,.heic,.heif"
        capture="environment"
        hidden
        onChange={onCameraChange}
      />
    </div>
  );
}

function ShotCard({
  shot,
  index,
  statusPill,
}: {
  shot: PhotoGuidanceShot;
  index: number;
  statusPill?: ShotStatus;
}) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-muted">
            #{String(index + 1).padStart(2, "0")} ·{" "}
            {DISCIPLINE_LABEL[shot.discipline]}
          </div>
          <ShotStatusPill status={statusPill} size="xs" />
        </div>
        <h1 className="mt-2 text-[22px] font-extrabold leading-[1.15] tracking-tight text-fg">
          {shot.target}
        </h1>
      </div>

      <dl className="grid grid-cols-1 gap-3">
        {shot.framing && <Spec label="Framing">{shot.framing}</Spec>}
        {shot.angle && <Spec label="Angle">{shot.angle}</Spec>}
        {shot.lighting && <Spec label="Lighting">{shot.lighting}</Spec>}
        {shot.safety && (
          <Spec label="Safety" tone="warn">
            {shot.safety}
          </Spec>
        )}
      </dl>

      {shot.proofOfLocation && (
        <div className="border-l-2 border-accent bg-bg-1 px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
            Prove it's this element
          </div>
          <p className="mt-1 text-[13px] leading-[1.45] text-fg">
            {shot.proofOfLocation}
          </p>
        </div>
      )}

      {shot.referenceLineNumbers.length > 0 && (
        <div>
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
    <div className="border-l-2 border-line-strong pl-3">
      <dt
        className={cn(
          "font-mono text-[10px] uppercase tracking-[0.14em]",
          tone === "warn" ? "text-warn" : "text-fg-dim",
        )}
      >
        {label}
      </dt>
      <dd className="mt-1 text-[14px] leading-[1.4] text-fg">{children}</dd>
    </div>
  );
}

function SkeletonShot() {
  return (
    <div className="space-y-3">
      <div className="h-3 w-24 animate-pulse bg-bg-2" />
      <div className="h-6 w-4/5 animate-pulse bg-bg-2" />
      <div className="h-4 w-full animate-pulse bg-bg-2" />
      <div className="h-4 w-3/5 animate-pulse bg-bg-2" />
    </div>
  );
}

function EmptyShots({ hasDraw }: { hasDraw: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 border border-dashed border-line-strong bg-bg-1 p-6 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-fg-dim">
      {hasDraw ? (
        <>
          <div>No shots required</div>
          <div className="text-fg-muted">
            No claimed lines match the uploaded plans.
          </div>
        </>
      ) : (
        <>
          <div>Awaiting draw approval</div>
          <div className="text-fg-muted">
            Ask the contractor to submit and approve a G703.
          </div>
        </>
      )}
    </div>
  );
}

function deviceLabel(d: CaptureDevice): string {
  if (d === "phone") return "Phone";
  if (d === "drone") return "Drone (preview)";
  return "IoT (preview)";
}

export function MobileSheet({
  open,
  onClose,
  device,
  onDeviceChange,
  verifiedCount,
  hintedCount,
}: {
  open: boolean;
  onClose: () => void;
  device: CaptureDevice;
  onDeviceChange: (d: CaptureDevice) => void;
  verifiedCount: number;
  hintedCount: number;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex flex-col justify-end bg-black/70"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] overflow-y-auto border-t border-line-strong bg-bg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg-muted">
            Settings
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center border border-line-strong text-fg"
          >
            <X className="!size-4" strokeWidth={2} />
          </button>
        </div>
        <div className="space-y-6 px-4 py-5">
          <section>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-muted">
              Capture device
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["phone", "drone", "iot"] as const).map((d) => {
                const active = d === device;
                const disabled = d !== "phone";
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (!disabled) onDeviceChange(d);
                    }}
                    className={cn(
                      "flex flex-col items-start gap-1 border px-3 py-3 text-left",
                      active
                        ? "border-accent bg-bg-1"
                        : disabled
                          ? "cursor-not-allowed border-dashed border-line opacity-60"
                          : "border-line-strong",
                    )}
                  >
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-fg">
                      {d === "phone"
                        ? "Phone"
                        : d === "drone"
                          ? "Drone"
                          : "IoT"}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-fg-dim">
                      {d === "phone" ? "Live" : "Q3"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-muted">
              Capture trust
            </div>
            <dl className="space-y-2 font-mono text-[11px] uppercase tracking-[0.12em]">
              <div className="flex items-center justify-between">
                <dt className="text-success">EXIF verified</dt>
                <dd className="tabular-nums text-fg">{verifiedCount}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-warn">Client hinted</dt>
                <dd className="tabular-nums text-fg">{hintedCount}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[12px] leading-[1.45] text-fg-dim">
              EXIF-verified photos come from a native camera with timestamp
              + GPS baked into the JPEG. Client-hinted photos came through
              the in-browser webcam path — indexed, weaker chain of
              custody.
            </p>
          </section>

          <section>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-muted">
              Tip
            </div>
            <p className="text-[12px] leading-[1.45] text-fg-dim">
              Use your phone&apos;s native camera via the orange button. The
              JPEG preserves EXIF end-to-end and lands as{" "}
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-success">
                EXIF ✓
              </span>
              . Airdropped / chat-compressed copies strip metadata.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
