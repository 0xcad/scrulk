import { describe, expect, it } from "vitest";
import { dateKey, heatBucket } from "./history";

describe("dateKey", () => {
  it("formats local date as YYYY-MM-DD", () => {
    const ms = new Date(2026, 4, 8, 7, 0, 0, 0).getTime(); // May 8 2026 local
    expect(dateKey(ms)).toBe("2026-05-08");
  });

  it("zero-pads single-digit months and days", () => {
    const ms = new Date(2026, 0, 3, 0, 0, 0, 0).getTime();
    expect(dateKey(ms)).toBe("2026-01-03");
  });
});

describe("heatBucket", () => {
  it("returns 0 for no usage", () => {
    expect(heatBucket(0)).toBe(0);
  });

  it("buckets by fixed thresholds", () => {
    expect(heatBucket(1)).toBe(1);
    expect(heatBucket(29 * 60_000)).toBe(1);
    expect(heatBucket(30 * 60_000)).toBe(2);
    expect(heatBucket(59 * 60_000)).toBe(2);
    expect(heatBucket(60 * 60_000)).toBe(3);
    expect(heatBucket(119 * 60_000)).toBe(3);
    expect(heatBucket(120 * 60_000)).toBe(4);
    expect(heatBucket(10 * 3600_000)).toBe(4);
  });
});
