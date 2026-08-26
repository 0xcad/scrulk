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
import focusIcon16 from "../assets/icon-focus-16.png";
import focusIcon32 from "../assets/icon-focus-32.png";
import focusIcon48 from "../assets/icon-focus-48.png";
import focusIcon128 from "../assets/icon-focus-128.png";
import { isFocusWindow } from "../features/focus/background";

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
  focus: {
    16: focusIcon16,
    32: focusIcon32,
    48: focusIcon48,
    128: focusIcon128,
  },
} as const;

export async function updateIconForTab(
  tabId: number,
  url: string | undefined,
  tracked: string[],
): Promise<void> {
  const tab = await browser.tabs.get(tabId).catch(() => null);
  if (!tab) return;
  const host = hostnameOf(url);
  const active = host !== null && isTracked(host, tracked);
  const focused = await isFocusWindow(tab.windowId);
  const path = focused ? ICONS.focus : active ? ICONS.active : ICONS.inactive;
  try {
    await browser.action.setIcon({ tabId, path });
  } catch {
    // Tab may have closed before we got here; harmless.
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
