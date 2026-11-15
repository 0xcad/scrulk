import { describe, expect, it } from "vitest";
import { isPeekBlocklisted, isValidPeekBlocklistPattern } from "./model";

describe("Peek blocklist patterns", () => {
  it("validates JavaScript regular expressions", () => {
    expect(isValidPeekBlocklistPattern(String.raw`example\.com/private`)).toBe(true);
    expect(isValidPeekBlocklistPattern("[")).toBe(false);
  });

  it("matches the complete URL case-sensitively", () => {
    const pattern = String.raw`example\.com/private\?from=home#section`;
    expect(isPeekBlocklisted("https://example.com/private?from=home#section", [pattern]))
      .toBe(true);
    expect(isPeekBlocklisted("https://example.com/Private?from=home#section", [pattern]))
      .toBe(false);
  });

  it("ignores malformed externally stored expressions", () => {
    expect(isPeekBlocklisted("https://example.com/", ["["])).toBe(false);
  });
});
