import { useDraggable } from "@dnd-kit/core";

import type { ClassifiedSheet, Discipline } from "@/lib/types";
import { cn } from "@/lib/utils";

export const DISCIPLINE_DOT: Record<Discipline, string> = {
  ARCHITECTURE: "bg-warn",
  STRUCTURAL: "bg-accent",
  ELECTRICAL: "bg-success",
  PLUMBING: "bg-danger",
};

export type ChipData = {
  kind: "planSheet";
  documentId: string;
  sheetLabel?: string;
  discipline: Discipline;
  pageNumber: number;
};

export function DocChip({
  sheet,
  id,
}: {
  sheet: ClassifiedSheet;
  id: string;
}) {
  const data: ChipData = {
    kind: "planSheet",
    documentId: sheet.documentId,
    sheetLabel: sheet.titleblock?.sheetLabel,
    discipline: sheet.discipline,
    pageNumber: sheet.pageNumber,
  };
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id, data });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "flex cursor-grab items-center gap-2 border border-line-strong bg-bg-1 px-2.5 py-1.5 transition-colors",
        "hover:border-accent/60 hover:bg-bg-2",
        isDragging && "opacity-50",
      )}
    >
      <span
        aria-hidden
        className={cn("inline-block h-2 w-2", DISCIPLINE_DOT[sheet.discipline])}
      />
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg">
        {sheet.titleblock?.sheetLabel ?? `p.${sheet.pageNumber}`}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-muted">
        {sheet.sheetRole.replace(/_/g, " ")}
      </span>
    </div>
  );
}
