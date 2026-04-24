import { CONTRACTOR_USER } from "@/lib/hardcoded";

export function DrawHeaderStrip({
  projectName,
  drawNumber,
}: {
  projectName?: string;
  drawNumber?: number;
}) {
  const licenseChunk = CONTRACTOR_USER.licenseNumber
    ? ` · LIC ${CONTRACTOR_USER.licenseNumber}`
    : "";
  const left = `CONTRACTOR · ${CONTRACTOR_USER.companyName.toUpperCase()}${licenseChunk}`;

  return (
    <header className="border-b border-line-strong">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-3 px-8 py-4">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg">
          {left}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {projectName && (
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-dim">
              {projectName}
              {drawNumber ? (
                <>
                  {" · "}
                  <span className="text-fg">DRAW #{drawNumber}</span>
                </>
              ) : null}
            </div>
          )}
          <span className="inline-flex items-center gap-2 border border-line bg-bg-2 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_var(--accent-glow)]" />
            PREVIEW · CONTRACTOR VIEW
          </span>
        </div>
      </div>
    </header>
  );
}
