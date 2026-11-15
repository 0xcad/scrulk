import { describe, expect, it } from "vitest";
import type { DayRecord } from "../../shared/history";
import type { MonthlyUsage } from "./usageTrends";
import { calendarChartMaximum } from "./CalendarChart";

function day(
  totalMs: number,
  allSitesMs?: number,
  focusMs?: number,
): DayRecord {
  return {
    date: "2026-11-01",
    totalMs,
    allSitesMs,
    focusMs,
    notes: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

function averages(
  trackedAverageMs: number | null,
  allSitesAverageMs: number | null,
): MonthlyUsage {
  return { trackedAverageMs, allSitesAverageMs, dayCount: 1 };
}

describe("calendarChartMaximum", () => {
  it("scales the full chart from all-sites bars and averages with headroom", () => {
    expect(calendarChartMaximum(
      [day(20, 100, 30)],
      averages(20, 80),
      true,
    )).toBeCloseTo(112);

    expect(calendarChartMaximum(
      [day(20, 100, 30)],
      averages(20, 120),
      true,
    )).toBeCloseTo(134.4);
  });

  it("ignores all-sites values in tracked-only mode", () => {
    expect(calendarChartMaximum(
      [day(20, 100, 30)],
      averages(40, 120),
      false,
    )).toBeCloseTo(44.8);
  });

  it("keeps an empty chart scale finite", () => {
    expect(calendarChartMaximum(
      [],
      averages(null, null),
      true,
    )).toBeCloseTo(1.12);
  });
});
