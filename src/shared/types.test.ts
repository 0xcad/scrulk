import { describe, expect, it } from "vitest";
import {
  DEFAULT_DAY_STATE,
  DEFAULT_SETTINGS,
  effectiveAllSitesMs,
  isLiveStreakDay,
  liveStreakCount,
  STREAK_THRESHOLD_MS,
} from "./types";

describe("effectiveAllSitesMs", () => {
  it("adds an open all-sites segment to the accumulated duration", () => {
    const now = 10_000;
    expect(effectiveAllSitesMs({
      ...DEFAULT_DAY_STATE,
      allSitesMs: 2_000,
      allSitesActiveSince: 7_000,
    }, now)).toBe(5_000);
  });

  it("returns only the accumulated duration while paused", () => {
    expect(effectiveAllSitesMs({
      ...DEFAULT_DAY_STATE,
      allSitesMs: 2_000,
    }, 10_000)).toBe(2_000);
  });
});

describe("all-sites timer defaults", () => {
  it("starts collapsed", () => {
    expect(DEFAULT_SETTINGS.alwaysShowTimerExpanded).toBe(false);
  });
});

describe("isLiveStreakDay", () => {
  it("counts today while usage is below the streak threshold", () => {
    expect(isLiveStreakDay(DEFAULT_DAY_STATE, Date.now())).toBe(true);
  });

  it("does not count today after the gateway breaks the streak", () => {
    expect(
      isLiveStreakDay(
        { ...DEFAULT_DAY_STATE, streakBrokenToday: true },
        Date.now(),
      ),
    ).toBe(false);
  });

  it("does not count today once usage reaches the threshold", () => {
    expect(
      isLiveStreakDay(
        { ...DEFAULT_DAY_STATE, totalMs: STREAK_THRESHOLD_MS },
        Date.now(),
      ),
    ).toBe(false);
  });
});

describe("liveStreakCount", () => {
  it("adds today to the completed streak while today is eligible", () => {
    expect(liveStreakCount(2, DEFAULT_DAY_STATE, Date.now())).toBe(3);
  });

  it("returns no live streak after the gateway breaks today", () => {
    expect(
      liveStreakCount(
        2,
        { ...DEFAULT_DAY_STATE, streakBrokenToday: true },
        Date.now(),
      ),
    ).toBe(0);
  });
});
