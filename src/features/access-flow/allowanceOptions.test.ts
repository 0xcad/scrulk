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
  it("subtracts today's tracked usage from 90% of the average", () => {
    expect(allowanceOptions(30 * MINUTE, 5 * MINUTE)).toEqual([
      { minutes: 15, showDownArrow: false },
      { minutes: 22, showDownArrow: true },
      { minutes: 30, showDownArrow: false },
    ]);
  });

  it("shows only fixed options without history", () => {
    expect(allowanceOptions(null, 20 * MINUTE)).toEqual([
      { minutes: 15, showDownArrow: false },
      { minutes: 30, showDownArrow: false },
    ]);
  });

  it("rounds the remaining time to the nearest minute before sorting", () => {
    expect(allowanceOptions(30 * MINUTE, 2.4 * MINUTE)).toEqual([
      { minutes: 15, showDownArrow: false },
      { minutes: 25, showDownArrow: true },
      { minutes: 30, showDownArrow: false },
    ]);
    expect(allowanceOptions(50 * MINUTE, 0)).toEqual([
      { minutes: 15, showDownArrow: false },
      { minutes: 30, showDownArrow: false },
      { minutes: 45, showDownArrow: true },
    ]);
  });

  it("clamps the dynamic option to two minutes and hides a misleading arrow", () => {
    expect(allowanceOptions(1.5 * MINUTE, 1 * MINUTE)).toEqual([
      { minutes: 2, showDownArrow: false },
      { minutes: 15, showDownArrow: false },
      { minutes: 30, showDownArrow: false },
    ]);
    expect(allowanceOptions(30 * MINUTE, 40 * MINUTE)).toEqual([
      { minutes: 2, showDownArrow: true },
      { minutes: 15, showDownArrow: false },
      { minutes: 30, showDownArrow: false },
    ]);
  });

  it("hides the arrow when the displayed option is not below the exact average", () => {
    expect(allowanceOptions(5 * MINUTE, 0)).toEqual([
      { minutes: 5, showDownArrow: false },
      { minutes: 15, showDownArrow: false },
      { minutes: 30, showDownArrow: false },
    ]);
  });

  it("merges a dynamic option that matches a fixed option", () => {
    expect(allowanceOptions((15 / 0.9) * MINUTE, 0)).toEqual([
      { minutes: 15, showDownArrow: true },
      { minutes: 30, showDownArrow: false },
    ]);
    expect(allowanceOptions((30 / 0.9) * MINUTE, 0)).toEqual([
      { minutes: 15, showDownArrow: false },
      { minutes: 30, showDownArrow: true },
    ]);
  });

  it("allows only fixed choices and the current dynamic choice", () => {
    expect(isAllowanceMinutesAllowed(15, 30 * MINUTE, 5 * MINUTE)).toBe(true);
    expect(isAllowanceMinutesAllowed(22, 30 * MINUTE, 5 * MINUTE)).toBe(true);
    expect(isAllowanceMinutesAllowed(30, 30 * MINUTE, 5 * MINUTE)).toBe(true);
    expect(isAllowanceMinutesAllowed(10, 30 * MINUTE, 5 * MINUTE)).toBe(false);
    expect(isAllowanceMinutesAllowed(22, null, 5 * MINUTE)).toBe(false);
    expect(isAllowanceMinutesAllowed(22, 40 * MINUTE, 5 * MINUTE)).toBe(false);
  });
});
