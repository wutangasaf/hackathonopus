import { Camera, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { DEMO_JOBSITE_GPS } from "@/lib/hardcoded";
import { cn } from "@/lib/utils";
import {
  useUploadPhotos,
  type PhotoUploadHint,
} from "@/services/photos";

type CaptureMode = "idle" | "stream" | "preview" | "uploading";

type GeoFix = {
  lat: number;
  lon: number;
  source: "live" | "mock";
};

async function getGeoFix(timeoutMs = 4000): Promise<GeoFix> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { ...DEMO_JOBSITE_GPS, source: "mock" };
  }
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      resolve({ ...DEMO_JOBSITE_GPS, source: "mock" });
    }, timeoutMs);
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

export function CapturePanel({
  projectId,
  shotLabel,
  disabled,
}: {
  projectId: string;
  shotLabel?: string;
  disabled?: boolean;
}) {
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<CaptureMode>("idle");
  const [preview, setPreview] = useState<{
    blob: Blob;
    url: string;
    capturedAt: string;
  } | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  const upload = useUploadPhotos(projectId, {
    onSuccess: (res) => {
      setLastStatus(`${res.documents.length} photo received · pipeline queued`);
      setPreview(null);
      setMode("idle");
      window.setTimeout(() => setLastStatus(null), 4000);
    },
    onError: (err) => {
      setErrorText(`${err.status} · ${err.body.slice(0, 200)}`);
      setMode("preview");
    },
  });

  useEffect(
    () => () => {
      stopStream();
      if (preview?.url) URL.revokeObjectURL(preview.url);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function stopStream() {
    const s = streamRef.current;
    if (s) {
      for (const t of s.getTracks()) t.stop();
      streamRef.current = null;
    }
    const v = videoRef.current;
    if (v) v.srcObject = null;
  }

  async function openInPageCamera() {
    if (disabled) return;
    setErrorText(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setMode("stream");
      // Next tick so video element is mounted.
      window.setTimeout(() => {
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          v.play().catch(() => void 0);
        }
      }, 0);
    } catch (err) {
      setErrorText(
        err instanceof Error
          ? `Camera unavailable · ${err.message}`
          : "Camera unavailable",
      );
    }
  }

  async function shoot() {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
    );
    if (!blob) return;
    const capturedAt = new Date().toISOString();
    stopStream();
    setPreview({
      blob,
      url: URL.createObjectURL(blob),
      capturedAt,
    });
    setMode("preview");
  }

  function cancelStream() {
    stopStream();
    setMode("idle");
  }

  function retake() {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
    openInPageCamera();
  }

  async function submitInPageCapture() {
    if (!preview) return;
    setMode("uploading");
    setErrorText(null);
    const geo = await getGeoFix();
    const file = new File(
      [preview.blob],
      `capture-${preview.capturedAt.replace(/[:.]/g, "-")}.jpg`,
      { type: "image/jpeg" },
    );
    const hint: PhotoUploadHint = {
      capturedAt: preview.capturedAt,
      lat: geo.lat,
      lon: geo.lon,
      captureSource: "desktop_camera",
    };
    upload.mutate({ files: [file], hint });
  }

  async function submitNativeFile(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0]!;
    setErrorText(null);
    setMode("uploading");
    const geo = await getGeoFix();
    const hint: PhotoUploadHint = {
      capturedAt: new Date().toISOString(),
      lat: geo.lat,
      lon: geo.lon,
      // Phones with `capture="environment"` will usually carry real EXIF.
      // The backend merges it — if the bytes DO have EXIF, captureSource
      // is overridden to whatever the camera put in the file. Tagging
      // phone_camera here matches the native route the user took.
      captureSource: "phone_camera",
    };
    upload.mutate({ files: [file], hint });
  }

  const uploading = mode === "uploading" || upload.isPending;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg-muted">
            Capture
          </div>
          {shotLabel && (
            <div className="mt-1 text-[13px] leading-[1.35] text-fg">
              Shooting · <span className="text-fg-dim">{shotLabel}</span>
            </div>
          )}
        </div>
        {lastStatus && (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-success">
            {lastStatus}
          </span>
        )}
      </div>

      {mode === "stream" && (
        <div className="relative overflow-hidden border border-accent bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-auto w-full"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-black/60 px-3 py-3 backdrop-blur">
            <button
              type="button"
              onClick={cancelStream}
              className="inline-flex items-center gap-1.5 border border-line-strong bg-black/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg"
            >
              <X className="!size-3" strokeWidth={2} /> Cancel
            </button>
            <button
              type="button"
              onClick={shoot}
              className="inline-flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-accent"
              aria-label="Capture"
            >
              <Camera className="!size-6 text-black" strokeWidth={2} />
            </button>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
              Live
            </span>
          </div>
        </div>
      )}

      {mode === "preview" && preview && (
        <div className="space-y-3">
          <div className="overflow-hidden border border-line bg-bg-1">
            <img
              src={preview.url}
              alt="Capture preview"
              className="h-auto w-full"
            />
          </div>
          <div className="grid gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim sm:grid-cols-2">
            <div>
              Captured · <span className="text-fg">{preview.capturedAt}</span>
            </div>
            <div>
              Source · <span className="text-fg">in-browser (canvas)</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={submitInPageCapture}
              disabled={uploading}
              className={cn(
                "inline-flex items-center gap-2 bg-accent px-5 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-colors hover:bg-[#ff8940] disabled:bg-accent/40",
              )}
            >
              {uploading ? "Uploading…" : "Submit capture ↗"}
            </button>
            <button
              type="button"
              onClick={retake}
              disabled={uploading}
              className="inline-flex items-center gap-2 border border-line-strong px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fg transition-colors hover:bg-bg-2"
            >
              <RotateCcw className="!size-3" strokeWidth={2} /> Retake
            </button>
          </div>
        </div>
      )}

      {mode === "idle" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => nativeInputRef.current?.click()}
            disabled={disabled || uploading}
            className={cn(
              "flex items-center justify-center gap-2 bg-accent px-4 py-4 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-colors hover:bg-[#ff8940] disabled:cursor-not-allowed disabled:bg-accent/40",
            )}
          >
            <Camera className="!size-4" strokeWidth={2} />
            Open phone camera
          </button>
          <button
            type="button"
            onClick={openInPageCamera}
            disabled={disabled || uploading}
            className="flex items-center justify-center gap-2 border border-line-strong px-4 py-4 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fg transition-colors hover:bg-bg-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Camera className="!size-4" strokeWidth={2} />
            Shoot from this device
          </button>
        </div>
      )}

      {mode === "uploading" && (
        <div className="border border-line bg-bg-1 p-4 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-fg-dim">
          UPLOADING…
        </div>
      )}

      <input
        ref={nativeInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        capture="environment"
        hidden
        onChange={(e) => {
          submitNativeFile(e.target.files);
          e.currentTarget.value = "";
        }}
      />

      {errorText && (
        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-danger">
          ERROR · {errorText}
        </div>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
        On phones, &quot;Open phone camera&quot; launches the native app and
        preserves EXIF. On desktops, &quot;Shoot from this device&quot; uses
        the webcam — Plumbline stamps timestamp + GPS as sidecar metadata
        and tags the capture{" "}
        <span className="text-warn">CLIENT-HINTED</span>.
      </p>
    </div>
  );
}
