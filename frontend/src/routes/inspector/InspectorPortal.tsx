import { Link } from "react-router-dom";

import { Eyebrow } from "@/components/blocks/Eyebrow";
import { Container } from "@/components/layout/Container";
import { Nav } from "@/components/layout/Nav";
import { relativeTime } from "@/lib/time";
import type { Project } from "@/lib/types";
import { useProjects } from "@/services/projects";

export default function InspectorPortal() {
  const projects = useProjects();

  return (
    <>
      <Nav />
      <Container className="py-14">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow>Inspector portal</Eyebrow>
            <h1 className="mt-4 text-[clamp(32px,5vw,56px)] font-extrabold leading-[0.95] tracking-[-0.03em] text-fg">
              Verify a draw.
            </h1>
            <p className="mt-4 max-w-[560px] text-[14px] leading-[1.6] text-fg-dim">
              Pick the project you&apos;re inspecting. Plumbline hands you a
              shot list tied to the approved G703 — capture each one from
              your phone, drone, or sensor feed.
            </p>
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-dim">
            Viewing as · Site Inspector
          </div>
        </header>

        <div className="mt-12">
          <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-dim">
            01 · Pick a project
          </div>

          {projects.isLoading ? (
            <SkeletonRows count={3} />
          ) : projects.isError ? (
            <div className="border-l-2 border-danger bg-bg-1 p-4 font-mono text-[11px] text-fg-dim">
              {projects.error?.message ?? "Failed to load projects"}
            </div>
          ) : !projects.data || projects.data.length === 0 ? (
            <div className="border border-dashed border-line-strong bg-bg-1 p-8 font-mono text-[12px] leading-[1.6] text-fg-dim">
              NO PROJECTS YET · ASK YOUR LENDER TO CREATE ONE FIRST
            </div>
          ) : (
            <ul className="border border-line">
              {projects.data.map((p) => (
                <ProjectRow key={p._id} project={p} />
              ))}
            </ul>
          )}
        </div>

        <div className="mt-10 border-l-2 border-accent bg-bg-1 p-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
            What happens next
          </div>
          <ol className="mt-3 space-y-1.5 text-[13px] leading-[1.6] text-fg-dim">
            <li>
              <span className="mr-2 font-mono text-[11px] uppercase text-fg-muted">
                01
              </span>
              Pick a project and a capture device.
            </li>
            <li>
              <span className="mr-2 font-mono text-[11px] uppercase text-fg-muted">
                02
              </span>
              Shoot every item on the shot list — each photo is
              timestamped and tagged to a G703 line.
            </li>
            <li>
              <span className="mr-2 font-mono text-[11px] uppercase text-fg-muted">
                03
              </span>
              Agent 5 grades capture quality; Agent 7 reconciles coverage
              against the draw before the bank releases funds.
            </li>
          </ol>
        </div>
      </Container>
    </>
  );
}

function ProjectRow({ project }: { project: Project }) {
  return (
    <li>
      <Link
        to={`/inspector/${project._id}`}
        className="group grid grid-cols-[1fr_auto] items-center gap-6 border-b border-line bg-bg px-5 py-5 transition-colors last:border-b-0 hover:bg-bg-1"
      >
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-fg">
            {project.name}
          </h3>
          <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.12em] text-fg-dim">
            {project.address && <span>{project.address}</span>}
            <span>Created {relativeTime(project.createdAt)}</span>
            <span>ID {project._id.slice(-8)}</span>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 border border-line-strong px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fg transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-black">
          Open shot list
          <span aria-hidden>↗</span>
        </span>
      </Link>
    </li>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse bg-bg-1" aria-hidden />
      ))}
    </div>
  );
}
