import { Link, useParams } from "react-router-dom";

import { Chip } from "@/components/blocks/Chip";
import { Eyebrow } from "@/components/blocks/Eyebrow";
import { Container } from "@/components/layout/Container";
import { Nav } from "@/components/layout/Nav";
import { relativeTime } from "@/lib/time";
import type {
  ObservedState,
  PhotoAssessment,
  PhotoQuality,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePhotoDetail } from "@/services/photos";

export default function PhotoDetail() {
  const { id, photoId } = useParams<{ id: string; photoId: string }>();

  const detail = usePhotoDetail(id, photoId);

  return (
    <>
      <Nav />
      <Container className="py-12">
        <div className="mb-8 flex items-center gap-6">
          <Link
            to={`/projects/${id}`}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim transition-colors hover:text-fg"
          >
            ← Back to project
          </Link>
        </div>

        {detail.isLoading ? (
          <SkeletonScreen />
        ) : detail.isError || !detail.data ? (
          <div className="border-l-2 border-danger bg-bg-1 p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-danger">
              Error · photo unavailable
            </div>
            <p className="mt-2 font-mono text-[12px] text-fg-dim">
              {detail.error?.message ?? "not found"}
            </p>
          </div>
        ) : (
          <PhotoBody detail={detail.data} />
        )}
      </Container>
    </>
  );
}

function PhotoBody({
  detail,
}: {
  detail: ReturnType<typeof usePhotoDetail>["data"] & object;
}) {
  const { document, assessment, observation } = detail;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_1fr]">
      {/* Placeholder image tile + metadata */}
      <section className="border border-line-strong bg-bg-1">
        <div className="relative flex aspect-[4/3] items-center justify-center bg-[linear-gradient(135deg,#151515_0%,#0d0d0d_100%)]">
          <div
            aria-hidden
            className="absolute -left-px inset-y-0 w-0.5 bg-accent"
          />
          <div className="flex flex-col items-center gap-3">
            <div
              className="font-mono text-[clamp(56px,12vw,120px)] font-extrabold leading-none tracking-[-0.04em] text-fg-dim"
              aria-hidden
            >
              {document.originalFilename.charAt(0).toUpperCase() || "·"}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted">
              Thumbnail placeholder · serve route pending
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-line px-5 py-4 font-mono text-[11px] tracking-[0.08em] text-fg-dim">
          <div>
            <span className="text-fg-muted">File · </span>
            <b className="font-medium text-fg">
              {document.originalFilename}
            </b>
          </div>
          <div>
            <span className="text-fg-muted">MIME · </span>
            {document.mimeType}
          </div>
          <div>
            <span className="text-fg-muted">Received · </span>
            {relativeTime(document.serverReceivedAt)}
          </div>
          <div className="truncate">
            <span className="text-fg-muted">SHA256 · </span>
            {document.sha256}
          </div>
        </div>
      </section>

      <section className="space-y-8">
        <AssessmentBlock assessment={assessment} />
        <ObservationBlock observation={observation} />
      </section>
    </div>
  );
}

function AssessmentBlock({
  assessment,
}: {
  assessment: PhotoAssessment | null;
}) {
  return (
    <div>
      <Eyebrow>Agent 5 · Photo Quality</Eyebrow>
      <div className="mt-4 border border-line bg-bg-1 p-5">
        {!assessment ? (
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-muted">
            Assessment pending…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <QualityChip quality={assessment.quality} />
              {assessment.discipline && (
                <Chip>{assessment.discipline}</Chip>
              )}
              {assessment.matchedShotId && (
                <Chip tone="accent">
                  Shot {assessment.matchedShotId.slice(-6)}
                </Chip>
              )}
              {typeof assessment.phaseFit === "number" && (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
                  Phase fit · {(assessment.phaseFit * 100).toFixed(0)}%
                </span>
              )}
            </div>
            {assessment.issues.length > 0 && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
                  Issues
                </div>
                <ul className="mt-2 flex flex-col gap-1 font-mono text-[11px] leading-[1.55] text-fg-dim">
                  {assessment.issues.map((it, i) => (
                    <li key={i}>· {it}</li>
                  ))}
                </ul>
              </div>
            )}
            {assessment.retakeInstructions && (
              <div className="border-l-2 border-warn bg-bg px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-warn">
                  Retake instructions
                </div>
                <p className="mt-1 text-sm text-fg">
                  {assessment.retakeInstructions}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ObservationBlock({
  observation,
}: {
  observation: ReturnType<typeof usePhotoDetail>["data"] extends infer T
    ? T extends { observation: infer O }
      ? O
      : never
    : never;
}) {
  return (
    <div>
      <Eyebrow>Agent 6 · Photo → Plan format</Eyebrow>
      <div className="mt-4 border border-line bg-bg-1 p-5">
        {!observation ? (
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-muted">
            Observation skipped — photo not usable or discipline unclear.
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
                Matched elements · {observation.matchedElements.length}
              </div>
              <div className="mt-3 border border-line">
                <div className="grid grid-cols-[1fr_110px_110px_1fr] gap-px border-b border-line-strong bg-bg font-mono text-[10px] uppercase tracking-[0.12em] text-fg-muted">
                  <HCell>Element</HCell>
                  <HCell>State</HCell>
                  <HCell>Confidence</HCell>
                  <HCell>Evidence</HCell>
                </div>
                {observation.matchedElements.map((m, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_110px_110px_1fr] gap-px border-b border-line last:border-b-0"
                  >
                    <Cell>{m.elementId}</Cell>
                    <Cell>
                      <ObservedStateChip state={m.observedState} />
                      {m.observedPct !== undefined && (
                        <span className="ml-2 font-mono text-[10px] text-fg-muted">
                          {m.observedPct}%
                        </span>
                      )}
                    </Cell>
                    <Cell>{(m.confidence * 100).toFixed(0)}%</Cell>
                    <Cell className="truncate">{m.evidence}</Cell>
                  </div>
                ))}
              </div>
            </div>

            {observation.unexpectedObservations.length > 0 && (
              <ListBlock
                label="Unexpected observations"
                items={observation.unexpectedObservations}
                tone="warn"
              />
            )}
            {observation.safetyFlags.length > 0 && (
              <ListBlock
                label="Safety flags"
                items={observation.safetyFlags}
                tone="danger"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function QualityChip({ quality }: { quality: PhotoQuality }) {
  return (
    <Chip tone={quality === "GOOD" ? "success" : "danger"}>
      {quality.replace(/_/g, " ")}
    </Chip>
  );
}

function ObservedStateChip({ state }: { state: ObservedState }) {
  const tone: Parameters<typeof Chip>[0]["tone"] =
    state === "PRESENT"
      ? "success"
      : state === "PARTIAL"
        ? "warn"
        : state === "DEVIATED"
          ? "danger"
          : "default";
  return <Chip tone={tone}>{state}</Chip>;
}

function HCell({ children }: { children: React.ReactNode }) {
  return <div className="bg-bg-1 px-3 py-2">{children}</div>;
}

function Cell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-bg px-3 py-3 font-mono text-[11px] text-fg-dim",
        className,
      )}
    >
      {children}
    </div>
  );
}

function ListBlock({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "warn" | "danger";
}) {
  const borderCls = tone === "warn" ? "border-warn" : "border-danger";
  const labelCls = tone === "warn" ? "text-warn" : "text-danger";
  return (
    <div className={cn("border-l-2 bg-bg px-4 py-3", borderCls)}>
      <div
        className={cn(
          "font-mono text-[10px] uppercase tracking-[0.14em]",
          labelCls,
        )}
      >
        {label}
      </div>
      <ul className="mt-2 flex flex-col gap-1 text-sm leading-[1.55] text-fg-dim">
        {items.map((it, i) => (
          <li key={i}>· {it}</li>
        ))}
      </ul>
    </div>
  );
}

function SkeletonScreen() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_1fr]">
      <div className="aspect-[4/3] animate-pulse bg-bg-1" />
      <div className="space-y-4">
        <div className="h-12 animate-pulse bg-bg-1" />
        <div className="h-56 animate-pulse bg-bg-1" />
      </div>
    </div>
  );
}
