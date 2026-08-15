import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DAY_STATE } from "../shared/types";

const storage = vi.hoisted(() => ({
  getDayState: vi.fn(),
  getSettings: vi.fn(),
  setDayState: vi.fn(),
  setSettings: vi.fn(),
}));

vi.mock("webextension-polyfill", () => ({
  default: {
    alarms: {},
    idle: {},
    runtime: { getURL: vi.fn((path: string) => `moz-extension://scrulk/${path}`) },
    tabs: {},
    windows: {},
  },
}));

vi.mock("../shared/storage", () => storage);
vi.mock("./gateway", () => ({
  ensureAccessPage: vi.fn(),
  focusFirstTrackedTab: vi.fn(),
  isAccessPageUrl: vi.fn(() => false),
}));

import { handleChallengeComplete } from "./breaktime";
import { rolloverDay } from "./tracker";

describe("breaktime challenge completion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists the daily completion flag when the challenge completes", async () => {
    const state = {
      ...DEFAULT_DAY_STATE,
      accessFlowPhase: "challenge" as const,
      allowanceMs: 120_000,
      allowanceStartTotalMs: 10_000,
      breakOpenedAt: 20_000,
      breaktimeShownToday: true,
    };
    storage.getDayState.mockResolvedValue(state);

    await handleChallengeComplete();

    expect(storage.setDayState).toHaveBeenCalledWith({
      ...state,
      accessFlowPhase: "picking",
      breaktimeChallengeCompletedToday: true,
      allowanceMs: null,
      allowanceStartTotalMs: null,
      breakOpenedAt: null,
    });
  });

  it("does not unlock the preview from any non-challenge phase", async () => {
    storage.getDayState.mockResolvedValue({
      ...DEFAULT_DAY_STATE,
      accessFlowPhase: "break",
      breaktimeShownToday: true,
    });

    await handleChallengeComplete();

    expect(storage.setDayState).not.toHaveBeenCalled();
  });

  it("clears the completion flag at the next wake-day boundary", async () => {
    storage.getSettings.mockResolvedValue({ usageStreak: 0 });

    const next = await rolloverDay(
      {
        ...DEFAULT_DAY_STATE,
        breaktimeShownToday: true,
        breaktimeChallengeCompletedToday: true,
      },
      1_000_000,
    );

    expect(next.breaktimeChallengeCompletedToday).toBe(false);
  });
});
