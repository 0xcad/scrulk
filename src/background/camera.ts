import browser from "webextension-polyfill";

const CAMERA_HUB_URL = browser.runtime.getURL("src/camera/index.html");

async function findCameraHubTabs(): Promise<browser.Tabs.Tab[]> {
  const tabs = await browser.tabs.query({});
  return tabs.filter((tab) => tab.url === CAMERA_HUB_URL);
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
