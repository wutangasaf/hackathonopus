import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EyebrowProps = {
  children: ReactNode;
  className?: string;
  dotColor?: "brand" | "success" | "warn" | "danger";
};

const DOT_CLASS: Record<NonNullable<EyebrowProps["dotColor"]>, string> = {
  brand: "bg-brand",
  success: "bg-success",
  warn: "bg-warn",
  danger: "bg-danger",
};

export function Eyebrow({
  children,
  className,
  dotColor = "brand",
}: EyebrowProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[10px] font-mono text-[11px] uppercase tracking-eyebrow text-fg-dim",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("inline-block h-[6px] w-[6px]", DOT_CLASS[dotColor])}
      />
      {children}
    </span>
  );
}
