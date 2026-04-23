import { useMemo } from "react";

import type { ClassifiedSheet, Discipline } from "@/lib/types";
import { DISCIPLINES } from "@/lib/types";

import { DocChip } from "@/routes/gantt/DocChip";

export function Palette({ sheets }: { sheets: ClassifiedSheet[] }) {
  const grouped = useMemo(() => {
    const m = new Map<Discipline, ClassifiedSheet[]>();
    for (const d of DISCIPLINES) m.set(d, []);
    for (const s of sheets) {
      const list = m.get(s.discipline);
      if (list) list.push(s);
    }
    return m;
  }, [sheets]);

  return (
    <aside className="flex flex-col gap-6 border border-line bg-bg-1 p-4">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-dim">
          Labeled plan pages
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-muted">
          Drag onto a milestone to pin
        </div>
      </div>
      {DISCIPLINES.map((d) => {
        const list = grouped.get(d) ?? [];
        return (
          <section key={d}>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
              {d} · {list.length}
            </div>
            {list.length === 0 ? (
              <div className="border border-dashed border-line px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-muted">
                No pages classified
              </div>
            ) : (
              <div className="flex flex-col gap-[6px]">
                {list.map((s) => (
                  <DocChip
                    key={`${s.documentId}-${s.pageNumber}`}
                    id={`chip:${s.documentId}:${s.pageNumber}`}
                    sheet={s}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </aside>
  );
}
