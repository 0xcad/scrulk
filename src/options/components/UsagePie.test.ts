import { describe, expect, it } from "vitest";
import { usageBreakdown } from "./UsagePie";

describe("usageBreakdown", () => {
  it("partitions all-sites time into focus, tracked, and non-focus time", () => {
    expect(usageBreakdown({
      date: "2026-08-25",
      totalMs: 20,
      allSitesMs: 100,
      focusMs: 30,
      notes: null,
      createdAt: 1,
      updatedAt: 1,
    })).toEqual({ totalMs: 100, focusMs: 30, trackedMs: 20, nonFocusMs: 50 });
  });

  it("treats legacy tracked-only records as a full tracked pie", () => {
    expect(usageBreakdown({
      date: "2026-08-24",
      totalMs: 40,
      notes: null,
      createdAt: 1,
      updatedAt: 1,
    })).toEqual({ totalMs: 40, focusMs: 0, trackedMs: 40, nonFocusMs: 0 });
  });

  it("clamps malformed overlapping values to the recorded total", () => {
    expect(usageBreakdown({
      date: "2026-08-23",
      totalMs: 80,
      allSitesMs: 50,
      focusMs: 40,
      notes: null,
      createdAt: 1,
      updatedAt: 1,
    })).toEqual({ totalMs: 50, focusMs: 40, trackedMs: 10, nonFocusMs: 0 });
  });
});
