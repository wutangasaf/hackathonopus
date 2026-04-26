import { useRef, useState, type DragEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useUploadPlans } from "@/services/plans";

export function PlansDropzone({ projectId }: { projectId: string }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [lastCount, setLastCount] = useState<number | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);

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
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-muted">
          Recurring counterparty format? Skip the LLM step.
        </div>
        <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-auto gap-2 rounded-none border-line-strong bg-bg-1 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-fg hover:bg-bg-2"
            >
              Use a template
              <Badge
                variant="secondary"
                className="rounded-none border border-line bg-bg-2 px-1.5 py-0 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-fg-dim"
              >
                Preview
              </Badge>
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-none border border-line bg-bg-1 text-fg sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-2xl font-extrabold tracking-tight2">
                Template service — preview
              </DialogTitle>
              <DialogDescription className="font-mono text-[11px] uppercase tracking-mono text-fg-muted">
                Coming soon · not yet shipped
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 space-y-5 text-[13px] leading-[1.55] text-fg-dim">
              <p>
                For recurring counterparty formats (same GC's SOV, same
                architect's titleblock, same bank's draw schedule), Plumbline.ai
                can skip the LLM extraction step and parse deterministically
                against a saved template.
              </p>

              <div>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-mono text-fg-muted">
                  Mapped templates on file (mock)
                </div>
                <ul className="divide-y divide-line border border-line-strong">
                  <li className="flex items-baseline justify-between gap-3 px-3 py-2">
                    <span className="font-mono text-[12px] text-fg">
                      BigGC Inc. · SOV · v3
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-mono text-fg-muted">
                      42 line items · last used 14d ago
                    </span>
                  </li>
                  <li className="flex items-baseline justify-between gap-3 px-3 py-2">
                    <span className="font-mono text-[12px] text-fg">
                      Smith &amp; Partners · Titleblock · v1
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-mono text-fg-muted">
                      6 projects
                    </span>
                  </li>
                </ul>
              </div>

              <div className="border border-accent/40 bg-accent-dim px-3 py-2">
                <div className="font-mono text-[10px] uppercase tracking-mono text-accent">
                  Match detected in your upload (mock)
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[12px] text-fg">
                    Smith &amp; Partners · Titleblock · v1
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-accent">
                    94% confidence
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-2 gap-2 sm:flex-row-reverse">
              <Button
                type="button"
                onClick={() => setTemplateOpen(false)}
                className={cn(
                  "h-auto rounded-none border border-transparent bg-accent px-6 py-3 font-mono text-[11px] font-semibold uppercase tracking-eyebrow text-black shadow-none",
                  "hover:bg-[#67e8f9] hover:shadow-[0_0_0_3px_rgba(34,211,238,0.15)]",
                )}
              >
                Apply template (mock)
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setTemplateOpen(false)}
                className="h-auto rounded-none border border-line-strong px-6 py-3 font-mono text-[11px] uppercase tracking-eyebrow text-fg hover:bg-bg-2"
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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
          uploading ? "cursor-wait bg-bg-2" : "bg-bg-1 hover:bg-bg-2",
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

        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg">
          {label}
        </div>
        <p className="mt-3 max-w-sm text-[13px] leading-[1.5] text-fg-dim">
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
