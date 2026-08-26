import { describe, expect, it } from "vitest";
import { normalizeDayState, normalizeSettings } from "./storageNormalization";

describe("storage normalization", () => {
  it("fills defaults and applies the legacy wake-up-hour migration", () => {
    expect(normalizeSettings({ wakeUpHour: 6 }).wakeUpTime).toBe("06:00");
    expect(normalizeSettings({ wakeUpHour: 6, wakeUpTime: "06:30" }).wakeUpTime)
      .toBe("06:30");
    expect(normalizeSettings(undefined).trackedSites).toEqual([]);
    expect(normalizeSettings(undefined).ignoredSites).toEqual([]);
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
