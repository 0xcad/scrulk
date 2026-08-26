import { describe, expect, it } from "vitest";
import { normalizeFocusSessions } from "./focusSessions";

describe("normalizeFocusSessions", () => {
  it("rejects malformed storage", () => {
    expect(normalizeFocusSessions(undefined)).toEqual({ sessions: [] });
    expect(normalizeFocusSessions({ sessions: "nope" })).toEqual({ sessions: [] });
  });

  it("fills newer session and tab fields", () => {
    const state = normalizeFocusSessions({
      sessions: [{
        id: "focus-1",
        name: null,
        status: "inactive",
        runtimeWindowId: null,
        tabs: [{ id: "tab-1", url: "https://example.com", index: 0 }],
        stashedTabs: [],
        createdAt: 1,
        updatedAt: 2,
      }],
    });
    expect(state.sessions[0]?.browserSessionId).toBeNull();
    expect(state.sessions[0]?.tabs[0]).toMatchObject({
      id: "tab-1",
      runtimeTabId: null,
      url: "https://example.com",
      pinned: false,
      lastAllowedUrl: null,
    });
  });
});
