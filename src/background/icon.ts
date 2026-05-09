import browser from "webextension-polyfill";
import { hostnameOf, isTracked } from "../shared/domain";

import activeIcon16 from "../assets/icon-active-16.png";
import activeIcon32 from "../assets/icon-active-32.png";
import activeIcon48 from "../assets/icon-active-48.png";
import activeIcon128 from "../assets/icon-active-128.png";
import inactiveIcon16 from "../assets/icon-inactive-16.png";
import inactiveIcon32 from "../assets/icon-inactive-32.png";
import inactiveIcon48 from "../assets/icon-inactive-48.png";
import inactiveIcon128 from "../assets/icon-inactive-128.png";

const ICONS = {
  active: {
    16: activeIcon16,
    32: activeIcon32,
    48: activeIcon48,
    128: activeIcon128,
  },
  inactive: {
    16: inactiveIcon16,
    32: inactiveIcon32,
    48: inactiveIcon48,
    128: inactiveIcon128,
  },
} as const;

export async function updateIconForTab(
  tabId: number,
  url: string | undefined,
  tracked: string[],
): Promise<void> {
  const host = hostnameOf(url);
  const active = host !== null && isTracked(host, tracked);
  const path = active ? ICONS.active : ICONS.inactive;
  try {
    await browser.action.setIcon({ tabId, path });
  } catch {
    // Tab may have closed before we got here; harmless.
  }
}

/**
 * Toolbar badge dot signaling an unfilled survey from a previous wake-day.
 * Global (not per-tab) since the prompt isn't tied to any one site.
 */
export async function setMissedBadge(missed: boolean): Promise<void> {
  try {
    await browser.action.setBadgeText({ text: missed ? "•" : "" });
    if (missed) {
      await browser.action.setBadgeBackgroundColor({ color: "#c0392b" });
    }
  } catch {
    // No-op if the API is briefly unavailable (worker boot races).
  }
}

export async function refreshAllTabIcons(tracked: string[]): Promise<void> {
  const tabs = await browser.tabs.query({});
  await Promise.all(
    tabs.map((t) =>
      t.id !== undefined ? updateIconForTab(t.id, t.url, tracked) : null,
    ),
  );
}
