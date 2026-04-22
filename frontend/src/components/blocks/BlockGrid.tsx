import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Wrap a grid so the 2 px gap + line-colored background produces the
 * single-hairline tile effect used across the Plumbline UI.
 *
 * Children must have their own background (e.g. bg-bg, bg-bg-1) so the
 * gap reads as a line between them.
 */
export function BlockGrid({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("grid gap-[2px] bg-[var(--line)]", className)}
      {...rest}
    />
  );
}
