import { Link } from "react-router-dom";

import { Container } from "@/components/layout/Container";

const LINKS = [
  { href: "/#inputs", label: "Inputs" },
  { href: "/#pipeline", label: "Pipeline" },
  { href: "/#report", label: "Report" },
];

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-line bg-[rgba(10,10,10,0.82)] backdrop-blur-md backdrop-saturate-150">
      <Container className="flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-[10px]">
          <span
            aria-hidden
            className="inline-block h-[14px] w-[3px] bg-accent"
            style={{ boxShadow: "0 0 12px rgba(34, 211, 238, 0.55)" }}
          />
          <span className="font-mono text-[13px] font-bold uppercase tracking-[0.16em]">
            Plumbline.ai
          </span>
        </Link>
        <ul className="hidden items-center gap-9 font-mono text-[11px] uppercase tracking-[0.14em] md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-fg-dim transition-colors hover:text-fg"
              >
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <Link
              to="/projects"
              className="bg-accent px-3.5 py-2 text-black transition-colors hover:bg-[#67e8f9]"
            >
              Open app ↗
            </Link>
          </li>
        </ul>
      </Container>
    </nav>
  );
}
