import browser from "webextension-polyfill";
import { hostnameOf, isTracked } from "../shared/domain";
import { dateKey } from "../shared/history";
import { getDayState, getSettings, setDayState } from "../shared/storage";
import { effectiveMs, remainingAllowanceMs } from "../shared/types";
import { currentWakeDayStart } from "../shared/wakeDay";

const ACCESS_PAGE = "src/gateway/index.html";
const SURVEY_PAGE = "src/survey/index.html";

const accessBase = () => browser.runtime.getURL(ACCESS_PAGE);
const surveyBase = () => browser.runtime.getURL(SURVEY_PAGE);

function lifecycleUrl(tab: browser.Tabs.Tab): string | undefined {
  return tab.pendingUrl ?? tab.url;
}

function isPlainHttp(url: string | undefined): boolean {
  return url?.startsWith("http://") === true || url?.startsWith("https://") === true;
}

export function accessUrl(destUrl?: string): string {
  const base = accessBase();
  if (!destUrl) return base;
  return `${base}?${new URLSearchParams({ dest: destUrl }).toString()}`;
}

function surveyUrl(date: string): string {
  return `${surveyBase()}?date=${encodeURIComponent(date)}`;
}

async function focusTab(tab: browser.Tabs.Tab): Promise<void> {
  if (tab.windowId !== undefined) {
    await browser.windows.update(tab.windowId, { focused: true }).catch(() => null);
  }
  if (tab.id !== undefined) {
    await browser.tabs.update(tab.id, { active: true }).catch(() => null);
  }
}

async function findPage(base: string): Promise<browser.Tabs.Tab | undefined> {
  const tabs = await browser.tabs.query({});
  return tabs.find((tab) => lifecycleUrl(tab)?.startsWith(base));
}

async function closeAndFocus(tabId: number, target: browser.Tabs.Tab): Promise<void> {
  if (target.id !== tabId) await browser.tabs.remove(tabId).catch(() => null);
  await focusTab(target);
}

/** Global top-frame tracked-site gate. All domains share one DayState flow. */
export async function handleBeforeNavigate(
  details: browser.WebNavigation.OnBeforeNavigateDetailsType,
): Promise<void> {
  if (details.frameId !== 0 || !isPlainHttp(details.url)) return;
  const host = hostnameOf(details.url);
  if (!host) return;
  const settings = await getSettings();
  if (!isTracked(host, settings.trackedSites)) return;

  const state = await getDayState();
  if (state.accessFlowPhase === "popupLocked") {
    const date = dateKey(currentWakeDayStart(Date.now(), settings.wakeUpTime));
    const targetUrl = surveyUrl(date);
    const existing = await findPage(targetUrl);
    if (existing) {
      await closeAndFocus(details.tabId, existing);
      return;
    }
    await browser.tabs.update(details.tabId, { url: targetUrl }).catch(() => null);
    return;
  }

  if (
    state.accessFlowPhase === "waiting" ||
    state.accessFlowPhase === "waitingReady" ||
    state.accessFlowPhase === "picking" ||
    state.accessFlowPhase === "challenge"
  ) {
    const existing = await findPage(accessBase());
    if (existing && existing.id !== details.tabId) {
      await closeAndFocus(details.tabId, existing);
      return;
    }
    await browser.tabs
      .update(details.tabId, { url: accessUrl(details.url) })
      .catch(() => null);
  }
}

/** Focus an existing access page or create one in the requested phase. */
export async function ensureAccessPage(
  sourceTab?: browser.Tabs.Tab,
): Promise<void> {
  const existing = await findPage(accessBase());
  if (existing) {
    await focusTab(existing);
    return;
  }
  await browser.tabs.create({
    url: accessUrl(),
    active: true,
    ...(sourceTab?.windowId !== undefined ? { windowId: sourceTab.windowId } : {}),
    ...(sourceTab?.id !== undefined ? { openerTabId: sourceTab.id } : {}),
  });
}

/** Move an interrupted allowance to the acknowledgement prompt once all
 * tracked tabs have gone away. A never-used allowance starts normally. */
export async function syncTrackedTabPresence(): Promise<void> {
  const [state, settings, tabs] = await Promise.all([
    getDayState(),
    getSettings(),
    browser.tabs.query({}),
  ]);
  if (state.accessFlowPhase !== "browsing") return;
  const hasTracked = tabs.some((tab) => {
    const host = hostnameOf(lifecycleUrl(tab));
    return host !== null && isTracked(host, settings.trackedSites);
  });
  if (hasTracked || remainingAllowanceMs(state, Date.now()) <= 0) return;
  if (
    state.allowanceStartTotalMs !== null &&
    effectiveMs(state, Date.now()) > state.allowanceStartTotalMs
  ) {
    await setDayState({ ...state, accessFlowPhase: "resumePrompt" });
  }
}

export async function focusFirstTrackedTab(): Promise<void> {
  const [settings, tabs] = await Promise.all([getSettings(), browser.tabs.query({})]);
  const tracked = tabs.find((tab) => {
    const host = hostnameOf(lifecycleUrl(tab));
    return host !== null && isTracked(host, settings.trackedSites);
  });
  if (tracked) await focusTab(tracked);
}

export function isAccessPageUrl(url: string | undefined): boolean {
  return url?.startsWith(accessBase()) === true;
}
