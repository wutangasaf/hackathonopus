export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const deltaMs = now.getTime() - then.getTime();

  if (Number.isNaN(deltaMs)) return iso;

  const s = Math.floor(deltaMs / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;

  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;

  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;

  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;

  const yyyy = then.getUTCFullYear();
  const mm = String(then.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(then.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
