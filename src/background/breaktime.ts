import browser from "webextension-polyfill";
import { hostnameOf, isTracked } from "../shared/domain";
import { dateKey } from "../shared/history";
import { getDayState, getSettings, setDayState } from "../shared/storage";
import { effectiveMs, type DayState, type Settings } from "../shared/types";
import { currentWakeDayStart } from "../shared/wakeDay";

const SURVEY_PAGE = "src/survey/index.html";
const BREAKTIME_PAGE = "src/breaktime/index.html";

export async function openSurveyTab(date: string): Promise<void> {
  const url = browser.runtime.getURL(`${SURVEY_PAGE}?date=${encodeURIComponent(date)}`);
  await browser.tabs.create({ url }).catch(() => null);
}

export async function closeTrackedTabs(): Promise<void> {
  const settings = await getSettings();
  const tabs = await browser.tabs.query({});
  const ids = tabs
    .filter((t) => {
      const host = hostnameOf(t.url);
      return host !== null && isTracked(host, settings.trackedSites);
    })
    .map((t) => t.id)
    .filter((id): id is number => id !== undefined);
  if (ids.length > 0) {
    await browser.tabs.remove(ids).catch(() => null);
  }
}

export const BREAKTIME_ALARM = "scrulk:breaktime";
export const BREAKTIME_EXTENSION_ALARM = "scrulk:breaktime-extension";
const EXTENSION_MS = 2 * 60_000;

/**
 * Schedule the next breaktime alarm based on remaining time until the
 * threshold. Cleared if no segment is open or an alert is already showing —
 * tracker.recompute() will re-call this on every relevant event.
 */
export async function scheduleBreaktimeAlarm(
  state: DayState,
  settings: Settings,
): Promise<void> {
  if (state.breaktimeExtensionExpiresAt !== null) {
    await browser.alarms.clear(BREAKTIME_ALARM).catch(() => null);
    const existing = await browser.alarms.get(BREAKTIME_EXTENSION_ALARM).catch(() => null);
    if (
      existing &&
      Math.abs(existing.scheduledTime - state.breaktimeExtensionExpiresAt) < 1000
    ) return;
    await browser.alarms.create(BREAKTIME_EXTENSION_ALARM, {
      when: state.breaktimeExtensionExpiresAt,
    });
    return;
  }
  await browser.alarms.clear(BREAKTIME_EXTENSION_ALARM).catch(() => null);
  if (state.breaktimeOpen || state.activeSince === null) {
    await browser.alarms.clear(BREAKTIME_ALARM).catch(() => null);
    return;
  }
  const now = Date.now();
  const since = effectiveMs(state, now) - state.lastBreaktimeAt;
  const remaining = settings.breaktimeMinutes * 60_000 - since;
  if (remaining <= 0) {
    // Already past threshold — recompute() will flip breaktimeOpen on its
    // next call. Don't schedule.
    await browser.alarms.clear(BREAKTIME_ALARM).catch(() => null);
    return;
  }
  const when = now + remaining;
  const existing = await browser.alarms.get(BREAKTIME_ALARM).catch(() => null);
  if (existing && Math.abs(existing.scheduledTime - when) < 1000) return;
  await browser.alarms.create(BREAKTIME_ALARM, { when });
}

/**
 * Called when the user successfully completes the hold challenge. Closes the
 * current alert and opens a new breaktime cycle from the current effectiveMs.
 */
export async function handleBreaktimeResume(): Promise<void> {
  const state = await getDayState();
  if (!state.breaktimeOpen) return;
  const now = Date.now();
  await setDayState({
    ...state,
    breaktimeOpen: false,
    lastBreaktimeAt: effectiveMs(state, now),
    breaktimeExtensionExpiresAt: null,
    breaktimeExtensionUsed: false,
    breaktimeExtensionTabs: {},
    breaktimeChallengeTab: null,
  });
}

/**
 * Replace the alert's originating tracked tab with the extension-origin
 * challenge page. The saved snapshot survives service-worker restarts and
 * supplies the exact return URL once the user completes the hold.
 */
export async function openBreaktimeChallenge(tabId: number | undefined): Promise<void> {
  if (tabId === undefined) return;
  const [state, settings, tab] = await Promise.all([
    getDayState(),
    getSettings(),
    browser.tabs.get(tabId).catch(() => null),
  ]);
  if (!state.breaktimeOpen || !tab?.url) return;

  const existing = state.breaktimeChallengeTab;
  if (existing !== null) {
    const existingTab = await browser.tabs.get(existing.tabId).catch(() => null);
    if (existingTab) {
      await browser.tabs.update(existing.tabId, { active: true }).catch(() => null);
      if (existingTab.windowId !== undefined) {
        await browser.windows.update(existingTab.windowId, { focused: true }).catch(() => null);
      }
      return;
    }
  }

  const host = hostnameOf(tab.url);
  if (host === null || !isTracked(host, settings.trackedSites)) return;
  await setDayState({
    ...state,
    breaktimeChallengeTab: { tabId, returnUrl: tab.url },
  });
  await browser.tabs.update(tabId, { url: browser.runtime.getURL(BREAKTIME_PAGE) }).catch(() => null);
}

/** Clear a stale challenge snapshot when its extension page tab closes. */
export async function handleBreaktimeChallengeTabRemoved(tabId: number): Promise<void> {
  const state = await getDayState();
  if (state.breaktimeChallengeTab?.tabId !== tabId) return;
  await setDayState({ ...state, breaktimeChallengeTab: null });
}

/** Return a successful challenge tab to its original tracked URL. */
export async function resumeBreaktimeChallenge(tabId: number | undefined): Promise<void> {
  if (tabId === undefined) return;
  const state = await getDayState();
  const challenge = state.breaktimeChallengeTab;
  if (challenge?.tabId !== tabId) return;
  await handleBreaktimeResume();
  await browser.tabs.update(tabId, { url: challenge.returnUrl }).catch(() => null);
}

/** Start the single two-minute extension available for an open alert. */
export async function handleBreaktimeExtend(): Promise<void> {
  const [state, settings, tabs] = await Promise.all([
    getDayState(),
    getSettings(),
    browser.tabs.query({}),
  ]);
  if (!state.breaktimeOpen || state.breaktimeExtensionUsed) return;

  if (state.breaktimeChallengeTab !== null) {
    await browser.tabs.remove(state.breaktimeChallengeTab.tabId).catch(() => null);
  }

  const extensionTabs: Record<string, string> = {};
  for (const tab of tabs) {
    const host = hostnameOf(tab.url);
    if (tab.id !== undefined && tab.url && host && isTracked(host, settings.trackedSites)) {
      extensionTabs[String(tab.id)] = tab.url;
    }
  }

  const expiresAt = Date.now() + EXTENSION_MS;
  await setDayState({
    ...state,
    breaktimeOpen: false,
    breaktimeExtensionExpiresAt: expiresAt,
    breaktimeExtensionUsed: true,
    breaktimeExtensionTabs: extensionTabs,
    breaktimeChallengeTab: null,
  });
  await browser.alarms.create(BREAKTIME_EXTENSION_ALARM, { when: expiresAt });
}

/** Restore the alert once an extension expires, or no eligible tabs remain. */
export async function endBreaktimeExtension(): Promise<void> {
  const state = await getDayState();
  if (state.breaktimeExtensionExpiresAt === null) return;
  await browser.alarms.clear(BREAKTIME_EXTENSION_ALARM).catch(() => null);
  await setDayState({
    ...state,
    breaktimeOpen: true,
    breaktimeExtensionExpiresAt: null,
    breaktimeExtensionTabs: {},
  });
}

/** End early once none of the original tracked tabs still exists. */
export async function handleExtensionTabRemoved(tabId: number): Promise<void> {
  const state = await getDayState();
  if (state.breaktimeExtensionExpiresAt === null) return;
  if (!(String(tabId) in state.breaktimeExtensionTabs)) return;
  // Do not mutate the snapshot one event at a time: several onRemoved
  // handlers may run concurrently after the user closes multiple tabs.
  // The live tab list is the source of truth for this one condition.
  const liveTabs = await browser.tabs.query({});
  const hasEligibleTab = liveTabs.some(
    (tab) => tab.id !== undefined && String(tab.id) in state.breaktimeExtensionTabs,
  );
  if (!hasEligibleTab) await endBreaktimeExtension();
}

/** Close tracked navigations not present in the extension's original snapshot. */
export async function enforceExtensionNavigation(
  tabId: number,
  url: string | undefined,
): Promise<boolean> {
  const state = await getDayState();
  if (state.breaktimeExtensionExpiresAt === null) return false;
  if (state.breaktimeExtensionExpiresAt <= Date.now()) {
    await endBreaktimeExtension();
    return false;
  }
  const host = hostnameOf(url);
  if (!host) return false;
  const settings = await getSettings();
  if (!isTracked(host, settings.trackedSites)) return false;
  const allowedUrl = state.breaktimeExtensionTabs[String(tabId)];
  if (allowedUrl !== undefined && samePage(allowedUrl, url)) return false;
  await browser.tabs.remove(tabId).catch(() => null);
  return true;
}

function samePage(a: string, b: string | undefined): boolean {
  if (!b) return false;
  try {
    const left = new URL(a);
    const right = new URL(b);
    left.hash = "";
    right.hash = "";
    return left.href === right.href;
  } catch {
    return a === b;
  }
}

/**
 * Called when the user clicks "I'm done!". Opens the survey page in a fresh
 * tab and closes every tracked-site tab across all windows. Leaves
 * `breaktimeOpen=true` deliberately: if the user reopens any tracked site
 * before completing the hold challenge, the overlay mounts immediately. Only
 * a successful hold (`handleBreaktimeResume`) clears the flag.
 */
export async function handleBreaktimeDone(): Promise<void> {
  const [settings, state] = await Promise.all([getSettings(), getDayState()]);
  const date = dateKey(currentWakeDayStart(Date.now(), settings.wakeUpTime));
  // Open survey first so closing the active tab doesn't race the create.
  await openSurveyTab(date);
  if (state.breaktimeChallengeTab !== null) {
    await setDayState({ ...state, breaktimeChallengeTab: null });
    await browser.tabs.remove(state.breaktimeChallengeTab.tabId).catch(() => null);
  }
  await closeTrackedTabs();
}
