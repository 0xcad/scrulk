import { describe, expect, it } from "vitest";
import { peekUrlForHref } from "./PeekOverlay";

const BASE = "https://search.example/results";
const TRACKED = ["social.example", "video.example"];

describe("peekUrlForHref", () => {
  it("accepts tracked HTTP(S) destinations", () => {
    expect(
      peekUrlForHref("https://social.example/post/1", BASE, TRACKED),
    ).toBe("https://social.example/post/1");
  });

  it("uses the shared subdomain matching rule", () => {
    expect(
      peekUrlForHref("https://news.social.example/post/1", BASE, TRACKED),
    ).toBe("https://news.social.example/post/1");
  });

  it("rejects untracked and non-web destinations", () => {
    expect(peekUrlForHref("https://other.example/", BASE, TRACKED)).toBeNull();
    expect(peekUrlForHref("mailto:hello@example.com", BASE, TRACKED)).toBeNull();
  });
});
