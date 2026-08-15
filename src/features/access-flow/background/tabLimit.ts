import browser from "webextension-polyfill";
import { hostnameOf, isTracked } from "../../../shared/domain";
import { getDayState, getSettings, setDayState } from "../../../shared/storage";

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
  const [settings, state] = await Promise.all([getSettings(), getDayState()]);
  if (!isTracked(host, settings.trackedSites)) return;
  if (
    state.accessFlowPhase === "waitingConfirmation" ||
    state.accessFlowPhase === "waiting" ||
    state.accessFlowPhase === "waitingReady" ||
    state.accessFlowPhase === "picking" ||
    state.accessFlowPhase === "challenge" ||
    state.accessFlowPhase === "popupLocked"
  ) return;

  const tabs = await browser.tabs.query({});
  const trackedCount = tabs.filter((t) => {
    const h = hostnameOf(t.url);
    return h !== null && isTracked(h, settings.trackedSites);
  }).length;

  if (trackedCount <= settings.tabLimit) return;

  await browser.tabs.remove(tabId).catch(() => null);
  if (!state.tabLimitWarning) {
    await setDayState({ ...state, tabLimitWarning: true });
  }
}
