import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DAY_STATE } from "../shared/dayState";

const storage = vi.hoisted(() => ({
  getSettings: vi.fn(),
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
vi.mock("../features/access-flow/background/gateway", () => ({
  ensureAccessPage: vi.fn(),
  focusFirstTrackedTab: vi.fn(),
  isAccessPageUrl: vi.fn(() => false),
}));

import { rolloverDay } from "../features/tracking/background/tracker";

describe("post-break allowance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears camera eligibility at the next wake-day boundary", async () => {
    storage.getSettings.mockResolvedValue({ usageStreak: 0 });

    const next = await rolloverDay(
      {
        ...DEFAULT_DAY_STATE,
        breaktimeShownToday: true,
        postBreakAllowanceStartedToday: true,
      },
      1_000_000,
    );

    expect(next.postBreakAllowanceStartedToday).toBe(false);
    expect(next.postBreakAllowancePending).toBe(false);
  });
});
