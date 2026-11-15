import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../shared/settings";

vi.mock("webextension-polyfill", () => ({
  default: { alarms: {} },
}));

import { reconcileRemovalState } from "./delayedSettingsRemovals";

describe("delayed settings removal reconciliation", () => {
  it("keeps entries active before their deadlines", () => {
    const result = reconcileRemovalState({
      ...DEFAULT_SETTINGS,
      trackedSites: ["example.com"],
      peekBlocklistPatterns: ["private"],
      pendingTrackedSiteRemovals: { "example.com": 2000 },
      pendingPeekBlocklistRemovals: { private: 3000 },
    }, 1000);

    expect(result.changed).toBe(false);
    expect(result.patch.trackedSites).toEqual(["example.com"]);
    expect(result.patch.peekBlocklistPatterns).toEqual(["private"]);
    expect(result.nextDeadline).toBe(2000);
  });

  it("removes entries at their deadlines and retains later work", () => {
    const result = reconcileRemovalState({
      ...DEFAULT_SETTINGS,
      trackedSites: ["due.example", "later.example"],
      peekBlocklistPatterns: ["due", "later"],
      pendingTrackedSiteRemovals: {
        "due.example": 1000,
        "later.example": 3000,
      },
      pendingPeekBlocklistRemovals: { due: 999, later: 4000 },
    }, 1000);

    expect(result.changed).toBe(true);
    expect(result.patch.trackedSites).toEqual(["later.example"]);
    expect(result.patch.peekBlocklistPatterns).toEqual(["later"]);
    expect(result.patch.pendingTrackedSiteRemovals).toEqual({
      "later.example": 3000,
    });
    expect(result.patch.pendingPeekBlocklistRemovals).toEqual({ later: 4000 });
    expect(result.nextDeadline).toBe(3000);
  });

  it("cleans pending records whose entries no longer exist", () => {
    const result = reconcileRemovalState({
      ...DEFAULT_SETTINGS,
      pendingTrackedSiteRemovals: { "missing.example": 3000 },
      pendingPeekBlocklistRemovals: { missing: 4000 },
    }, 1000);

    expect(result.changed).toBe(true);
    expect(result.patch.pendingTrackedSiteRemovals).toEqual({});
    expect(result.patch.pendingPeekBlocklistRemovals).toEqual({});
    expect(result.nextDeadline).toBeNull();
  });
});
