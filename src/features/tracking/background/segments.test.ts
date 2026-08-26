import { describe, expect, it } from "vitest";
import { DEFAULT_DAY_STATE } from "../../../shared/dayState";
import { applyFocusTransition, dayStateEqual } from "./segments";

describe("dayStateEqual", () => {
  it("compares every scalar DayState field", () => {
    expect(dayStateEqual(
      DEFAULT_DAY_STATE,
      { ...DEFAULT_DAY_STATE, surveyContinueAllowed: true },
    )).toBe(false);
  });

  it("compares extension tab snapshots by value", () => {
    const left = {
      ...DEFAULT_DAY_STATE,
      breaktimeExtensionTabs: { "12": "https://example.com/one" },
    };
    const sameValue = {
      ...DEFAULT_DAY_STATE,
      breaktimeExtensionTabs: { "12": "https://example.com/one" },
    };
    const differentValue = {
      ...DEFAULT_DAY_STATE,
      breaktimeExtensionTabs: { "12": "https://example.com/two" },
    };

    expect(dayStateEqual(left, sameValue)).toBe(true);
    expect(dayStateEqual(left, differentValue)).toBe(false);
  });
});

describe("applyFocusTransition", () => {
  it("opens and closes an event-driven focus segment", () => {
    const opened = applyFocusTransition(DEFAULT_DAY_STATE, true, 1_000);
    expect(opened.focusActiveSince).toBe(1_000);

    const closed = applyFocusTransition(opened, false, 4_500);
    expect(closed.focusMs).toBe(3_500);
    expect(closed.focusActiveSince).toBeNull();
  });
});
