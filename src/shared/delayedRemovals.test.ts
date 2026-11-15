import { describe, expect, it } from "vitest";
import {
  formatRemovalCountdown,
  pendingRemovalDeadline,
  removalDeadline,
  SETTINGS_REMOVAL_DELAY_MS,
} from "./delayedRemovals";

describe("delayed removals", () => {
  it("schedules removal exactly 12 hours later", () => {
    expect(removalDeadline(500)).toBe(500 + SETTINGS_REMOVAL_DELAY_MS);
  });

  it("shows rounded-up hours, then rounded-up minutes", () => {
    expect(formatRemovalCountdown(12 * 60 * 60 * 1000, 0)).toBe("12 hours");
    expect(formatRemovalCountdown(60 * 60 * 1000, 0)).toBe("1 hour");
    expect(formatRemovalCountdown(59 * 60 * 1000 + 1, 0)).toBe("60 minutes");
    expect(formatRemovalCountdown(30_001, 0)).toBe("1 minute");
  });

  it("does not treat inherited property names as pending entries", () => {
    expect(pendingRemovalDeadline({}, "toString")).toBeUndefined();
    expect(pendingRemovalDeadline({ toString: 1000 }, "toString")).toBe(1000);
  });
});
