import { Container } from "@/components/layout/Container";

const GITHUB_URL = "https://github.com/wutangasaf/hackathonopus";

export function Footer() {
  return (
    <footer className="border-t border-line py-20 font-mono text-[11px] tracking-mono text-fg-muted">
      <Container className="flex items-center justify-between">
        <span>PLUMBLINE · BUILT WITH OPUS 4.7 · 2026-04-22</span>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="text-fg-dim transition-colors hover:text-fg"
        >
          GitHub ↗
        </a>
      </Container>
    </footer>
  );
}
