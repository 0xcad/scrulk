import { describe, expect, it } from "vitest";
import type { DayRecord } from "../../shared/history";
import {
  daysWithScrulk,
  defaultSummaryTimeframe,
  summaryUsage,
} from "./summaryStats";

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

describe("summary stats", () => {
  it("counts the inclusive span from the earliest database day", () => {
    const days = [day("2026-11-02", 1), day("2026-10-30", 1)];
    expect(daysWithScrulk(days, "2026-11-03")).toBe(5);
    expect(daysWithScrulk([], "2026-11-03")).toBe(0);
  });

  it("chooses the largest fixed timeframe supported by the history span", () => {
    expect(defaultSummaryTimeframe([day("2026-10-16", 1)], "2026-11-14"))
      .toBe("30d");
    expect(defaultSummaryTimeframe([day("2026-11-08", 1)], "2026-11-14"))
      .toBe("7d");
    expect(defaultSummaryTimeframe([day("2026-11-09", 1)], "2026-11-14"))
      .toBe("1d");
  });

  it("includes zero-use calendar days and compares equal prior periods", () => {
    const result = summaryUsage([
      day("2026-11-01", 60_000),
      day("2026-11-07", 360_000),
      day("2026-11-08", 420_000),
      day("2026-11-14", 420_000),
    ], "2026-11-14", "7d");

    expect(result.tracked.averageMs).toBe(120_000);
    expect(result.tracked.previousAverageMs).toBe(60_000);
    expect(result.tracked.direction).toBe("up");
    expect(result.tracked.percentage).toBe(100);
  });

  it("does not show a trend until a complete previous period exists", () => {
    const result = summaryUsage([
      day("2026-11-10", 300_000),
      day("2026-11-14", 300_000),
    ], "2026-11-14", "7d");

    expect(result.tracked.averageMs).toBe(120_000);
    expect(result.tracked.previousAverageMs).toBeNull();
    expect(result.tracked.direction).toBeNull();
  });

  it("starts all-sites averages when all-sites history becomes available", () => {
    const result = summaryUsage([
      day("2026-11-01", 60_000),
      day("2026-11-10", 60_000, 300_000),
      day("2026-11-14", 60_000, 300_000),
    ], "2026-11-14", "30d");

    expect(result.allSites.averageMs).toBe(120_000);
    expect(result.allSites.previousAverageMs).toBeNull();
  });

  it("averages all available history without inventing a prior period", () => {
    const result = summaryUsage([
      day("2025-12-31", 100),
      day("2026-01-02", 200),
    ], "2026-01-02", "all");

    expect(result.tracked.averageMs).toBe(100);
    expect(result.tracked.previousAverageMs).toBeNull();
    expect(result.tracked.direction).toBeNull();
  });
});
