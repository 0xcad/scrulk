import { describe, expect, it } from "vitest";
import {
  DEFAULT_DAY_STATE,
  DEFAULT_SETTINGS,
  effectiveAllSitesMs,
  isUsageStreakDay,
  liveUsageStreakCount,
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

describe("peek defaults", () => {
  it("opens tracked links in Peek by default", () => {
    expect(DEFAULT_SETTINGS.peekEnabled).toBe(true);
  });
});

describe("camera overlay defaults", () => {
  it("is disabled until the user explicitly enables it", () => {
    expect(DEFAULT_SETTINGS.cameraOverlayEnabled).toBe(false);
    expect(DEFAULT_SETTINGS.cameraOverlayPermission).toBe("unknown");
    expect(DEFAULT_SETTINGS.cameraOverlayPosition).toBeNull();
  });
});

describe("isUsageStreakDay", () => {
  it("does not count today before tracked usage reaches the streak threshold", () => {
    expect(isUsageStreakDay(DEFAULT_DAY_STATE, Date.now())).toBe(false);
  });

  it("counts today once tracked usage reaches the threshold", () => {
    expect(
      isUsageStreakDay(
        { ...DEFAULT_DAY_STATE, totalMs: STREAK_THRESHOLD_MS },
        Date.now(),
      ),
    ).toBe(true);
  });

  it("includes an open tracked segment when checking the threshold", () => {
    expect(
      isUsageStreakDay(
        { ...DEFAULT_DAY_STATE, activeSince: 5_000 },
        5_000 + STREAK_THRESHOLD_MS,
      ),
    ).toBe(true);
  });
});

describe("liveUsageStreakCount", () => {
  it("keeps a completed streak visible before today qualifies", () => {
    expect(liveUsageStreakCount(2, DEFAULT_DAY_STATE, Date.now())).toBe(2);
  });

  it("adds today after tracked usage reaches the threshold", () => {
    expect(
      liveUsageStreakCount(
        2,
        { ...DEFAULT_DAY_STATE, totalMs: STREAK_THRESHOLD_MS },
        Date.now(),
      ),
    ).toBe(3);
  });
});
