import { useDraggable } from "@dnd-kit/core";

import {
  SHEET_ROLE_LABEL,
  formatSheetChip,
  type ClassifiedSheet,
  type Discipline,
} from "@/lib/types";
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
  pageNumber: number;
  sheetLabel?: string;
  discipline: Discipline;
  sheetRole: ClassifiedSheet["sheetRole"];
  chipNote?: string;
};

export function sheetKey(
  s: Pick<ClassifiedSheet, "documentId" | "pageNumber">,
): string {
  return `${s.documentId}:${s.pageNumber}`;
}

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
    pageNumber: sheet.pageNumber,
    sheetLabel: sheet.titleblock?.sheetLabel,
    discipline: sheet.discipline,
    sheetRole: sheet.sheetRole,
    chipNote: sheet.notes,
  };
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id, data });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const primary = sheet.titleblock?.sheetLabel ?? `p.${sheet.pageNumber}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      title={`${formatSheetChip(sheet)}${sheet.notes ? " · " + sheet.notes : ""}`}
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
        {primary}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-muted">
        {SHEET_ROLE_LABEL[sheet.sheetRole]}
      </span>
    </div>
  );
}
