import browser from "webextension-polyfill";
import { hostnameOf, isTracked } from "../shared/domain";
import {
  getDayState,
  getPeekSessions,
  getSettings,
  setDayState,
} from "../shared/storage";

/**
 * Close `tabId` if it pushes the count of tracked-host tabs over
 * `settings.tabLimit`. Sets `dayState.tabLimitWarning = true` when it does,
 * which the popup reads on mount and clears.
 *
 * Counting only blocks tabs that just *became* tracked: a tab navigating
 * within tracked hosts doesn't change the count, so `count > limit` only
 * fires on a fresh arrival.
 */
export async function enforceTabLimit(
  tabId: number,
  url: string | undefined,
): Promise<void> {
  const host = hostnameOf(url);
  if (!host) return;
  const settings = await getSettings();
  if (!isTracked(host, settings.trackedSites)) return;

  const [tabs, peekSessions] = await Promise.all([
    browser.tabs.query({}),
    getPeekSessions(),
  ]);
  const trackedCount = tabs.filter((t) => {
    if (t.id !== undefined && peekSessions[String(t.id)] !== undefined) return false;
    const h = hostnameOf(t.url);
    return h !== null && isTracked(h, settings.trackedSites);
  }).length;

  if (trackedCount <= settings.tabLimit) return;

  await browser.tabs.remove(tabId).catch(() => null);
  const state = await getDayState();
  if (!state.tabLimitWarning) {
    await setDayState({ ...state, tabLimitWarning: true });
  }
}
