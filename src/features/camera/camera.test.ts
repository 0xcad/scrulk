import { describe, expect, it } from "vitest";
import {
  CAMERA_MIN_SIZE,
  cameraSizeForWidth,
  shouldKeepCameraHub,
  shouldShowCameraOverlay,
} from "./camera";

const HUB_URL = "moz-extension://scrulk/src/camera/index.html";
const enabled = {
  cameraOverlayEnabled: true,
  cameraOverlayPermission: "granted" as const,
  trackedSites: ["tracked.example"],
};
const afterChallenge = { breaktimeChallengeCompletedToday: true };
const beforeChallenge = { breaktimeChallengeCompletedToday: false };

describe("camera overlay sizing", () => {
  it("preserves 4:3 and enforces the current size as its minimum", () => {
    expect(cameraSizeForWidth(80)).toEqual(CAMERA_MIN_SIZE);
    expect(cameraSizeForWidth(320)).toEqual({ width: 320, height: 240 });
  });
});

describe("shouldShowCameraOverlay", () => {
  it("shows only on tracked pages after today's first completed challenge", () => {
    expect(
      shouldShowCameraOverlay("tracked.example", enabled, afterChallenge),
    ).toBe(true);
    expect(shouldShowCameraOverlay(null, enabled, afterChallenge)).toBe(false);
    expect(
      shouldShowCameraOverlay("tracked.example", enabled, beforeChallenge),
    ).toBe(false);
    expect(
      shouldShowCameraOverlay(
        "tracked.example",
        { ...enabled, cameraOverlayEnabled: false },
        afterChallenge,
      ),
    ).toBe(false);
  });
});

describe("shouldKeepCameraHub", () => {
  it("keeps the helper for an active tracked page after challenge completion", () => {
    expect(
      shouldKeepCameraHub(
        "https://sub.tracked.example/feed",
        HUB_URL,
        true,
        enabled,
        afterChallenge,
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
        afterChallenge,
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
        beforeChallenge,
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
        afterChallenge,
      ),
    ).toBe(false);
  });

  it("closes before challenge completion or when an untracked tab is active", () => {
    expect(
      shouldKeepCameraHub(
        "https://tracked.example/",
        HUB_URL,
        true,
        enabled,
        beforeChallenge,
      ),
    ).toBe(false);
    expect(
      shouldKeepCameraHub(
        "https://untracked.example/",
        HUB_URL,
        true,
        enabled,
        afterChallenge,
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
        afterChallenge,
      ),
    ).toBe(false);
  });
});
