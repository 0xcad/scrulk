import browser from "webextension-polyfill";
import { shouldKeepCameraHub } from "../shared/camera";
import { hostnameOf, isTracked } from "../shared/domain";
import { getDayState, getSettings } from "../shared/storage";

const CAMERA_HUB_URL = browser.runtime.getURL("src/camera/index.html");

function lifecycleUrl(tab: browser.Tabs.Tab | undefined): string | undefined {
  if (tab?.url === CAMERA_HUB_URL || tab?.pendingUrl === CAMERA_HUB_URL) {
    return CAMERA_HUB_URL;
  }
  return tab?.url ?? tab?.pendingUrl;
}

async function findCameraHubTabs(): Promise<browser.Tabs.Tab[]> {
  const tabs = await browser.tabs.query({});
  return tabs.filter((tab) => lifecycleUrl(tab) === CAMERA_HUB_URL);
}

/**
 * Keep camera capture in a top-level moz-extension document. Firefox assigns
 * getUserMedia permission to the top-level document, so an embedded extension
 * frame would incorrectly ask for the host website's camera permission.
 */
export async function ensureCameraHub(
  active: boolean,
  sourceTab?: browser.Tabs.Tab,
): Promise<void> {
  const existing = (await findCameraHubTabs())[0];
  if (existing?.id !== undefined) {
    if (active) {
      if (existing.windowId !== undefined) {
        await browser.windows
          .update(existing.windowId, { focused: true })
          .catch(() => null);
      }
      await browser.tabs.update(existing.id, { active: true }).catch(() => null);
    }
    return;
  }

  await browser.tabs.create({
    url: CAMERA_HUB_URL,
    active,
    ...(sourceTab?.windowId !== undefined
      ? { windowId: sourceTab.windowId }
      : {}),
    ...(sourceTab?.id !== undefined
      ? { openerTabId: sourceTab.id }
      : {}),
  });
}

export async function closeCameraHub(): Promise<void> {
  const ids = (await findCameraHubTabs())
    .map((tab) => tab.id)
    .filter((id): id is number => id !== undefined);
  if (ids.length > 0) {
    await browser.tabs.remove(ids).catch(() => null);
  }
}

export async function ensureCameraHubForOverlay(
  sourceTab: browser.Tabs.Tab | undefined,
): Promise<void> {
  const [settings, state, focusedWindow] = await Promise.all([
    getSettings(),
    getDayState(),
    browser.windows.getLastFocused({ populate: true }).catch(() => null),
  ]);
  const activeTab = focusedWindow?.tabs?.find((tab) => tab.active);
  if (
    !activeTab ||
    activeTab.id !== sourceTab?.id ||
    !settings.cameraOverlayEnabled ||
    !state.breaktimeChallengeCompletedToday
  ) {
    return;
  }
  const host = hostnameOf(lifecycleUrl(activeTab));
  if (host === null || !isTracked(host, settings.trackedSites)) return;

  await ensureCameraHub(
    settings.cameraOverlayPermission !== "granted",
    sourceTab,
  );
}

/**
 * Close a helper that no longer belongs to the selected tab. This function
 * never opens a helper, so manually closing one remains respected until an
 * eligible overlay or explicit retry asks for it again.
 */
export async function syncCameraHubForActiveTab(): Promise<void> {
  const [settings, state, focusedWindow, tabs] = await Promise.all([
    getSettings(),
    getDayState(),
    browser.windows.getLastFocused({ populate: true }).catch(() => null),
    browser.tabs.query({}),
  ]);
  const activeTab = focusedWindow?.tabs?.find((tab) => tab.active);
  const hasTrackedTab = tabs.some((tab) => {
    const host = hostnameOf(tab.url);
    return host !== null && isTracked(host, settings.trackedSites);
  });
  if (
    shouldKeepCameraHub(
      lifecycleUrl(activeTab),
      CAMERA_HUB_URL,
      hasTrackedTab,
      settings,
      state,
    )
  ) {
    return;
  }
  await closeCameraHub();
}
