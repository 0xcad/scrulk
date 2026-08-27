import { describe, expect, it } from "vitest";
import type { FocusSession } from "../../shared/focusSessions";
import { shouldDeleteFocusSessionForTabRemoval } from "./model";

function session(tabIds: number[], closingAction: FocusSession["closingAction"] = null): FocusSession {
  return {
    id: "focus-1",
    name: null,
    status: "active",
    runtimeWindowId: 4,
    browserSessionId: null,
    tabs: tabIds.map((runtimeTabId, index) => ({
      id: `tab-${runtimeTabId}`,
      runtimeTabId,
      url: "https://example.com",
      title: "Example",
      index,
      active: index === 0,
      pinned: false,
      lastAllowedUrl: "https://example.com",
    })),
    stashedTabs: [],
    createdAt: 1,
    updatedAt: 1,
    closingAction,
  };
}

describe("shouldDeleteFocusSessionForTabRemoval", () => {
  it("deletes the focus session when its last tab closes with the window", () => {
    expect(shouldDeleteFocusSessionForTabRemoval(
      session([9]),
      9,
      { isWindowClosing: true },
    )).toBe(true);
  });

  it("preserves multi-tab window closures and explicit lifecycle actions", () => {
    expect(shouldDeleteFocusSessionForTabRemoval(
      session([9, 10]),
      9,
      { isWindowClosing: true },
    )).toBe(false);
    expect(shouldDeleteFocusSessionForTabRemoval(
      session([9], "ending"),
      9,
      { isWindowClosing: true },
    )).toBe(false);
  });

  it("does not delete the session for an ordinary non-window-closing tab removal", () => {
    expect(shouldDeleteFocusSessionForTabRemoval(
      session([9]),
      9,
      { isWindowClosing: false },
    )).toBe(false);
  });
});
