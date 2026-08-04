import { describe, expect, it } from "vitest";
import { isDocumentNavigationHref } from "./ExtensionLinkLock";

const CURRENT = "https://example.com/article?view=full#intro";

describe("isDocumentNavigationHref", () => {
  it("blocks links that navigate to another document", () => {
    expect(isDocumentNavigationHref("/other", CURRENT, CURRENT)).toBe(true);
    expect(
      isDocumentNavigationHref("https://other.test/", CURRENT, CURRENT),
    ).toBe(true);
  });

  it("allows JavaScript-backed controls", () => {
    expect(
      isDocumentNavigationHref(" javascript:void(0) ", CURRENT, CURRENT),
    ).toBe(false);
  });

  it("allows same-document hash links", () => {
    expect(isDocumentNavigationHref("#comments", CURRENT, CURRENT)).toBe(false);
    expect(
      isDocumentNavigationHref(
        "/article?view=full#comments",
        CURRENT,
        CURRENT,
      ),
    ).toBe(false);
  });

  it("blocks a hash link whose path or query changes", () => {
    expect(isDocumentNavigationHref("/other#intro", CURRENT, CURRENT)).toBe(true);
    expect(
      isDocumentNavigationHref("/article?view=compact#intro", CURRENT, CURRENT),
    ).toBe(true);
  });

  it("blocks a reload-style link without a hash", () => {
    expect(
      isDocumentNavigationHref("/article?view=full", CURRENT, CURRENT),
    ).toBe(true);
  });
});
