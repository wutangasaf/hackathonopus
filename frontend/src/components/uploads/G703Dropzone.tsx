import { useRef, useState, type DragEvent } from "react";

import { cn } from "@/lib/utils";

export type G703DropzoneSubmit = {
  g703: File;
  g702?: File;
};

type SlotKind = "g703" | "g702";

export function G703Dropzone({
  uploading,
  error,
  onSubmit,
}: {
  uploading: boolean;
  error?: string;
  onSubmit: (files: G703DropzoneSubmit) => void;
}) {
  const [g703, setG703] = useState<File | null>(null);
  const [g702, setG702] = useState<File | null>(null);

  function classifyFilename(name: string): SlotKind {
    const lower = name.toLowerCase();
    if (lower.includes("g702") || lower.includes("702")) return "g702";
    return "g703";
  }

  // Single file targets its slot directly. Multi-file (2+) auto-classifies
  // by filename so users can drop both PDFs at once on either slot.
  function acceptFiles(files: FileList | null, target: SlotKind) {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    if (arr.length === 1) {
      const only = arr[0]!;
      if (target === "g702") setG702(only);
      else setG703(only);
      return;
    }
    let nextG703: File | null = g703;
    let nextG702: File | null = g702;
    for (const f of arr) {
      const kind = classifyFilename(f.name);
      if (kind === "g702" && !nextG702) nextG702 = f;
      else if (kind === "g703" && !nextG703) nextG703 = f;
      else if (!nextG703) nextG703 = f;
      else if (!nextG702) nextG702 = f;
    }
    setG703(nextG703);
    setG702(nextG702);
  }

  function handleSubmit() {
    if (!g703 || uploading) return;
    onSubmit({ g703, g702: g702 ?? undefined });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <UploadSlot
          role="required"
          title="G703 · continuation sheet"
          hint="Required. Line-item breakdown of this draw."
          file={g703}
          uploading={uploading}
          onFiles={(files) => acceptFiles(files, "g703")}
          onClear={() => setG703(null)}
        />
        <UploadSlot
          role="optional"
          title="G702 · application cover"
          hint="Optional. Summary cover sheet. Attach if you have one."
          file={g702}
          uploading={uploading}
          onFiles={(files) => acceptFiles(files, "g702")}
          onClear={() => setG702(null)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border border-line bg-bg-1 px-4 py-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-dim">
          {g703 && g702
            ? "Pair ready · G703 + G702 staged"
            : g703
              ? "G703 staged · add G702 (optional) or submit"
              : "Stage a G703 to continue · G702 is optional"}
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!g703 || uploading}
          aria-disabled={!g703 || uploading}
          className="inline-flex items-center gap-2 bg-accent px-6 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-colors hover:bg-[#67e8f9] disabled:cursor-not-allowed disabled:bg-accent/40"
        >
          {uploading ? "Uploading…" : "Submit for parsing ↗"}
        </button>
      </div>

      {error && (
        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-danger">
          ERROR · {error}
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

function UploadSlot({
  role,
  title,
  hint,
  file,
  uploading,
  onFiles,
  onClear,
}: {
  role: "required" | "optional";
  title: string;
  hint: string;
  file: File | null;
  uploading: boolean;
  onFiles: (files: FileList | null) => void;
  onClear: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (uploading) return;
    onFiles(e.dataTransfer.files);
  }

  const border = uploading
    ? "border-line-strong"
    : dragging
      ? "border-accent"
      : file
        ? "border-fg-muted"
        : role === "required"
          ? "border-line-strong"
          : "border-line";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!uploading && !file) input.current?.click();
      }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !uploading && !file) {
          input.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!uploading) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "relative flex min-h-[180px] flex-col justify-between gap-3 border border-dashed p-5 transition-colors",
        border,
        uploading
          ? "cursor-wait bg-bg-2"
          : file
            ? "cursor-default bg-bg-1"
            : "cursor-pointer bg-bg-1 hover:bg-bg-2",
      )}
    >
      {uploading && (
        <div
          aria-hidden
          className="absolute left-0 right-0 top-0 h-px overflow-hidden bg-bg-3"
        >
          <div className="h-full w-1/3 animate-[plumbline-progress_1.2s_ease-in-out_infinite] bg-accent" />
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
            {title}
          </div>
          <p className="mt-1.5 text-[12px] leading-[1.5] text-fg-dim">
            {hint}
          </p>
        </div>
        <span
          className={cn(
            "font-mono text-[9px] uppercase tracking-[0.16em]",
            role === "required" ? "text-accent" : "text-fg-muted",
          )}
        >
          {role === "required" ? "Required" : "Optional"}
        </span>
      </div>

      {file ? (
        <div className="flex items-baseline justify-between gap-3 border border-line bg-bg px-3 py-2">
          <span className="truncate font-mono text-[12px] text-fg">
            {file.name}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            disabled={uploading}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim hover:text-fg disabled:opacity-40"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-dim">
          {dragging ? "DROP TO STAGE" : "DROP FILE OR CLICK TO BROWSE"}
        </div>
      )}

      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf,image/*"
        hidden
        onChange={(e) => onFiles(e.target.files)}
      />
    </div>
  );
}
