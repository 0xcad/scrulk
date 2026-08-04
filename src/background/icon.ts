import browser from "webextension-polyfill";
import { hostnameOf, isTracked } from "../shared/domain";
import { getPeekSessions } from "../shared/storage";

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
  peekTabIds?: Set<number>,
): Promise<void> {
  const host = hostnameOf(url);
  const peekIds = peekTabIds ?? new Set(Object.keys(await getPeekSessions()).map(Number));
  const active =
    !peekIds.has(tabId) && host !== null && isTracked(host, tracked);
  const path = active ? ICONS.active : ICONS.inactive;
  try {
    await browser.action.setIcon({ tabId, path });
  } catch {
    // Tab may have closed before we got here; harmless.
  }
}

export async function refreshAllTabIcons(tracked: string[]): Promise<void> {
  const [tabs, peekSessions] = await Promise.all([
    browser.tabs.query({}),
    getPeekSessions(),
  ]);
  const peekTabIds = new Set(Object.keys(peekSessions).map(Number));
  await Promise.all(
    tabs.map((t) =>
      t.id !== undefined
        ? updateIconForTab(t.id, t.url, tracked, peekTabIds)
        : null,
    ),
  );
}
