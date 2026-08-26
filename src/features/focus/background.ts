import browser from "webextension-polyfill";
import { hostnameOf, isTracked } from "../../shared/domain";
import type { FocusSession, FocusTabSnapshot } from "../../shared/focusSessions";
import { getFocusSessions, getSettings, setFocusSessions } from "../../shared/storage";

const FOCUS_BLOCK_RULE_ID = 10_002;
const WINDOW_SESSION_KEY = "scrulkFocusSessionId";
let lastRegularWindowId: number | null = null;

type FirefoxSessions = typeof browser.sessions & {
  setWindowValue?: (windowId: number, key: string, value: unknown) => Promise<void>;
  getWindowValue?: (windowId: number, key: string) => Promise<unknown>;
};

function sessionsApi(): FirefoxSessions {
  return browser.sessions as FirefoxSessions;
}

function tabUrl(tab: browser.Tabs.Tab): string {
  return tab.pendingUrl ?? tab.url ?? "about:blank";
}

function snapshotTab(
  tab: browser.Tabs.Tab,
  prior?: FocusTabSnapshot,
): FocusTabSnapshot {
  const url = tabUrl(tab);
  return {
    id: prior?.id ?? crypto.randomUUID(),
    runtimeTabId: tab.id ?? null,
    url,
    title: tab.title ?? prior?.title ?? url,
    index: tab.index,
    active: tab.active,
    pinned: tab.pinned,
    lastAllowedUrl: url,
  };
}

function sessionForWindow(sessions: FocusSession[], windowId: number): FocusSession | undefined {
  return sessions.find((session) =>
    session.status === "active" && session.runtimeWindowId === windowId
  );
}

async function persistSession(next: FocusSession): Promise<void> {
  const state = await getFocusSessions();
  await setFocusSessions({
    sessions: state.sessions.map((session) => session.id === next.id ? next : session),
  });
}

async function attachFirefoxWindowValue(windowId: number, sessionId: string): Promise<void> {
  const api = sessionsApi();
  if (!api.setWindowValue) return;
  await api.setWindowValue(windowId, WINDOW_SESSION_KEY, sessionId).catch(() => undefined);
}

export async function syncFocusBlockRule(): Promise<void> {
  const [state, settings] = await Promise.all([getFocusSessions(), getSettings()]);
  const tabIds = state.sessions
    .filter((session) => session.status === "active")
    .flatMap((session) => session.tabs)
    .map((tab) => tab.runtimeTabId)
    .filter((id): id is number => id !== null);
  const addRules: browser.DeclarativeNetRequest.Rule[] = [];
  if (tabIds.length > 0 && settings.trackedSites.length > 0) {
    addRules.push({
      id: FOCUS_BLOCK_RULE_ID,
      priority: 2,
      action: { type: "block" },
      condition: {
        requestDomains: settings.trackedSites,
        resourceTypes: ["main_frame"],
        tabIds,
      },
    });
  }
  await browser.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [FOCUS_BLOCK_RULE_ID],
    addRules,
  });
}

export async function startFocus(windowId: number): Promise<void> {
  const window = await browser.windows.get(windowId, { populate: true });
  if (window.incognito || window.type !== "normal" || !window.tabs) return;
  const state = await getFocusSessions();
  if (sessionForWindow(state.sessions, windowId)) return;
  const settings = await getSettings();
  const now = Date.now();
  const snapshots = window.tabs.map((tab) => snapshotTab(tab));
  const tabs = snapshots.filter((tab) => {
    const host = hostnameOf(tab.url);
    return host === null || !isTracked(host, settings.trackedSites);
  });
  const stashedTabs = snapshots.filter((tab) => {
    const host = hostnameOf(tab.url);
    return host !== null && isTracked(host, settings.trackedSites);
  });
  const session: FocusSession = {
    id: crypto.randomUUID(),
    name: null,
    status: "active",
    runtimeWindowId: windowId,
    browserSessionId: null,
    tabs,
    stashedTabs,
    createdAt: now,
    updatedAt: now,
    closingAction: null,
  };
  await setFocusSessions({ sessions: [...state.sessions, session] });
  await attachFirefoxWindowValue(windowId, session.id);

  if (tabs.length === 0) {
    const replacement = await browser.tabs.create({ windowId, active: true });
    session.tabs = [snapshotTab(replacement)];
    session.updatedAt = Date.now();
    await persistSession(session);
  }
  const trackedIds = stashedTabs
    .map((tab) => tab.runtimeTabId)
    .filter((id): id is number => id !== null);
  if (trackedIds.length > 0) await browser.tabs.remove(trackedIds).catch(() => undefined);
  await syncFocusWindow(windowId);
  await syncFocusBlockRule();
}

export async function stashFocusTab(tabId: number): Promise<void> {
  const tab = await browser.tabs.get(tabId).catch(() => null);
  if (!tab || tab.windowId === undefined) return;
  const state = await getFocusSessions();
  const session = sessionForWindow(state.sessions, tab.windowId);
  if (!session) return;
  const prior = session.tabs.find((entry) => entry.runtimeTabId === tabId);
  const stashed = snapshotTab(tab, prior);
  stashed.runtimeTabId = null;
  stashed.active = false;
  if (session.tabs.length <= 1) {
    const replacement = await browser.tabs.create({ windowId: tab.windowId, active: true });
    session.tabs = [snapshotTab(replacement)];
  } else {
    session.tabs = session.tabs.filter((entry) => entry.runtimeTabId !== tabId);
  }
  session.stashedTabs = [...session.stashedTabs, stashed];
  session.updatedAt = Date.now();
  await persistSession(session);
  await syncFocusBlockRule();
  await browser.tabs.remove(tabId).catch(() => undefined);
}

async function regularWindowTarget(excludingWindowId?: number): Promise<number | null> {
  const [state, windows] = await Promise.all([
    getFocusSessions(),
    browser.windows.getAll(),
  ]);
  const focusedIds = new Set(state.sessions
    .filter((session) => session.status === "active")
    .map((session) => session.runtimeWindowId));
  const candidates = windows.filter((window) =>
    window.id !== undefined && window.id !== excludingWindowId &&
    window.type === "normal" && !window.incognito && !focusedIds.has(window.id)
  );
  if (lastRegularWindowId !== null && candidates.some((window) => window.id === lastRegularWindowId)) {
    return lastRegularWindowId;
  }
  return candidates[0]?.id ?? null;
}

async function restoreTabsOutsideFocus(
  tabs: FocusTabSnapshot[],
  excludingWindowId?: number,
): Promise<void> {
  if (tabs.length === 0) return;
  let target = await regularWindowTarget(excludingWindowId);
  if (target === null) {
    const created = await createWindowFromSnapshots(tabs);
    target = created.id ?? null;
    return;
  }
  for (const tab of tabs) {
    await createTabFromSnapshot(target, tab, false);
  }
}

function restorableUrl(url: string): string | undefined {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith(browser.runtime.getURL(""))) return url;
  return undefined;
}

async function createTabFromSnapshot(
  windowId: number,
  snapshot: FocusTabSnapshot,
  active: boolean,
): Promise<browser.Tabs.Tab> {
  const url = restorableUrl(snapshot.url);
  const tab = await browser.tabs.create({
    windowId,
    active,
    ...(url ? { url } : {}),
  }).catch(() => browser.tabs.create({ windowId, active }));
  if (snapshot.pinned && tab.id !== undefined) {
    await browser.tabs.update(tab.id, { pinned: true }).catch(() => undefined);
  }
  return tab;
}

async function createWindowFromSnapshots(
  snapshots: FocusTabSnapshot[],
): Promise<browser.Windows.Window> {
  const first = snapshots[0];
  const firstUrl = first ? restorableUrl(first.url) : undefined;
  const window = await browser.windows.create(firstUrl ? { url: firstUrl } : {});
  if (window.id === undefined) return window;
  const initialTab = window.tabs?.[0];
  if (first?.pinned && initialTab?.id !== undefined) {
    await browser.tabs.update(initialTab.id, { pinned: true }).catch(() => undefined);
  }
  for (const snapshot of snapshots.slice(1)) {
    await createTabFromSnapshot(window.id, snapshot, false);
  }
  return browser.windows.get(window.id, { populate: true });
}

export async function endFocus(sessionId: string): Promise<void> {
  const state = await getFocusSessions();
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (!session || session.status !== "active" || session.runtimeWindowId === null) return;
  const windowId = session.runtimeWindowId;
  await syncFocusWindow(windowId);
  const refreshed = (await getFocusSessions()).sessions.find((candidate) => candidate.id === sessionId);
  if (!refreshed) return;
  const stashed = refreshed.stashedTabs;
  const next: FocusSession = {
    ...refreshed,
    status: "inactive",
    runtimeWindowId: null,
    tabs: refreshed.tabs.map((tab) => ({ ...tab, runtimeTabId: null })),
    stashedTabs: [],
    closingAction: "ending",
    updatedAt: Date.now(),
  };
  await persistSession(next);
  await syncFocusBlockRule();
  await restoreTabsOutsideFocus(stashed, windowId);
  await browser.windows.remove(windowId).catch(() => undefined);
  const browserSessionId = await recentlyClosedWindowId(next);
  await persistSession({
    ...next,
    browserSessionId,
    closingAction: null,
    updatedAt: Date.now(),
  });
}

export async function resumeFocus(sessionId: string): Promise<void> {
  const state = await getFocusSessions();
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (!session || session.status !== "inactive") return;
  const restored = session.browserSessionId
    ? await browser.sessions.restore(session.browserSessionId).catch(() => null)
    : null;
  const window = restored?.window ??
    await createWindowFromSnapshots(session.tabs);
  if (window.id === undefined || !window.tabs) return;
  const tabs = window.tabs.map((tab, index) => snapshotTab(tab, session.tabs[index]));
  for (const [index, tab] of window.tabs.entries()) {
    const saved = session.tabs[index];
    if (tab.id !== undefined && saved?.pinned) {
      await browser.tabs.update(tab.id, { pinned: true });
    }
  }
  const activeIndex = Math.max(0, session.tabs.findIndex((tab) => tab.active));
  const activeId = window.tabs[activeIndex]?.id;
  if (activeId !== undefined) await browser.tabs.update(activeId, { active: true });
  const next: FocusSession = {
    ...session,
    status: "active",
    runtimeWindowId: window.id,
    browserSessionId: null,
    tabs,
    closingAction: null,
    updatedAt: Date.now(),
  };
  await persistSession(next);
  await attachFirefoxWindowValue(window.id, session.id);
  await syncFocusBlockRule();
}

export async function deleteFocus(sessionId: string): Promise<void> {
  const state = await getFocusSessions();
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (!session) return;
  await setFocusSessions({ sessions: state.sessions.filter((candidate) => candidate.id !== sessionId) });
  await syncFocusBlockRule();
  if (session.status === "active" && session.runtimeWindowId !== null) {
    await browser.windows.remove(session.runtimeWindowId).catch(() => undefined);
  }
}

export async function renameFocus(sessionId: string, name: string | null): Promise<void> {
  const state = await getFocusSessions();
  const cleanName = name?.trim() || null;
  await setFocusSessions({
    sessions: state.sessions.map((session) => session.id === sessionId
      ? { ...session, name: cleanName, updatedAt: Date.now() }
      : session),
  });
}

export async function openFocusTabOutside(sessionId: string, tabId: string): Promise<void> {
  const state = await getFocusSessions();
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  const saved = session?.tabs.find((tab) => tab.id === tabId) ??
    session?.stashedTabs.find((tab) => tab.id === tabId);
  if (!session || !saved) return;
  if (session.status === "active" && saved.runtimeTabId !== null) {
    await browser.windows.update(session.runtimeWindowId!, { focused: true }).catch(() => undefined);
    await browser.tabs.update(saved.runtimeTabId, { active: true }).catch(() => undefined);
    return;
  }
  await restoreTabsOutsideFocus([saved], session.runtimeWindowId ?? undefined);
}

export async function syncFocusWindow(windowId: number): Promise<void> {
  const state = await getFocusSessions();
  const session = sessionForWindow(state.sessions, windowId);
  if (!session || session.closingAction !== null) return;
  const tabs = await browser.tabs.query({ windowId }).catch(() => []);
  const priorByRuntimeId = new Map(session.tabs.map((tab) => [tab.runtimeTabId, tab]));
  const next = tabs.map((tab) => snapshotTab(tab, priorByRuntimeId.get(tab.id ?? null)));
  await persistSession({ ...session, tabs: next, updatedAt: Date.now() });
}

export async function enforceFocusNavigation(
  tabId: number,
  windowId: number,
  url: string,
): Promise<boolean> {
  const host = hostnameOf(url);
  if (!host) return false;
  const [state, settings] = await Promise.all([getFocusSessions(), getSettings()]);
  const session = sessionForWindow(state.sessions, windowId);
  if (!session || !isTracked(host, settings.trackedSites)) return false;
  const saved = session.tabs.find((tab) => tab.runtimeTabId === tabId);
  if (saved?.lastAllowedUrl && saved.lastAllowedUrl !== url) {
    await browser.tabs.update(tabId, { url: saved.lastAllowedUrl }).catch(() => undefined);
  } else {
    await browser.tabs.remove(tabId).catch(() => undefined);
  }
  return true;
}

export async function handleFocusTabRemoved(
  tabId: number,
  removeInfo: browser.Tabs.OnRemovedRemoveInfoType,
): Promise<void> {
  if (removeInfo.isWindowClosing) return;
  const state = await getFocusSessions();
  const session = sessionForWindow(state.sessions, removeInfo.windowId);
  if (!session || session.closingAction !== null) return;
  await persistSession({
    ...session,
    tabs: session.tabs.filter((tab) => tab.runtimeTabId !== tabId),
    updatedAt: Date.now(),
  });
  await syncFocusBlockRule();
}

export async function handleFocusWindowRemoved(windowId: number): Promise<void> {
  const state = await getFocusSessions();
  const session = sessionForWindow(state.sessions, windowId);
  if (!session) return;
  const inactive: FocusSession = {
    ...session,
    status: "inactive",
    runtimeWindowId: null,
    tabs: session.tabs.map((tab) => ({ ...tab, runtimeTabId: null })),
    closingAction: null,
    updatedAt: Date.now(),
  };
  await persistSession(inactive);
  const browserSessionId = await recentlyClosedWindowId(inactive);
  if (browserSessionId) await persistSession({ ...inactive, browserSessionId });
  await syncFocusBlockRule();
}

export async function handleFocusWindowChanged(windowId: number): Promise<void> {
  if (windowId === browser.windows.WINDOW_ID_NONE) return;
  const state = await getFocusSessions();
  if (!sessionForWindow(state.sessions, windowId)) lastRegularWindowId = windowId;
}

function windowFingerprint(tabs: browser.Tabs.Tab[]): string {
  return tabs.map((tab) => tabUrl(tab)).join("\n");
}

function sessionFingerprint(session: FocusSession): string {
  return [...session.tabs].sort((a, b) => a.index - b.index).map((tab) => tab.url).join("\n");
}

export async function reconcileFocusWindows(trustRuntimeIds = false): Promise<void> {
  const [state, windows] = await Promise.all([
    getFocusSessions(),
    browser.windows.getAll({ populate: true }),
  ]);
  const claimed = new Set<number>();
  const nextSessions: FocusSession[] = [];
  for (const session of state.sessions) {
    if (session.status !== "active") {
      nextSessions.push(session);
      continue;
    }
    let matched = trustRuntimeIds
      ? windows.find((window) => window.id === session.runtimeWindowId)
      : undefined;
    if (!matched) {
      const api = sessionsApi();
      if (api.getWindowValue) {
        for (const window of windows) {
          if (window.id === undefined || claimed.has(window.id)) continue;
          const marker = await api.getWindowValue(window.id, WINDOW_SESSION_KEY).catch(() => null);
          if (marker === session.id) {
            matched = window;
            break;
          }
        }
      }
    }
    if (!matched) {
      const candidates = windows.filter((window) =>
        window.id !== undefined && !claimed.has(window.id) && window.tabs &&
        windowFingerprint(window.tabs) === sessionFingerprint(session)
      );
      if (candidates.length === 1) matched = candidates[0];
    }
    if (!matched?.tabs || matched.id === undefined) {
      nextSessions.push({
        ...session,
        status: "inactive",
        runtimeWindowId: null,
        tabs: session.tabs.map((tab) => ({ ...tab, runtimeTabId: null })),
        closingAction: null,
      });
      continue;
    }
    claimed.add(matched.id);
    nextSessions.push({
      ...session,
      runtimeWindowId: matched.id,
      tabs: matched.tabs.map((tab, index) => snapshotTab(tab, session.tabs[index])),
      closingAction: null,
    });
    await attachFirefoxWindowValue(matched.id, session.id);
  }
  await setFocusSessions({ sessions: nextSessions });
  await syncFocusBlockRule();
}

async function recentlyClosedWindowId(session: FocusSession): Promise<string | null> {
  const recent = await browser.sessions.getRecentlyClosed({ maxResults: 5 }).catch(() => []);
  const fingerprint = sessionFingerprint(session);
  const match = recent.find((entry) =>
    entry.window?.tabs && windowFingerprint(entry.window.tabs) === fingerprint
  );
  return match?.window?.sessionId ?? null;
}

export async function stashTrackedFocusTabs(): Promise<void> {
  const [state, settings] = await Promise.all([getFocusSessions(), getSettings()]);
  for (const session of state.sessions) {
    if (session.status !== "active") continue;
    for (const tab of [...session.tabs]) {
      const host = hostnameOf(tab.url);
      if (host !== null && isTracked(host, settings.trackedSites) && tab.runtimeTabId !== null) {
        await stashFocusTab(tab.runtimeTabId);
      }
    }
  }
}

export async function isFocusWindow(windowId: number | undefined): Promise<boolean> {
  if (windowId === undefined) return false;
  const state = await getFocusSessions();
  return sessionForWindow(state.sessions, windowId) !== undefined;
}
