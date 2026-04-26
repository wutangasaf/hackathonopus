import { Link, useParams } from "react-router-dom";

import { Chip } from "@/components/blocks/Chip";
import { Eyebrow } from "@/components/blocks/Eyebrow";
import { Container } from "@/components/layout/Container";
import { Nav } from "@/components/layout/Nav";
import { relativeTime } from "@/lib/time";
import {
  photoRawUrl,
  type ExifMeta,
  type ObservedState,
  type PhotoAssessment,
  type PhotoQuality,
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
          <PhotoBody detail={detail.data} projectId={id as string} />
        )}
      </Container>
    </>
  );
}

function PhotoBody({
  detail,
  projectId,
}: {
  detail: ReturnType<typeof usePhotoDetail>["data"] & object;
  projectId: string;
}) {
  const { document, assessment, observation } = detail;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_1fr]">
      <section className="space-y-6">
        <div className="relative overflow-hidden border border-line-strong bg-bg-1">
          <div
            aria-hidden
            className="absolute -left-px inset-y-0 z-10 w-0.5 bg-accent"
          />
          <img
            src={photoRawUrl(projectId, document._id)}
            alt={document.originalFilename}
            className="block max-h-[640px] w-full bg-bg-2 object-contain"
          />
        </div>

        <div className="flex flex-col gap-2 border border-line bg-bg-1 px-5 py-4 font-mono text-[11px] tracking-[0.08em] text-fg-dim">
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

        <ExifBlock exif={document.exifMeta} />
      </section>

      <section className="space-y-8">
        <AssessmentBlock assessment={assessment} />
        <ObservationBlock observation={observation} />
      </section>
    </div>
  );
}

// ---------- EXIF (timestamp + GPS authentication) ----------

function ExifBlock({ exif }: { exif: ExifMeta | undefined }) {
  // exif === undefined when the field was never attempted (pre-backend change).
  // exif?.present === false when attempted but no EXIF present.
  const recorded = exif?.present === true;
  const missing = exif?.present === false;
  const legacy = exif === undefined;

  return (
    <div>
      <Eyebrow>Capture authentication</Eyebrow>
      <div
        className={cn(
          "mt-4 border bg-bg-1 p-5",
          recorded ? "border-success/30" : missing ? "border-warn/40" : "border-line",
        )}
      >
        {legacy && (
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-muted">
            Legacy photo · no EXIF field recorded
          </div>
        )}

        {missing && (
          <>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-warn">
              NO EXIF ON RECORD
            </div>
            <p className="mt-2 text-sm leading-[1.55] text-fg-dim">
              The uploaded file had no embedded metadata — likely a screenshot,
              a web-download, or a format that strips EXIF. Time and place of
              capture can&apos;t be verified.{" "}
              {exif?.error && (
                <span className="font-mono text-[11px] text-fg-muted">
                  ({exif.error})
                </span>
              )}
            </p>
          </>
        )}

        {recorded && exif && (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ExifField label="Captured at">
              {exif.capturedAt ? (
                <>
                  <div className="text-fg">
                    {new Date(exif.capturedAt).toLocaleString()}
                  </div>
                  <div className="mt-1 font-mono text-[10px] tracking-[0.08em] text-fg-dim">
                    {relativeTime(exif.capturedAt)}
                  </div>
                </>
              ) : (
                <span className="text-fg-muted">not present</span>
              )}
            </ExifField>

            <ExifField label="Location">
              {exif.gps ? (
                <div>
                  <div className="font-mono text-fg">
                    {exif.gps.lat.toFixed(5)}, {exif.gps.lon.toFixed(5)}
                  </div>
                  {typeof exif.gps.altitude === "number" && (
                    <div className="mt-1 font-mono text-[10px] tracking-[0.08em] text-fg-dim">
                      alt {exif.gps.altitude.toFixed(0)} m
                    </div>
                  )}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${exif.gps.lat},${exif.gps.lon}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex font-mono text-[10px] uppercase tracking-[0.14em] text-accent transition-colors hover:text-[#67e8f9]"
                  >
                    Open in Maps ↗
                  </a>
                </div>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-warn">
                  no GPS — capture authentication incomplete
                </span>
              )}
            </ExifField>

            <ExifField label="Device">
              {exif.camera && (exif.camera.make || exif.camera.model) ? (
                <div className="text-fg">
                  {[exif.camera.make, exif.camera.model]
                    .filter(Boolean)
                    .join(" ")}
                </div>
              ) : (
                <span className="text-fg-muted">unknown</span>
              )}
            </ExifField>

            <ExifField label="Orientation">
              <span className="text-fg">{exif.orientation ?? "—"}</span>
            </ExifField>
          </dl>
        )}
      </div>
    </div>
  );
}

function ExifField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-fg-dim">{children}</dd>
    </div>
  );
}

// ---------- Agent 5 ----------

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

// ---------- Agent 6 ----------

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
