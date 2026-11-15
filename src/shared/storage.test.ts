import { describe, expect, it } from "vitest";
import { normalizeDayState, normalizeSettings } from "./storageNormalization";

describe("storage normalization", () => {
  it("fills defaults and applies the legacy wake-up-hour migration", () => {
    expect(normalizeSettings({ wakeUpHour: 6 }).wakeUpTime).toBe("06:00");
    expect(normalizeSettings({ wakeUpHour: 6, wakeUpTime: "06:30" }).wakeUpTime)
      .toBe("06:30");
    expect(normalizeSettings(undefined).trackedSites).toEqual([]);
    expect(normalizeSettings(undefined).ignoredSites).toEqual([]);
    expect(normalizeSettings(undefined).initialWaitingSeconds).toBe(300);
    expect(normalizeSettings(undefined).repeatWaitingSeconds).toBe(60);
    expect(normalizeSettings(undefined).peekBlocklistPatterns).toEqual([]);
    expect(normalizeSettings(undefined).pendingTrackedSiteRemovals).toEqual({});
  });

  it("normalizes Peek filters and delayed-removal records", () => {
    const settings = normalizeSettings({
      trackedSites: ["example.com"],
      peekBlocklistPatterns: ["example\\.com/private", "[", "example\\.com/private"],
      pendingTrackedSiteRemovals: {
        "example.com": 1000,
        "missing.example": 2000,
      },
      pendingPeekBlocklistRemovals: {
        "example\\.com/private": 3000,
        "missing": 4000,
      },
    });
    expect(settings.peekBlocklistPatterns).toEqual(["example\\.com/private"]);
    expect(settings.pendingTrackedSiteRemovals).toEqual({ "example.com": 1000 });
    expect(settings.pendingPeekBlocklistRemovals).toEqual({
      "example\\.com/private": 3000,
    });
  });

  it("gives ignored domains precedence over overlapping tracked domains", () => {
    const settings = normalizeSettings({
      trackedSites: ["example.com", "other.com"],
      ignoredSites: ["blog.example.com"],
    });
    expect(settings.trackedSites).toEqual(["other.com"]);
  });

  it("fills newly added DayState fields without changing stored values", () => {
    const state = normalizeDayState({ totalMs: 123 });
    expect(state.totalMs).toBe(123);
    expect(state.accessFlowPhase).toBe("waitingConfirmation");
    expect(state.breaktimeExtensionTabs).toEqual({});
    expect(state.waitingTimerElapsed).toBe(false);
    expect(state.focusMs).toBe(0);
    expect(state.focusActiveSince).toBeNull();
    expect(normalizeDayState({ accessFlowPhase: "waiting" }).accessFlowPhase)
      .toBe("waiting");
  });
});
