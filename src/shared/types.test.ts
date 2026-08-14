import { describe, expect, it } from "vitest";
import {
  DEFAULT_DAY_STATE,
  DEFAULT_SETTINGS,
  effectiveAllSitesMs,
  effectiveWaitingMs,
  isUsageStreakDay,
  liveUsageStreakCount,
  STREAK_THRESHOLD_MS,
  remainingAllowanceMs,
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

describe("global access flow", () => {
  it("defaults to a five-minute initial wait", () => {
    expect(DEFAULT_SETTINGS.waitingMinutes).toBe(5);
    expect(DEFAULT_DAY_STATE.accessFlowPhase).toBe("waiting");
  });

  it("accumulates only the open waiting segment", () => {
    expect(effectiveWaitingMs({
      ...DEFAULT_DAY_STATE,
      waitingMs: 2_000,
      waitingActiveSince: 7_000,
    }, 10_000)).toBe(5_000);
  });

  it("computes allowance remaining from global tracked usage", () => {
    expect(remainingAllowanceMs({
      ...DEFAULT_DAY_STATE,
      totalMs: 75_000,
      allowanceMs: 120_000,
      allowanceStartTotalMs: 30_000,
    }, 100_000)).toBe(75_000);
  });

  it("includes an open tracked segment and clamps exhausted allowances", () => {
    expect(remainingAllowanceMs({
      ...DEFAULT_DAY_STATE,
      totalMs: 100_000,
      activeSince: 10_000,
      allowanceMs: 60_000,
      allowanceStartTotalMs: 0,
    }, 20_000)).toBe(0);
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
    expect(DEFAULT_SETTINGS.cameraOverlaySize).toBeNull();
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
