import { describe, expect, it } from "vitest";
import { relativeTime } from "@/lib/time";

const NOW = new Date("2026-04-25T12:00:00Z");

describe("relativeTime", () => {
  it("returns 'just now' for deltas under 5 seconds", () => {
    const t = new Date(NOW.getTime() - 2_000).toISOString();
    expect(relativeTime(t, NOW)).toBe("just now");
  });

  it("formats seconds in the [5, 60) range", () => {
    const t = new Date(NOW.getTime() - 30_000).toISOString();
    expect(relativeTime(t, NOW)).toBe("30s ago");
  });

  it("formats minutes in the [1m, 60m) range", () => {
    const t = new Date(NOW.getTime() - 5 * 60_000).toISOString();
    expect(relativeTime(t, NOW)).toBe("5m ago");
  });

  it("formats hours in the [1h, 24h) range", () => {
    const t = new Date(NOW.getTime() - 2 * 60 * 60_000).toISOString();
    expect(relativeTime(t, NOW)).toBe("2h ago");
  });

  it("formats days in the [1d, 7d) range", () => {
    const t = new Date(NOW.getTime() - 3 * 24 * 60 * 60_000).toISOString();
    expect(relativeTime(t, NOW)).toBe("3d ago");
  });

  it("falls back to a UTC YYYY-MM-DD string after 7 days", () => {
    const t = new Date(NOW.getTime() - 30 * 24 * 60 * 60_000).toISOString();
    // 30 days before 2026-04-25 → 2026-03-26
    expect(relativeTime(t, NOW)).toBe("2026-03-26");
  });

  it("returns the input unchanged when iso is unparseable", () => {
    expect(relativeTime("definitely-not-a-date", NOW)).toBe(
      "definitely-not-a-date",
    );
  });
});
