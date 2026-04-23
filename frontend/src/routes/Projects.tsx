import { Plus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { BlockGrid } from "@/components/blocks/BlockGrid";
import { Chip } from "@/components/blocks/Chip";
import { Eyebrow } from "@/components/blocks/Eyebrow";
import { Container } from "@/components/layout/Container";
import { Nav } from "@/components/layout/Nav";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { relativeTime } from "@/lib/time";
import type { Project, ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCreateProject, useProjects } from "@/services/projects";

export default function Projects() {
  const { data, isLoading, isError, error } = useProjects();
  const count = data?.length ?? 0;

  return (
    <>
      <Nav />
      <Container className="py-20">
        <header className="flex flex-wrap items-end justify-between gap-10 border-b border-line pb-10">
          <div>
            <Eyebrow>02 · Projects</Eyebrow>
            <h1 className="mt-6 font-extrabold leading-none tracking-tight2 text-fg text-[clamp(40px,6vw,96px)]">
              Your projects.
            </h1>
            <p className="mt-4 font-mono text-[11px] uppercase tracking-mono text-fg-muted">
              {isLoading
                ? "Loading…"
                : isError
                  ? "—"
                  : `${count} ${count === 1 ? "active project" : "active projects"}`}
            </p>
          </div>
          <NewProjectDialog />
        </header>

        <div className="mt-10">
          {isLoading ? (
            <LoadingSkeleton />
          ) : isError ? (
            <ErrorBanner error={error} />
          ) : !data || data.length === 0 ? (
            <EmptyState />
          ) : (
            <ProjectList projects={data} />
          )}
        </div>
      </Container>
    </>
  );
}

function ProjectList({ projects }: { projects: Project[] }) {
  return (
    <BlockGrid className="grid-cols-1 lg:grid-cols-2">
      {projects.map((p) => (
        <ProjectCard key={p._id} project={p} />
      ))}
    </BlockGrid>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to={`/projects/${project._id}`}
      className="group flex min-h-[180px] flex-col justify-between bg-bg px-7 py-7 transition-colors hover:bg-bg-1"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[20px] font-bold leading-tight tracking-[-0.01em] text-fg">
            {project.name}
          </h3>
          <p className="mt-2 text-sm text-fg-dim">
            {project.address ?? <span className="text-fg-muted">—</span>}
          </p>
        </div>
        <StatusChip status={project.status} />
      </header>
      <footer className="mt-8 flex items-center justify-between font-mono text-[10px] uppercase tracking-mono text-fg-muted">
        <span>Created {relativeTime(project.createdAt)}</span>
        <span
          aria-hidden
          className="opacity-0 transition-opacity group-hover:opacity-100"
        >
          Open ↗
        </span>
      </footer>
    </Link>
  );
}

function StatusChip({ status }: { status: ProjectStatus }) {
  const tone = ((): "default" | "brand" | "success" => {
    switch (status) {
      case "SETUP":
        return "default";
      case "ACTIVE":
        return "brand";
      case "COMPLETED":
        return "success";
    }
  })();
  return <Chip tone={tone}>{status}</Chip>;
}

function LoadingSkeleton() {
  return (
    <BlockGrid className="grid-cols-1 lg:grid-cols-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="min-h-[180px] animate-pulse bg-bg-1 px-7 py-7"
          aria-hidden
        >
          <div className="h-5 w-1/2 bg-bg-2" />
          <div className="mt-3 h-3 w-2/3 bg-bg-2" />
          <div className="mt-10 h-3 w-1/3 bg-bg-2" />
        </div>
      ))}
    </BlockGrid>
  );
}

function ErrorBanner({ error }: { error: unknown }) {
  const msg =
    error instanceof ApiError
      ? `${error.status} · ${error.body.slice(0, 160)}`
      : error instanceof Error
        ? error.message
        : "Unknown error";

  return (
    <div className="border-l-2 border-danger bg-bg-1 p-5">
      <div className="font-mono text-[10px] uppercase tracking-mono text-danger">
        Failed to load projects
      </div>
      <p className="mt-2 font-mono text-[12px] leading-relaxed text-fg-dim">
        {msg}
      </p>
      <p className="mt-3 text-xs text-fg-muted">
        Is the backend running? In dev, the Vite server proxies{" "}
        <code className="text-fg-dim">/api</code> to{" "}
        <code className="text-fg-dim">http://localhost:4000</code>.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-line-strong px-8 py-24 text-center">
      <Eyebrow>No projects yet</Eyebrow>
      <h2 className="mt-6 text-3xl font-extrabold tracking-tight2 lg:text-4xl">
        Spin up the first one.
      </h2>
      <p className="mt-3 max-w-md text-sm text-fg-dim">
        A project holds approved plans, the finance plan with milestones, and
        every photo uploaded against it. Create one below to begin.
      </p>
      <div className="mt-8">
        <NewProjectDialog label="Create the first project" />
      </div>
    </div>
  );
}

function NewProjectDialog({
  label = "New project",
}: {
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const navigate = useNavigate();

  const mutation = useCreateProject({
    onSuccess: (project) => {
      setOpen(false);
      setName("");
      setAddress("");
      setFormError(null);
      navigate(`/projects/${project._id}`);
    },
    onError: (err) => {
      setFormError(`${err.status} · ${err.body.slice(0, 160)}`);
    },
  });

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setFormError("Name must be at least 2 characters.");
      return;
    }
    const trimmedAddr = address.trim();
    mutation.mutate({
      name: trimmed,
      ...(trimmedAddr ? { address: trimmedAddr } : {}),
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setFormError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button
          className={cn(
            "h-auto gap-[10px] rounded-none border border-transparent bg-brand px-[26px] py-[14px] font-mono text-[11px] font-semibold uppercase tracking-eyebrow text-black shadow-none",
            "hover:bg-[#ff8940] hover:shadow-[0_0_0_3px_rgba(255,107,26,0.15)]",
          )}
        >
          <Plus className="!size-3.5" strokeWidth={2} />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-none border border-line bg-bg-1 text-fg sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-extrabold tracking-tight2">
            New project
          </DialogTitle>
          <DialogDescription className="font-mono text-[11px] uppercase tracking-mono text-fg-muted">
            Gives plans, finance plan, and photos a shared home.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-name" className="font-mono text-[10px] uppercase tracking-mono text-fg-dim">
              Name *
            </Label>
            <Input
              id="project-name"
              autoFocus
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Potwine Passive House"
              className="rounded-none border-line-strong bg-bg text-fg placeholder:text-fg-muted"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-address" className="font-mono text-[10px] uppercase tracking-mono text-fg-dim">
              Address
            </Label>
            <Input
              id="project-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Somewhere Rd, Amherst MA"
              className="rounded-none border-line-strong bg-bg text-fg placeholder:text-fg-muted"
            />
          </div>
          {formError && (
            <p className="font-mono text-[11px] tracking-[0.04em] text-danger">
              {formError}
            </p>
          )}
          <DialogFooter className="mt-2 gap-2 sm:flex-row-reverse">
            <Button
              type="submit"
              disabled={mutation.isPending}
              className={cn(
                "h-auto rounded-none border border-transparent bg-brand px-6 py-3 font-mono text-[11px] font-semibold uppercase tracking-eyebrow text-black shadow-none",
                "hover:bg-[#ff8940] hover:shadow-[0_0_0_3px_rgba(255,107,26,0.15)]",
                "disabled:bg-brand/60",
              )}
            >
              {mutation.isPending ? "Creating…" : "Create project"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="h-auto rounded-none border border-line-strong px-6 py-3 font-mono text-[11px] uppercase tracking-eyebrow text-fg hover:bg-bg-2"
            >
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
