import { hostnameOf, isTracked } from "../../shared/domain";
import type { DayState } from "../../shared/dayState";
import type { Settings } from "../../shared/settings";
import type { CameraOverlaySize } from "../../shared/uiTypes";

export const CAMERA_ASPECT_RATIO = 4 / 3;
export const CAMERA_MIN_SIZE: CameraOverlaySize = {
  width: 160,
  height: 120,
};

type CameraOverlaySettings = Pick<Settings, "cameraOverlayEnabled">;

type CameraHubSettings = Pick<
  Settings,
  "cameraOverlayEnabled" | "cameraOverlayPermission" | "trackedSites"
>;

type CameraDayState = Pick<DayState, "breaktimeChallengeCompletedToday">;

export function cameraSizeForWidth(
  requestedWidth: number,
  maxWidth = Number.POSITIVE_INFINITY,
): CameraOverlaySize {
  const finiteWidth = Number.isFinite(requestedWidth)
    ? requestedWidth
    : CAMERA_MIN_SIZE.width;
  const finiteMax = Number.isFinite(maxWidth)
    ? Math.max(CAMERA_MIN_SIZE.width, maxWidth)
    : Number.POSITIVE_INFINITY;
  const width = Math.round(
    Math.max(CAMERA_MIN_SIZE.width, Math.min(finiteWidth, finiteMax)),
  );
  return { width, height: width / CAMERA_ASPECT_RATIO };
}

export function shouldShowCameraOverlay(
  matchedDomain: string | null,
  settings: CameraOverlaySettings,
  state: CameraDayState,
): boolean {
  return (
    matchedDomain !== null &&
    settings.cameraOverlayEnabled &&
    state.breaktimeChallengeCompletedToday
  );
}

/**
 * Whether an existing camera helper tab is still valid for the selected tab.
 * This is deliberately close-only: opening is initiated by an eligible
 * content overlay or an explicit permission/retry command.
 */
export function shouldKeepCameraHub(
  activeTabUrl: string | undefined,
  cameraHubUrl: string,
  hasTrackedTab: boolean,
  settings: CameraHubSettings,
  state: CameraDayState,
): boolean {
  if (!settings.cameraOverlayEnabled) return false;
  if (activeTabUrl === cameraHubUrl) {
    if (settings.cameraOverlayPermission !== "granted") return true;
    return state.breaktimeChallengeCompletedToday && hasTrackedTab;
  }
  if (!state.breaktimeChallengeCompletedToday) return false;

  const host = hostnameOf(activeTabUrl);
  return host !== null && isTracked(host, settings.trackedSites);
}
