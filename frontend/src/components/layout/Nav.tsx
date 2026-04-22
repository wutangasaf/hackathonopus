import { Link, NavLink } from "react-router-dom";

import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/#inputs", label: "Inputs", anchor: true },
  { href: "/#pipeline", label: "Pipeline", anchor: true },
  { href: "/#report", label: "Report", anchor: true },
];

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-line bg-[rgba(10,10,10,0.82)] backdrop-blur-md backdrop-saturate-150">
      <Container className="flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-[10px]">
          <span
            aria-hidden
            className="inline-block h-[14px] w-[3px] bg-brand"
            style={{ boxShadow: "0 0 12px rgba(255, 107, 26, 0.4)" }}
          />
          <span className="font-mono text-[13px] font-bold uppercase tracking-eyebrow">
            Plumbline
          </span>
        </Link>
        <ul className="hidden items-center gap-10 font-mono text-[11px] uppercase tracking-mono md:flex">
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
            <NavLink
              to="/projects"
              className={({ isActive }) =>
                cn(
                  "border-b border-brand pb-[2px] text-fg transition-colors",
                  !isActive && "hover:text-fg",
                )
              }
            >
              Projects
            </NavLink>
          </li>
        </ul>
      </Container>
    </nav>
  );
}
