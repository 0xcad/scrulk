import { describe, expect, it } from "vitest";
import { DEFAULT_DAY_STATE } from "../../../shared/dayState";
import { dayStateEqual } from "./segments";

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
