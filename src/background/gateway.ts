import browser from "webextension-polyfill";
import { findMatchingDomain, hostnameOf } from "../shared/domain";
import {
  getGatewayState,
  getSettings,
  getTabBackMap,
  setGatewayState,
  setTabBackMap,
} from "../shared/storage";
import type { GatewayDomainState, GatewayState, TabBackMap } from "../shared/types";

const GATEWAY_PAGE = "src/gateway/index.html";
const EXPIRE_ALARM_PREFIX = "scrulk:gateway-expire:";

/** Build the moz-extension://… gateway URL with the params the page needs. */
export function gatewayUrl(
  domain: string,
  destUrl: string,
  backUrl: string | null,
): string {
  const base = browser.runtime.getURL(GATEWAY_PAGE);
  const params = new URLSearchParams({ domain, dest: destUrl });
  if (backUrl) params.set("back", backUrl);
  return `${base}?${params.toString()}`;
}

function isPlainHttp(url: string | undefined): boolean {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

function expireAlarmName(domain: string): string {
  return EXPIRE_ALARM_PREFIX + domain;
}

function parseExpireAlarm(name: string): string | null {
  return name.startsWith(EXPIRE_ALARM_PREFIX)
    ? name.slice(EXPIRE_ALARM_PREFIX.length)
    : null;
}

/** True if `domain` currently has any state that should bypass the gateway. */
function isUnlocked(entry: GatewayDomainState | undefined, now: number): boolean {
  if (!entry) return false;
  if (entry.continueFlag) return true;
  if (entry.timerExpiresAt !== undefined && entry.timerExpiresAt > now) {
    return true;
  }
  // expiredAlertActive means the user owes the journal entry but tabs are
  // still open — don't redirect new loads through the gateway, the overlay
  // handles it.
  if (entry.expiredAlertActive) return true;
  return false;
}

/**
 * webNavigation.onBeforeNavigate handler. Redirects to the gateway page when
 * the destination is tracked and no per-domain bypass is active.
 */
export async function handleBeforeNavigate(
  details: browser.WebNavigation.OnBeforeNavigateDetailsType,
): Promise<void> {
  if (details.frameId !== 0) return; // top frame only
  if (!isPlainHttp(details.url)) return;
  const host = hostnameOf(details.url);
  if (!host) return;
  const settings = await getSettings();
  const matched = findMatchingDomain(host, settings.trackedSites);
  if (matched === null) return;

  const state = await getGatewayState();
  if (isUnlocked(state[matched], Date.now())) return;

  // Capture the tab's pre-navigation URL as the "back" target. tab.url at
  // onBeforeNavigate is still the previous committed URL.
  const tab = await browser.tabs.get(details.tabId).catch(() => null);
  const prevUrl = tab?.url;
  const backUrl = prevUrl && isPlainHttp(prevUrl) ? prevUrl : null;

  const target = gatewayUrl(matched, details.url, backUrl);
  await browser.tabs.update(details.tabId, { url: target }).catch(() => null);
}

/** Track per-tab last-committed untracked URL for back navigation. */
export async function handleCommitted(
  details: browser.WebNavigation.OnCommittedDetailsType,
): Promise<void> {
  if (details.frameId !== 0) return;
  if (!isPlainHttp(details.url)) {
    // Ignore extension pages / about:newtab — they aren't useful back targets
    // and we don't want the gateway page itself to overwrite the back entry.
    return;
  }
  const host = hostnameOf(details.url);
  if (!host) return;
  const settings = await getSettings();
  if (findMatchingDomain(host, settings.trackedSites) !== null) {
    return; // tracked — don't record
  }
  const map = await getTabBackMap();
  map[String(details.tabId)] = details.url;
  await setTabBackMap(map);
}

/** Count tabs whose host matches each tracked domain. */
async function countTabsByDomain(
  trackedSites: string[],
): Promise<Map<string, number>> {
  const tabs = await browser.tabs.query({});
  const counts = new Map<string, number>();
  for (const t of tabs) {
    const host = hostnameOf(t.url);
    if (!host) continue;
    const d = findMatchingDomain(host, trackedSites);
    if (d === null) continue;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return counts;
}

/**
 * Recompute per-domain state after a tab close/navigate: any domain with zero
 * tabs open has its state cleared and its expiry alarm cancelled. Returns
 * whether anything changed.
 */
export async function syncDomainTabPresence(): Promise<void> {
  const settings = await getSettings();
  const state = await getGatewayState();
  if (Object.keys(state).length === 0) return;
  const counts = await countTabsByDomain(settings.trackedSites);
  let changed = false;
  for (const domain of Object.keys(state)) {
    if ((counts.get(domain) ?? 0) === 0) {
      delete state[domain];
      await browser.alarms.clear(expireAlarmName(domain)).catch(() => null);
      changed = true;
    }
  }
  if (changed) await setGatewayState(state);
}

/** Drop tab from the back map when it closes. */
export async function forgetTab(tabId: number): Promise<void> {
  const map = await getTabBackMap();
  const key = String(tabId);
  if (map[key] === undefined) return;
  delete map[key];
  await setTabBackMap(map);
}

/** Read the back URL for a tab, returning null if none. */
async function backUrlFor(tabId: number): Promise<string | null> {
  const map = await getTabBackMap();
  return map[String(tabId)] ?? null;
}

/**
 * Navigate a tab "back": prefer the last-known untracked URL for the tab,
 * else close the tab (or send it to about:newtab if it's the only tab in
 * its window).
 */
export async function navigateTabBack(tabId: number): Promise<void> {
  const back = await backUrlFor(tabId);
  if (back) {
    await browser.tabs.update(tabId, { url: back }).catch(() => null);
    return;
  }
  const tab = await browser.tabs.get(tabId).catch(() => null);
  if (!tab || tab.windowId === undefined) {
    await browser.tabs.remove(tabId).catch(() => null);
    return;
  }
  const win = await browser.windows
    .get(tab.windowId, { populate: true })
    .catch(() => null);
  const tabCount = win?.tabs?.length ?? 0;
  if (tabCount > 1) {
    await browser.tabs.remove(tabId).catch(() => null);
  } else {
    await browser.tabs.update(tabId, { url: "about:newtab" }).catch(() => null);
  }
}

/** gateway:startTimer */
export async function startTimer(
  domain: string,
  minutes: number,
  destUrl: string,
  senderTabId: number | undefined,
): Promise<void> {
  const now = Date.now();
  const expiresAt = now + minutes * 60_000;
  const state = await getGatewayState();
  state[domain] = {
    ...(state[domain] ?? {}),
    timerExpiresAt: expiresAt,
    continueFlag: false,
    expiredAlertActive: false,
  };
  await setGatewayState(state);
  await browser.alarms.create(expireAlarmName(domain), { when: expiresAt });
  if (senderTabId !== undefined) {
    await browser.tabs.update(senderTabId, { url: destUrl }).catch(() => null);
  }
}

/** Alarm fired — flip to expired-alert if tabs are still open. */
export async function handleExpireAlarm(domain: string): Promise<void> {
  const settings = await getSettings();
  const counts = await countTabsByDomain(settings.trackedSites);
  const state = await getGatewayState();
  if ((counts.get(domain) ?? 0) === 0) {
    delete state[domain];
    await setGatewayState(state);
    return;
  }
  state[domain] = {
    ...(state[domain] ?? {}),
    timerExpiresAt: undefined,
    expiredAlertActive: true,
    continueFlag: false,
  };
  await setGatewayState(state);
}

/** gateway:imDone — back-nav every tab on `domain` and clear state. */
export async function handleImDone(domain: string): Promise<void> {
  const settings = await getSettings();
  const tabs = await browser.tabs.query({});
  const targets = tabs.filter((t) => {
    const host = hostnameOf(t.url);
    if (!host) return false;
    return findMatchingDomain(host, settings.trackedSites) === domain;
  });
  for (const t of targets) {
    if (t.id === undefined) continue;
    await navigateTabBack(t.id);
  }
  const state = await getGatewayState();
  delete state[domain];
  await setGatewayState(state);
  await browser.alarms.clear(expireAlarmName(domain)).catch(() => null);
}

/** gateway:setContinue — bypass gateway until all tabs close. */
export async function handleSetContinue(domain: string): Promise<void> {
  const state = await getGatewayState();
  state[domain] = {
    continueFlag: true,
    timerExpiresAt: undefined,
    expiredAlertActive: false,
  };
  await setGatewayState(state);
  await browser.alarms.clear(expireAlarmName(domain)).catch(() => null);
}

/** Registered from background/index.ts. Returns whether the alarm was ours. */
export async function maybeHandleAlarm(alarmName: string): Promise<boolean> {
  const domain = parseExpireAlarm(alarmName);
  if (domain === null) return false;
  await handleExpireAlarm(domain);
  return true;
}

/** True if any domain currently has an expired alert active (tracker pauses). */
export function anyExpiredAlertActive(state: GatewayState): boolean {
  for (const entry of Object.values(state)) {
    if (entry?.expiredAlertActive) return true;
  }
  return false;
}

// Re-export for callers that want to clean up.
export { type TabBackMap };
