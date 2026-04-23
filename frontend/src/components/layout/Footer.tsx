import { Container } from "@/components/layout/Container";

const GITHUB_URL = "https://github.com/wutangasaf/hackathonopus";

export function Footer() {
  return (
    <footer className="py-10 font-mono text-[11px] tracking-wider text-fg-muted">
      <Container className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span aria-hidden className="inline-block h-3 w-[3px] bg-accent" />
          <span>PLUMBLINE · Build to plan. Release on proof.</span>
        </div>
        <div>
          © 2026 ·{" "}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="text-fg-dim transition-colors hover:text-fg"
          >
            GitHub ↗
          </a>
        </div>
      </Container>
    </footer>
  );
}
