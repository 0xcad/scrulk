import { describe, expect, it } from "vitest";
import { headingLevelForPrefix, waitingHeadingFontSize } from "./textShortcuts";

describe("waiting text shortcuts", () => {
  it("recognizes only the three supported heading prefixes", () => {
    expect(headingLevelForPrefix("#")).toBe(1);
    expect(headingLevelForPrefix("##")).toBe(2);
    expect(headingLevelForPrefix("###")).toBe(3);
    expect(headingLevelForPrefix("####")).toBeNull();
    expect(headingLevelForPrefix("heading")).toBeNull();
  });

  it("scales heading text relative to its shape font size", () => {
    expect(waitingHeadingFontSize(16, 1)).toBe(32);
    expect(waitingHeadingFontSize(16, 2)).toBe(24);
    expect(waitingHeadingFontSize(16, 3)).toBe(20);
    expect(waitingHeadingFontSize(20, 1)).toBe(40);
  });
});
