import { describe, expect, it } from "vitest";
import type { DayRecord } from "../../shared/history";
import { shouldShowAveragePercentage } from "./AverageArrow";
import {
  monthlyUsage,
  percentageDifference,
  trendDirection,
} from "./usageTrends";

function day(date: string, totalMs: number, allSitesMs?: number): DayRecord {
  return {
    date,
    totalMs,
    allSitesMs,
    notes: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("trendDirection", () => {
  it("returns diagonal directions outside the tolerance", () => {
    expect(trendDirection(121_000, 60_000, 60_000)).toBe("up");
    expect(trendDirection(0, 61_000, 60_000)).toBe("down");
  });

  it("treats differences within the tolerance as the same", () => {
    expect(trendDirection(120_000, 60_000, 60_000)).toBe("same");
    expect(trendDirection(0, 60_000, 60_000)).toBe("same");
  });
});

describe("percentageDifference", () => {
  it("returns the absolute percentage above or below the reference", () => {
    expect(percentageDifference(125, 100)).toBe(25);
    expect(percentageDifference(75, 100)).toBe(25);
  });

  it("does not invent a percentage for a zero reference", () => {
    expect(percentageDifference(100, 0)).toBeNull();
  });
});

describe("shouldShowAveragePercentage", () => {
  it("always shows upward percentages", () => {
    expect(shouldShowAveragePercentage("up", 190)).toBe(true);
  });

  it("hides downward percentages at 90 percent and above", () => {
    expect(shouldShowAveragePercentage("down", 89.9)).toBe(true);
    expect(shouldShowAveragePercentage("down", 90)).toBe(false);
    expect(shouldShowAveragePercentage("down", 100)).toBe(false);
  });
});

describe("monthlyUsage", () => {
  it("calculates tracked and available all-sites averages for one month", () => {
    const result = monthlyUsage([
      day("2026-10-01", 60_000, 180_000),
      day("2026-10-02", 180_000),
      day("2026-10-03", 300_000, 420_000),
      day("2026-09-30", 9_000_000, 9_000_000),
    ], 2026, 9);

    expect(result).toEqual({
      trackedAverageMs: 180_000,
      allSitesAverageMs: 300_000,
      dayCount: 3,
    });
  });

  it("handles a year boundary and months with no data", () => {
    expect(monthlyUsage([day("2025-12-15", 60_000)], 2025, 11).dayCount).toBe(1);
    expect(monthlyUsage([day("2025-12-15", 60_000)], 2026, 0)).toEqual({
      trackedAverageMs: null,
      allSitesAverageMs: null,
      dayCount: 0,
    });
  });
});
