import { describe, expect, it } from "vitest";
import {
  isDocumentNavigationLink,
  makePeekUrl,
  parsePeekUrl,
} from "./peek";

describe("Peek URL marker", () => {
  it("temporarily carries a token without losing the destination hash", () => {
    const original = "https://example.com/story?mode=full#comments";
    const marked = makePeekUrl(original, "token-123");
    expect(marked).not.toBe(original);
    expect(parsePeekUrl(marked)).toEqual({
      token: "token-123",
      cleanUrl: original,
    });
  });

  it("ignores ordinary and malformed fragments", () => {
    expect(parsePeekUrl("https://example.com/#comments")).toBeNull();
    expect(parsePeekUrl("https://example.com/#__scrulk_peek__=bad")).toBeNull();
  });
});

describe("isDocumentNavigationLink", () => {
  const current = "https://example.com/story?mode=full#intro";

  it("allows JavaScript-powered controls", () => {
    expect(isDocumentNavigationLink(" JAVASCRIPT:void(0)", current)).toBe(false);
  });

  it("allows relative and absolute same-document hash links", () => {
    expect(isDocumentNavigationLink("#comments", current)).toBe(false);
    expect(isDocumentNavigationLink("#intro", current)).toBe(false);
    expect(
      isDocumentNavigationLink(
        "https://example.com/story?mode=full#comments",
        current,
      ),
    ).toBe(false);
  });

  it("blocks same-site and cross-site document navigation", () => {
    expect(isDocumentNavigationLink("/next", current)).toBe(true);
    expect(isDocumentNavigationLink("https://other.test/", current)).toBe(true);
  });

  it("does not treat an invalid href as an activatable navigation", () => {
    expect(isDocumentNavigationLink("http://[", current)).toBe(false);
  });
});
