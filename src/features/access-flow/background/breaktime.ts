import browser from "webextension-polyfill";
import {
  completedTrackedAverageMs,
  isAllowanceMinutesAllowed,
} from "../allowanceOptions";
import { hostnameOf, isTracked } from "../../../shared/domain";
import { EXTENSION_PAGES } from "../../../shared/extensionPages";
import { dateKey, getAllDays } from "../../../shared/history";
import { getDayState, getSettings, setDayState } from "../../../shared/storage";
import { effectiveMs, remainingAllowanceMs, type DayState } from "../../../shared/dayState";
import { currentWakeDayStart } from "../../../shared/wakeDay";
import { ensureAccessPage, focusFirstTrackedTab } from "./gateway";
import { ALARM_NAMES } from "../../../background/alarms";
import { reduceAccessFlow } from "../transitions";

const EXTENSION_MS = 2 * 60_000;

export async function openSurveyTab(date: string): Promise<void> {
  const url = browser.runtime.getURL(
    `${EXTENSION_PAGES.survey}?date=${encodeURIComponent(date)}`,
  );
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
    await browser.alarms.clear(ALARM_NAMES.allowance).catch(() => null);
    const existing = await browser.alarms.get(ALARM_NAMES.breaktimeExtension).catch(() => null);
    if (
      !existing ||
      Math.abs(existing.scheduledTime - state.breaktimeExtensionExpiresAt) >= 1000
    ) {
      await browser.alarms.create(ALARM_NAMES.breaktimeExtension, {
        when: state.breaktimeExtensionExpiresAt,
      });
    }
    return;
  }
  await browser.alarms.clear(ALARM_NAMES.breaktimeExtension).catch(() => null);
  if (state.accessFlowPhase !== "browsing" || state.activeSince === null) {
    await browser.alarms.clear(ALARM_NAMES.allowance).catch(() => null);
    return;
  }
  const remaining = remainingAllowanceMs(state, Date.now());
  if (remaining <= 0) {
    await browser.alarms.clear(ALARM_NAMES.allowance).catch(() => null);
    return;
  }
  const when = Date.now() + remaining;
  const existing = await browser.alarms.get(ALARM_NAMES.allowance).catch(() => null);
  if (existing && Math.abs(existing.scheduledTime - when) < 1000) return;
  await browser.alarms.create(ALARM_NAMES.allowance, { when });
}

export async function handleWaitContinue(): Promise<void> {
  const state = await getDayState();
  await persistTransition(state, reduceAccessFlow(state, { type: "waitCompleted" }));
}

export async function handleWaitingFocus(focused: boolean): Promise<void> {
  const state = await getDayState();
  await persistTransition(
    state,
    reduceAccessFlow(state, { type: "waitingFocusChanged", focused }),
  );
}

export async function handleChooseAllowance(
  minutes: number,
  destUrl: string | undefined,
  senderTabId: number | undefined,
): Promise<void> {
  const state = await getDayState();
  if (state.accessFlowPhase !== "picking") return;
  const trackedAverageMs = await getAllDays()
    .then((days) => completedTrackedAverageMs(days, state.wakeDayStart))
    .catch(() => null);
  if (!isAllowanceMinutesAllowed(minutes, trackedAverageMs)) {
    return;
  }
  const now = Date.now();
  await setDayState(reduceAccessFlow(state, {
    type: "allowanceChosen",
    allowanceMs: minutes * 60_000,
    startTotalMs: effectiveMs(state, now),
  }));
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
  await persistTransition(
    state,
    reduceAccessFlow(state, { type: "allowanceResumed" }),
  );
}

export async function handleBreaktimeContinue(
  sourceTab: browser.Tabs.Tab | undefined,
): Promise<void> {
  const state = await getDayState();
  const next = reduceAccessFlow(state, {
    type: "challengeStarted",
    now: Date.now(),
    gateMs: 30_000,
  });
  if (next === state) return;
  await setDayState(next);
  await ensureAccessPage(sourceTab);
}

export async function handleChallengeComplete(): Promise<void> {
  const state = await getDayState();
  await persistTransition(
    state,
    reduceAccessFlow(state, { type: "challengeCompleted" }),
  );
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
  await setDayState(reduceAccessFlow(state, {
    type: "extensionStarted",
    expiresAt,
    tabs: extensionTabs,
  }));
  await browser.alarms.create(ALARM_NAMES.breaktimeExtension, { when: expiresAt });
}

export async function endBreaktimeExtension(): Promise<void> {
  const state = await getDayState();
  if (state.breaktimeExtensionExpiresAt === null) return;
  await browser.alarms.clear(ALARM_NAMES.breaktimeExtension).catch(() => null);
  await setDayState(reduceAccessFlow(state, {
    type: "extensionEnded",
    openedAt: Date.now(),
  }));
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
  await setDayState(reduceAccessFlow(state, { type: "breaktimeDone" }));
  await openTodaySurvey();
  await closeTrackedTabs();
}

/** Popup-only done: lock tracked access behind the survey continuation. */
export async function handlePopupDone(): Promise<void> {
  const state = await getDayState();
  await setDayState(reduceAccessFlow(state, { type: "popupDone" }));
  await openTodaySurvey();
  await closeTrackedTabs();
}

async function persistTransition(state: DayState, next: DayState): Promise<void> {
  if (next !== state) await setDayState(next);
}
