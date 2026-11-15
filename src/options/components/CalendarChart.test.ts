import { describe, expect, it } from "vitest";
import type { DayRecord } from "../../shared/history";
import type { MonthlyUsage } from "./usageTrends";
import {
  calendarChartMaximum,
  displayedUsage,
  hourGuideValues,
  maximumDisplayedUsage,
} from "./CalendarChart";

function day(
  totalMs: number,
  allSitesMs?: number,
  focusMs?: number,
  date = "2026-11-01",
): DayRecord {
  return {
    date,
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

describe("displayedUsage", () => {
  it("switches between normalized total and tracked usage", () => {
    const record = day(20, 100, 30);
    expect(displayedUsage(record, true)).toBe(100);
    expect(displayedUsage(record, false)).toBe(20);
  });

  it("clamps negative tracked usage", () => {
    expect(displayedUsage(day(-1), false)).toBe(0);
  });
});

describe("maximumDisplayedUsage", () => {
  it("chooses the earliest day when maximum totals tie", () => {
    expect(maximumDisplayedUsage([
      day(20, 100, 0, "2026-11-03"),
      day(90, 100, 0, "2026-11-01"),
      day(30, 80, 0, "2026-11-02"),
    ], true)).toEqual({ date: "2026-11-01", valueMs: 100 });
  });

  it("uses tracked values in tracked-only mode", () => {
    expect(maximumDisplayedUsage([
      day(20, 100, 0, "2026-11-01"),
      day(90, 95, 0, "2026-11-02"),
    ], false)).toEqual({ date: "2026-11-02", valueMs: 90 });
  });

  it("omits a maximum when every displayed value is zero", () => {
    expect(maximumDisplayedUsage([day(0, 0)], true)).toBeNull();
  });
});

describe("hourGuideValues", () => {
  const HOUR = 60 * 60_000;
  const MINUTE = 60_000;

  it("draws whole hours through the maximum displayed bar", () => {
    expect(hourGuideValues(3 * HOUR, [])).toEqual([
      HOUR,
      2 * HOUR,
      3 * HOUR,
    ]);
    expect(hourGuideValues(3 * HOUR - 1, [])).toEqual([HOUR, 2 * HOUR]);
  });

  it("suppresses guides within ten minutes of displayed averages", () => {
    expect(hourGuideValues(3 * HOUR, [
      HOUR + 6 * MINUTE,
      2 * HOUR + 6 * MINUTE,
    ])).toEqual([3 * HOUR]);
  });

  it("treats exactly ten minutes as within the exclusion", () => {
    expect(hourGuideValues(2 * HOUR, [HOUR + 10 * MINUTE])).toEqual([
      2 * HOUR,
    ]);
    expect(hourGuideValues(2 * HOUR, [HOUR + 10 * MINUTE + 1])).toEqual([
      HOUR,
      2 * HOUR,
    ]);
  });
});
