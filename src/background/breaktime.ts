import browser from "webextension-polyfill";
import { hostnameOf, isTracked } from "../shared/domain";
import { dateKey } from "../shared/history";
import { getDayState, getSettings, setDayState } from "../shared/storage";
import { effectiveMs, remainingAllowanceMs, type DayState } from "../shared/types";
import { currentWakeDayStart } from "../shared/wakeDay";
import { ensureAccessPage, focusFirstTrackedTab } from "./gateway";

const SURVEY_PAGE = "src/survey/index.html";
const EXTENSION_MS = 2 * 60_000;
export const BREAKTIME_ALARM = "scrulk:allowance";
export const BREAKTIME_EXTENSION_ALARM = "scrulk:breaktime-extension";

export async function openSurveyTab(date: string): Promise<void> {
  const url = browser.runtime.getURL(`${SURVEY_PAGE}?date=${encodeURIComponent(date)}`);
  await browser.tabs.create({ url }).catch(() => null);
}

export async function closeTrackedTabs(): Promise<void> {
  const settings = await getSettings();
  const tabs = await browser.tabs.query({});
  const ids = tabs
    .filter((tab) => {
      const host = hostnameOf(tab.pendingUrl ?? tab.url);
      return host !== null && isTracked(host, settings.trackedSites);
    })
    .map((tab) => tab.id)
    .filter((id): id is number => id !== undefined);
  if (ids.length > 0) await browser.tabs.remove(ids).catch(() => null);
}

export async function scheduleBreaktimeAlarm(state: DayState): Promise<void> {
  if (state.breaktimeExtensionExpiresAt !== null) {
    await browser.alarms.clear(BREAKTIME_ALARM).catch(() => null);
    const existing = await browser.alarms.get(BREAKTIME_EXTENSION_ALARM).catch(() => null);
    if (
      !existing ||
      Math.abs(existing.scheduledTime - state.breaktimeExtensionExpiresAt) >= 1000
    ) {
      await browser.alarms.create(BREAKTIME_EXTENSION_ALARM, {
        when: state.breaktimeExtensionExpiresAt,
      });
    }
    return;
  }
  await browser.alarms.clear(BREAKTIME_EXTENSION_ALARM).catch(() => null);
  if (state.accessFlowPhase !== "browsing" || state.activeSince === null) {
    await browser.alarms.clear(BREAKTIME_ALARM).catch(() => null);
    return;
  }
  const remaining = remainingAllowanceMs(state, Date.now());
  if (remaining <= 0) {
    await browser.alarms.clear(BREAKTIME_ALARM).catch(() => null);
    return;
  }
  const when = Date.now() + remaining;
  const existing = await browser.alarms.get(BREAKTIME_ALARM).catch(() => null);
  if (existing && Math.abs(existing.scheduledTime - when) < 1000) return;
  await browser.alarms.create(BREAKTIME_ALARM, { when });
}

export async function handleWaitContinue(): Promise<void> {
  const state = await getDayState();
  if (state.accessFlowPhase !== "waitingReady") return;
  await setDayState({
    ...state,
    accessFlowPhase: "picking",
    waitingPageFocused: false,
  });
}

export async function handleWaitingFocus(focused: boolean): Promise<void> {
  const state = await getDayState();
  if (
    state.accessFlowPhase !== "waiting" ||
    state.waitingPageFocused === focused
  ) return;
  await setDayState({ ...state, waitingPageFocused: focused });
}

export async function handleChooseAllowance(
  minutes: number,
  destUrl: string | undefined,
  senderTabId: number | undefined,
): Promise<void> {
  if (![2, 5, 10].includes(minutes)) return;
  const state = await getDayState();
  if (state.accessFlowPhase !== "picking") return;
  const now = Date.now();
  await setDayState({
    ...state,
    accessFlowPhase: "browsing",
    allowanceMs: minutes * 60_000,
    allowanceStartTotalMs: effectiveMs(state, now),
    breakOpenedAt: null,
    breaktimeExtensionExpiresAt: null,
    breaktimeExtensionUsed: false,
    breaktimeExtensionTabs: {},
  });
  if (senderTabId === undefined) return;
  if (destUrl?.startsWith("http://") || destUrl?.startsWith("https://")) {
    await browser.tabs.update(senderTabId, { url: destUrl }).catch(() => null);
  } else {
    await browser.tabs.remove(senderTabId).catch(() => null);
    await focusFirstTrackedTab();
  }
}

export async function handleResumePrompt(): Promise<void> {
  const state = await getDayState();
  if (state.accessFlowPhase !== "resumePrompt") return;
  await setDayState({ ...state, accessFlowPhase: "browsing" });
}

export async function handleBreaktimeContinue(
  sourceTab: browser.Tabs.Tab | undefined,
): Promise<void> {
  const state = await getDayState();
  if (
    state.accessFlowPhase !== "break" ||
    state.breakOpenedAt === null ||
    Date.now() - state.breakOpenedAt < 30_000
  ) return;
  await setDayState({ ...state, accessFlowPhase: "challenge" });
  await ensureAccessPage(sourceTab);
}

export async function handleChallengeComplete(): Promise<void> {
  const state = await getDayState();
  if (state.accessFlowPhase !== "challenge") return;
  await setDayState({
    ...state,
    accessFlowPhase: "picking",
    breaktimeChallengeCompletedToday: true,
    allowanceMs: null,
    allowanceStartTotalMs: null,
    breakOpenedAt: null,
  });
}

export async function handleBreaktimeExtend(): Promise<void> {
  const [state, settings, tabs] = await Promise.all([
    getDayState(),
    getSettings(),
    browser.tabs.query({}),
  ]);
  if (state.accessFlowPhase !== "break" || state.breaktimeExtensionUsed) return;
  const extensionTabs: Record<string, string> = {};
  for (const tab of tabs) {
    const url = tab.pendingUrl ?? tab.url;
    const host = hostnameOf(url);
    if (tab.id !== undefined && url && host && isTracked(host, settings.trackedSites)) {
      extensionTabs[String(tab.id)] = url;
    }
  }
  const expiresAt = Date.now() + EXTENSION_MS;
  await setDayState({
    ...state,
    accessFlowPhase: "browsing",
    breaktimeExtensionExpiresAt: expiresAt,
    breaktimeExtensionUsed: true,
    breaktimeExtensionTabs: extensionTabs,
  });
  await browser.alarms.create(BREAKTIME_EXTENSION_ALARM, { when: expiresAt });
}

export async function endBreaktimeExtension(): Promise<void> {
  const state = await getDayState();
  if (state.breaktimeExtensionExpiresAt === null) return;
  await browser.alarms.clear(BREAKTIME_EXTENSION_ALARM).catch(() => null);
  await setDayState({
    ...state,
    accessFlowPhase: "break",
    breakOpenedAt: Date.now(),
    breaktimeExtensionExpiresAt: null,
    breaktimeExtensionTabs: {},
  });
}

export async function handleExtensionTabRemoved(tabId: number): Promise<void> {
  const state = await getDayState();
  if (
    state.breaktimeExtensionExpiresAt === null ||
    !(String(tabId) in state.breaktimeExtensionTabs)
  ) return;
  const liveTabs = await browser.tabs.query({});
  const hasEligible = liveTabs.some(
    (tab) => tab.id !== undefined && String(tab.id) in state.breaktimeExtensionTabs,
  );
  if (!hasEligible) await endBreaktimeExtension();
}

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

async function openTodaySurvey(): Promise<void> {
  const settings = await getSettings();
  const date = dateKey(currentWakeDayStart(Date.now(), settings.wakeUpTime));
  await openSurveyTab(date);
}

/** Break-overlay done: survey is informational and the next visit uses picker. */
export async function handleBreaktimeDone(): Promise<void> {
  const state = await getDayState();
  await setDayState({
    ...state,
    accessFlowPhase: "picking",
    allowanceMs: null,
    allowanceStartTotalMs: null,
    breakOpenedAt: null,
    breaktimeExtensionExpiresAt: null,
    breaktimeExtensionUsed: false,
    breaktimeExtensionTabs: {},
  });
  await openTodaySurvey();
  await closeTrackedTabs();
}

/** Popup-only done: lock tracked access behind the survey continuation. */
export async function handlePopupDone(): Promise<void> {
  const state = await getDayState();
  await setDayState({
    ...state,
    accessFlowPhase: "popupLocked",
    popupDoneToday: true,
    surveyContinueAllowed: false,
    allowanceMs: null,
    allowanceStartTotalMs: null,
    breakOpenedAt: null,
    breaktimeExtensionExpiresAt: null,
    breaktimeExtensionUsed: false,
    breaktimeExtensionTabs: {},
  });
  await openTodaySurvey();
  await closeTrackedTabs();
}
