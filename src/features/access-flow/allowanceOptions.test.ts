import { describe, expect, it } from "vitest";
import {
  allowanceOptions,
  completedTrackedAverageMs,
  isAllowanceMinutesAllowed,
} from "./allowanceOptions";
import type { DayRecord } from "../../shared/history";

const MINUTE = 60_000;

function day(date: string, totalMs: number): DayRecord {
  return {
    date,
    totalMs,
    notes: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("completedTrackedAverageMs", () => {
  it("averages only wake-days before the current wake-day", () => {
    const currentWakeDayStart = new Date(2026, 7, 14, 7).getTime();
    expect(completedTrackedAverageMs([
      day("2026-08-12", 10 * MINUTE),
      day("2026-08-13", 30 * MINUTE),
      day("2026-08-14", 90 * MINUTE),
      day("2026-08-15", 120 * MINUTE),
    ], currentWakeDayStart)).toBe(20 * MINUTE);
  });

  it("returns null when there is no completed history", () => {
    const currentWakeDayStart = new Date(2026, 7, 14, 7).getTime();
    expect(completedTrackedAverageMs([], currentWakeDayStart)).toBeNull();
    expect(completedTrackedAverageMs([
      day("2026-08-14", 30 * MINUTE),
    ], currentWakeDayStart)).toBeNull();
  });
});

describe("allowanceOptions", () => {
  it("shows the expected options for a 30-minute average", () => {
    expect(allowanceOptions(30 * MINUTE)).toEqual([
      { minutes: 15, showDownArrow: false },
      { minutes: 27, showDownArrow: true },
      { minutes: 30, showDownArrow: false },
    ]);
  });

  it("shows only fixed options without history", () => {
    expect(allowanceOptions(null)).toEqual([
      { minutes: 15, showDownArrow: false },
      { minutes: 30, showDownArrow: false },
    ]);
  });

  it("rounds to the nearest minute before sorting", () => {
    expect(allowanceOptions(29.5 * MINUTE)).toEqual([
      { minutes: 15, showDownArrow: false },
      { minutes: 27, showDownArrow: true },
      { minutes: 30, showDownArrow: false },
    ]);
    expect(allowanceOptions(50 * MINUTE)).toEqual([
      { minutes: 15, showDownArrow: false },
      { minutes: 30, showDownArrow: false },
      { minutes: 45, showDownArrow: true },
    ]);
  });

  it("clamps the dynamic option to two minutes and hides a misleading arrow", () => {
    expect(allowanceOptions(1.5 * MINUTE)).toEqual([
      { minutes: 2, showDownArrow: false },
      { minutes: 15, showDownArrow: false },
      { minutes: 30, showDownArrow: false },
    ]);
  });

  it("hides the arrow when the displayed option is not below the exact average", () => {
    expect(allowanceOptions(5 * MINUTE)).toEqual([
      { minutes: 5, showDownArrow: false },
      { minutes: 15, showDownArrow: false },
      { minutes: 30, showDownArrow: false },
    ]);
  });

  it("merges a dynamic option that matches a fixed option", () => {
    expect(allowanceOptions((15 / 0.9) * MINUTE)).toEqual([
      { minutes: 15, showDownArrow: true },
      { minutes: 30, showDownArrow: false },
    ]);
    expect(allowanceOptions((30 / 0.9) * MINUTE)).toEqual([
      { minutes: 15, showDownArrow: false },
      { minutes: 30, showDownArrow: true },
    ]);
  });

  it("allows only fixed choices and the current dynamic choice", () => {
    expect(isAllowanceMinutesAllowed(15, 30 * MINUTE)).toBe(true);
    expect(isAllowanceMinutesAllowed(27, 30 * MINUTE)).toBe(true);
    expect(isAllowanceMinutesAllowed(30, 30 * MINUTE)).toBe(true);
    expect(isAllowanceMinutesAllowed(10, 30 * MINUTE)).toBe(false);
    expect(isAllowanceMinutesAllowed(27, null)).toBe(false);
    expect(isAllowanceMinutesAllowed(27, 40 * MINUTE)).toBe(false);
  });
});
