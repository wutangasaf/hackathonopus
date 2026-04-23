import type { ReactNode } from "react";

/**
 * Section header pattern from Design Kit §3.4. 220px left rail holds the
 * mono chapter number (with a 2px orange vertical bar); right column
 * holds the headline and lead. Kills the orphaned-paragraph problem in
 * Pipeline-style sections.
 */
export function Chapter({
  number,
  title,
  lead,
}: {
  number: string;
  title: ReactNode;
  lead: string;
}) {
  return (
    <div className="mb-14 grid grid-cols-1 items-end gap-16 border-b border-line pb-8 lg:grid-cols-[220px_1fr]">
      <div className="relative pl-3.5 font-mono text-[11px] uppercase tracking-[0.16em] text-fg-dim">
        <span aria-hidden className="absolute left-0 top-1 bottom-1 w-0.5 bg-accent" />
        {number}
      </div>
      <div>
        <h2 className="text-[clamp(34px,4.4vw,60px)] font-extrabold leading-none tracking-[-0.035em]">
          {title}
        </h2>
        <p className="mt-4 max-w-[620px] text-base leading-relaxed text-fg-dim">
          {lead}
        </p>
      </div>
    </div>
  );
}
