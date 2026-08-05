import { describe, expect, it } from "vitest";
import {
  CAMERA_MIN_SIZE,
  cameraSizeForWidth,
  resizedCameraSize,
  shouldKeepCameraHub,
  shouldShowCameraOverlay,
} from "./camera";

const HUB_URL = "moz-extension://scrulk/src/camera/index.html";
const enabled = {
  cameraOverlayEnabled: true,
  cameraOverlayPermission: "granted" as const,
  trackedSites: ["tracked.example"],
};
const afterBreaktime = { breaktimeShownToday: true };

describe("camera overlay sizing", () => {
  it("preserves 4:3 and enforces the current size as its minimum", () => {
    expect(cameraSizeForWidth(80)).toEqual(CAMERA_MIN_SIZE);
    expect(cameraSizeForWidth(320)).toEqual({ width: 320, height: 240 });
  });

  it("uses the dominant resize axis and respects the viewport maximum", () => {
    expect(resizedCameraSize(160, 20, 100, 400)).toEqual({
      width: 293,
      height: 219.75,
    });
    expect(resizedCameraSize(300, 500, 0, 360)).toEqual({
      width: 360,
      height: 270,
    });
  });
});

describe("shouldShowCameraOverlay", () => {
  it("shows only on tracked pages after today's first breaktime", () => {
    expect(
      shouldShowCameraOverlay("tracked.example", enabled, afterBreaktime),
    ).toBe(true);
    expect(shouldShowCameraOverlay(null, enabled, afterBreaktime)).toBe(false);
    expect(
      shouldShowCameraOverlay("tracked.example", enabled, {
        breaktimeShownToday: false,
      }),
    ).toBe(false);
    expect(
      shouldShowCameraOverlay(
        "tracked.example",
        { ...enabled, cameraOverlayEnabled: false },
        afterBreaktime,
      ),
    ).toBe(false);
  });
});

describe("shouldKeepCameraHub", () => {
  it("keeps the helper for an active tracked page after breaktime", () => {
    expect(
      shouldKeepCameraHub(
        "https://sub.tracked.example/feed",
        HUB_URL,
        true,
        enabled,
        afterBreaktime,
      ),
    ).toBe(true);
  });

  it("keeps the helper while the helper itself is active", () => {
    expect(
      shouldKeepCameraHub(
        HUB_URL,
        HUB_URL,
        true,
        enabled,
        afterBreaktime,
      ),
    ).toBe(true);
  });

  it("keeps the active helper during permission setup or retry", () => {
    expect(
      shouldKeepCameraHub(
        HUB_URL,
        HUB_URL,
        false,
        { ...enabled, cameraOverlayPermission: "denied" },
        { breaktimeShownToday: false },
      ),
    ).toBe(true);
  });

  it("closes a granted helper after the final tracked tab closes", () => {
    expect(
      shouldKeepCameraHub(
        HUB_URL,
        HUB_URL,
        false,
        enabled,
        afterBreaktime,
      ),
    ).toBe(false);
  });

  it("closes before breaktime or when an untracked tab is active", () => {
    expect(
      shouldKeepCameraHub(
        "https://tracked.example/",
        HUB_URL,
        true,
        enabled,
        { breaktimeShownToday: false },
      ),
    ).toBe(false);
    expect(
      shouldKeepCameraHub(
        "https://untracked.example/",
        HUB_URL,
        true,
        enabled,
        afterBreaktime,
      ),
    ).toBe(false);
  });

  it("closes whenever the setting is disabled", () => {
    expect(
      shouldKeepCameraHub(
        HUB_URL,
        HUB_URL,
        true,
        { ...enabled, cameraOverlayEnabled: false },
        afterBreaktime,
      ),
    ).toBe(false);
  });
});
