import { hostnameOf, isTracked } from "./domain";
import type { DayState, Settings } from "./types";

type CameraOverlaySettings = Pick<Settings, "cameraOverlayEnabled">;

type CameraHubSettings = Pick<
  Settings,
  "cameraOverlayEnabled" | "cameraOverlayPermission" | "trackedSites"
>;

type CameraDayState = Pick<DayState, "breaktimeShownToday">;

export function shouldShowCameraOverlay(
  matchedDomain: string | null,
  settings: CameraOverlaySettings,
  state: CameraDayState,
): boolean {
  return (
    matchedDomain !== null &&
    settings.cameraOverlayEnabled &&
    state.breaktimeShownToday
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
    return state.breaktimeShownToday && hasTrackedTab;
  }
  if (!state.breaktimeShownToday) return false;

  const host = hostnameOf(activeTabUrl);
  return host !== null && isTracked(host, settings.trackedSites);
}
