import { describe, expect, it } from "vitest";
import {
  DEFAULT_DAY_STATE,
  isLiveStreakDay,
  liveStreakCount,
  STREAK_THRESHOLD_MS,
} from "./types";

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
