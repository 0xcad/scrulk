import { describe, expect, it } from "vitest";
import { monthNavigationBounds, shiftMonth } from "./calendarNavigation";

describe("shiftMonth", () => {
  it("moves across year boundaries", () => {
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({
      year: 2025,
      month: 11,
    });
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({
      year: 2027,
      month: 0,
    });
  });
});

describe("monthNavigationBounds", () => {
  const installedAt = new Date(2026, 7, 15).getTime();
  const now = new Date(2026, 10, 14).getTime();

  it("stops at the installation month", () => {
    expect(monthNavigationBounds(
      { year: 2026, month: 7 },
      installedAt,
      now,
    ).atInstallMonth).toBe(true);
  });

  it("stops at the current month", () => {
    expect(monthNavigationBounds(
      { year: 2026, month: 10 },
      installedAt,
      now,
    ).atCurrentMonth).toBe(true);
  });

  it("allows both directions between the bounds", () => {
    expect(monthNavigationBounds(
      { year: 2026, month: 9 },
      installedAt,
      now,
    )).toEqual({ atInstallMonth: false, atCurrentMonth: false });
  });
});
