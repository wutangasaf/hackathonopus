import { useRef, useState, type DragEvent } from "react";

import { cn } from "@/lib/utils";
import { useUploadPlans } from "@/services/plans";

export function PlansDropzone({ projectId }: { projectId: string }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [lastCount, setLastCount] = useState<number | null>(null);

  const upload = useUploadPlans(projectId, {
    onSuccess: (res) => {
      setLastCount(res.documents.length);
      window.setTimeout(() => setLastCount(null), 3500);
    },
  });

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter(
      (f) =>
        f.type === "application/pdf" ||
        f.name.toLowerCase().endsWith(".pdf"),
    );
    if (files.length === 0) return;
    upload.mutate({ files });
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  const uploading = upload.isPending;
  const state: "idle" | "dragging" | "uploading" | "done" | "error" =
    upload.isError
      ? "error"
      : uploading
        ? "uploading"
        : lastCount !== null
          ? "done"
          : dragging
            ? "dragging"
            : "idle";

  const border =
    state === "dragging"
      ? "border-accent"
      : state === "error"
        ? "border-danger"
        : state === "done"
          ? "border-success/50"
          : "border-line-strong";

  const label =
    state === "uploading"
      ? "UPLOADING…"
      : state === "done"
        ? `DONE · ${lastCount} FILE${lastCount === 1 ? "" : "S"} RECEIVED`
        : state === "dragging"
          ? "DROP TO UPLOAD"
          : "DROP PDFS HERE · OR CLICK TO BROWSE";

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInput.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInput.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center border border-dashed p-8 text-center transition-colors",
          border,
          uploading ? "cursor-wait bg-bg-1" : "bg-bg hover:bg-bg-1",
        )}
      >
        {/* Hairline progress bar per DESIGN-KIT §7 */}
        {uploading && (
          <div
            aria-hidden
            className="absolute left-0 right-0 top-0 h-px overflow-hidden bg-bg-3"
          >
            <div className="h-full w-1/3 animate-[plumbline-progress_1.2s_ease-in-out_infinite] bg-accent" />
          </div>
        )}

        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg-dim">
          {label}
        </div>
        <p className="mt-3 max-w-sm text-xs text-fg-muted">
          Architectural, structural, electrical, plumbing PDFs.
          Agent 1 labels every page; Agent 2 pulls a format per discipline.
        </p>

        <input
          ref={fileInput}
          type="file"
          multiple
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {upload.isError && (
        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-danger">
          ERROR · {upload.error?.message ?? "upload failed"}
        </div>
      )}

      <style>{`
        @keyframes plumbline-progress {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(150%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}
