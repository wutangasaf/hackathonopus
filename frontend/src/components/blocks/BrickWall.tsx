import { cn } from "@/lib/utils";

type Variant = "base" | "mid" | "hi" | "on" | "onGlow";

const VARIANT_CLASS: Record<Variant, string> = {
  base: "bg-bg-2 border border-line",
  mid: "bg-bg-3 border border-line",
  hi: "bg-[#2a2a2a] border border-line",
  on: "bg-accent border border-accent",
  onGlow: "bg-accent border border-accent animate-glow",
};

// Mirrors the 7×8 cell layout from design/mockup.html.
const WALL: Variant[] = [
  // row 1
  "base", "hi", "base", "base", "mid", "base", "base", "base",
  // row 2
  "mid", "base", "base", "onGlow", "base", "hi", "base", "mid",
  // row 3
  "base", "hi", "mid", "base", "base", "base", "onGlow", "base",
  // row 4
  "base", "base", "base", "mid", "on", "hi", "base", "base",
  // row 5
  "mid", "base", "on", "base", "base", "mid", "base", "hi",
  // row 6
  "base", "onGlow", "base", "hi", "mid", "base", "base", "base",
  // row 7
  "hi", "base", "base", "mid", "base", "base", "on", "mid",
];

export function BrickWall() {
  return (
    <div
      aria-hidden
      className="grid w-full max-w-[420px] justify-self-end gap-[2px]"
      style={{
        gridTemplateColumns: "repeat(8, 1fr)",
        gridAutoRows: "38px",
      }}
    >
      {WALL.map((v, i) => (
        <div key={i} className={cn(VARIANT_CLASS[v])} />
      ))}
    </div>
  );
}
