import browser from "webextension-polyfill";
import { getSettings, onSettingsChange, setSettings } from "../shared/storage";
import { refreshAllTabIcons, updateIconForTab } from "./icon";
import {
  ALARM_NAMES,
  ensureDayResetAlarm,
  handleDayResetAlarm,
  recompute,
} from "./tracker";
import {
  BREAKTIME_ALARM,
  handleBreaktimeDone,
  handleBreaktimeResume,
} from "./breaktime";
import type { Message } from "../shared/messages";

// MV3 service worker: ephemeral. No long-lived module-level state.
// All listeners must be registered synchronously at top level so the worker
// can be revived to handle events.

browser.runtime.onInstalled.addListener(async () => {
  const current = await getSettings();
  if (!current.installedAt) {
    await setSettings({ installedAt: Date.now() });
  }
  await refreshAllTabIcons(current.trackedSites);
  await ensureDayResetAlarm(current.wakeUpHour);
  await recompute();
});

browser.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  await refreshAllTabIcons(settings.trackedSites);
  await ensureDayResetAlarm(settings.wakeUpHour);
  await recompute();
});

browser.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await browser.tabs.get(tabId).catch(() => null);
  if (tab) {
    const { trackedSites } = await getSettings();
    await updateIconForTab(tabId, tab.url, trackedSites);
  }
  await recompute();
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "loading") return;
  const { trackedSites } = await getSettings();
  await updateIconForTab(tabId, tab.url, trackedSites);
  if (changeInfo.url || changeInfo.status === "complete") {
    await recompute();
  }
});

browser.windows.onFocusChanged.addListener(async () => {
  await recompute();
});

// 60s idle threshold matches the user spec ("AFK with focused tab shouldn't
// count as usage"). Set once per service-worker lifecycle.
browser.idle.setDetectionInterval(60);
browser.idle.onStateChanged.addListener(async () => {
  await recompute();
});

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAMES.DAY_RESET) {
    await handleDayResetAlarm();
    await recompute();
  } else if (alarm.name === BREAKTIME_ALARM) {
    // recompute() will detect we've passed the threshold and flip
    // breaktimeOpen, which content scripts on tracked tabs pick up.
    await recompute();
  }
});

browser.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as Message;
  if (msg.type === "breaktime:resume") {
    return handleBreaktimeResume().then(() => recompute());
  }
  if (msg.type === "breaktime:done") {
    return handleBreaktimeDone().then(() => recompute());
  }
  return undefined;
});

onSettingsChange(async (next) => {
  await refreshAllTabIcons(next.trackedSites);
  await ensureDayResetAlarm(next.wakeUpHour);
  await recompute();
});
