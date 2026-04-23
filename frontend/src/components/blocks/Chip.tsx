import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ChipTone = "default" | "accent" | "success" | "warn" | "danger";

type ChipProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: ChipTone;
};

const TONE_CLASS: Record<ChipTone, string> = {
  default: "border-line-strong text-fg-dim",
  accent: "border-accent/60 text-accent",
  success: "border-success/40 text-success",
  warn: "border-warn/50 text-warn",
  danger: "border-danger/40 text-danger",
};

export function Chip({ className, tone = "default", ...rest }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-block border px-[10px] py-[4px] font-mono text-[10px] uppercase tracking-mono",
        TONE_CLASS[tone],
        className,
      )}
      {...rest}
    />
  );
}
