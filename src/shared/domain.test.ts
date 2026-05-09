import { describe, expect, it } from "vitest";
import {
  findMatchingDomain,
  hostnameOf,
  isTracked,
  normalizeDomain,
} from "./domain";

describe("normalizeDomain", () => {
  it("lowercases and strips www", () => {
    expect(normalizeDomain("WWW.Example.COM")).toBe("example.com");
  });

  it("accepts a URL", () => {
    expect(normalizeDomain("https://blog.example.co.uk/path?x=1")).toBe(
      "blog.example.co.uk",
    );
  });

  it("strips path when no scheme", () => {
    expect(normalizeDomain("example.com/foo")).toBe("example.com");
  });

  it("rejects strings without a dot", () => {
    expect(normalizeDomain("localhost")).toBeNull();
  });

  it("rejects empty input", () => {
    expect(normalizeDomain("   ")).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(normalizeDomain("..example..com")).toBeNull();
    expect(normalizeDomain("exa mple.com")).toBeNull();
  });
});

describe("isTracked", () => {
  const list = ["example.com", "example.co.uk"];

  it("matches exact host", () => {
    expect(isTracked("example.com", list)).toBe(true);
  });

  it("matches subdomain", () => {
    expect(isTracked("blog.example.com", list)).toBe(true);
    expect(isTracked("a.b.example.co.uk", list)).toBe(true);
  });

  it("strips leading www on the hostname being checked", () => {
    expect(isTracked("www.example.com", list)).toBe(true);
  });

  it("does not match unrelated suffix collisions", () => {
    expect(isTracked("notexample.com", list)).toBe(false);
    expect(isTracked("example.com.attacker.test", list)).toBe(false);
  });

  it("returns false for empty list", () => {
    expect(isTracked("example.com", [])).toBe(false);
  });
});

describe("findMatchingDomain", () => {
  const list = ["example.com", "example.co.uk"];

  it("returns the matched parent for a subdomain", () => {
    expect(findMatchingDomain("blog.example.com", list)).toBe("example.com");
    expect(findMatchingDomain("a.b.example.co.uk", list)).toBe("example.co.uk");
  });

  it("returns the host itself on exact match", () => {
    expect(findMatchingDomain("example.com", list)).toBe("example.com");
  });

  it("returns null when nothing matches", () => {
    expect(findMatchingDomain("notexample.com", list)).toBeNull();
  });
});

describe("hostnameOf", () => {
  it("returns lowercase host for http(s)", () => {
    expect(hostnameOf("https://Example.COM/x")).toBe("example.com");
  });

  it("returns null for non-http schemes", () => {
    expect(hostnameOf("about:blank")).toBeNull();
    expect(hostnameOf("file:///tmp/x")).toBeNull();
  });

  it("returns null for invalid URL", () => {
    expect(hostnameOf("not a url")).toBeNull();
    expect(hostnameOf(undefined)).toBeNull();
  });
});
