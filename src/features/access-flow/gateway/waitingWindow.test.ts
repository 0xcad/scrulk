import { describe, expect, it } from "vitest";
import {
  isWaitingPageEligible,
  isWaitingWindowLargeEnough,
  type WaitingWindowMetrics,
} from "./waitingWindow";

const AVAILABLE_SCREEN: WaitingWindowMetrics = {
  outerWidth: 950,
  outerHeight: 800,
  availWidth: 1000,
  availHeight: 1000,
};

describe("isWaitingWindowLargeEnough", () => {
  it("accepts a window exactly at both thresholds", () => {
    expect(isWaitingWindowLargeEnough(AVAILABLE_SCREEN)).toBe(true);
  });

  it("rejects a window below the width threshold", () => {
    expect(isWaitingWindowLargeEnough({
      ...AVAILABLE_SCREEN,
      outerWidth: 949,
    })).toBe(false);
  });

  it("rejects a window below the height threshold", () => {
    expect(isWaitingWindowLargeEnough({
      ...AVAILABLE_SCREEN,
      outerHeight: 799,
    })).toBe(false);
  });

  it("rejects unavailable screen dimensions", () => {
    expect(isWaitingWindowLargeEnough({
      ...AVAILABLE_SCREEN,
      availWidth: 0,
    })).toBe(false);
  });
});

describe("isWaitingPageEligible", () => {
  it("requires both focus and a large enough window", () => {
    expect(isWaitingPageEligible(true, true)).toBe(true);
    expect(isWaitingPageEligible(false, true)).toBe(false);
    expect(isWaitingPageEligible(true, false)).toBe(false);
  });
});
