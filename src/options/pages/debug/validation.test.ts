import { describe, expect, it } from "vitest";
import {
  ACCESS_FLOW_PHASES,
  parseExtensionTabs,
  parseInteger,
  parseNullableString,
} from "./validation";

describe("DayState debug validation", () => {
  it("parses finite integers and rejects fractional or missing required values", () => {
    expect(parseInteger("123", false)).toEqual({ ok: true, value: 123 });
    expect(parseInteger("-5", false)).toEqual({ ok: true, value: -5 });
    expect(parseInteger("1.5", false).ok).toBe(false);
    expect(parseInteger("", false).ok).toBe(false);
  });

  it("uses blank nullable inputs as null", () => {
    expect(parseInteger("  ", true)).toEqual({ ok: true, value: null });
    expect(parseNullableString("")).toBeNull();
    expect(parseNullableString("2026-08-14")).toBe("2026-08-14");
  });

  it("accepts only JSON objects with string values for extension tabs", () => {
    expect(parseExtensionTabs('{"42":"https://example.com"}')).toEqual({
      ok: true,
      value: { "42": "https://example.com" },
    });
    expect(parseExtensionTabs("[]").ok).toBe(false);
    expect(parseExtensionTabs('{"42":123}').ok).toBe(false);
    expect(parseExtensionTabs("not json").ok).toBe(false);
  });

  it("lists every access flow phase", () => {
    expect(ACCESS_FLOW_PHASES).toEqual([
      "waitingConfirmation",
      "waiting",
      "waitingReady",
      "picking",
      "browsing",
      "resumePrompt",
      "break",
      "challenge",
      "popupLocked",
    ]);
  });
});
