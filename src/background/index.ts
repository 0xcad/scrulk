import browser from "webextension-polyfill";
import {
  getDayState,
  getSettings,
  onDayStateChange,
  onSettingsChange,
  setDayState,
  setSettings,
} from "../shared/storage";
import { refreshAllTabIcons, setMissedBadge, updateIconForTab } from "./icon";
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
  openSurveyTab,
} from "./breaktime";
import { enforceTabLimit } from "./tabLimit";
import { dateKey, upsertDay } from "../shared/history";
import type { Message } from "../shared/messages";
import { effectiveMs } from "../shared/types";
import { currentWakeDayStart } from "../shared/wakeDay";

// MV3 service worker: ephemeral. No long-lived module-level state.
// All listeners must be registered synchronously at top level so the worker
// can be revived to handle events.

browser.runtime.onInstalled.addListener(async () => {
  const current = await getSettings();
  if (!current.installedAt) {
    await setSettings({ installedAt: Date.now() });
  }
  await refreshAllTabIcons(current.trackedSites);
  await ensureDayResetAlarm(current.wakeUpTime);
  await syncMissedBadge();
  await recompute();
});

browser.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  await refreshAllTabIcons(settings.trackedSites);
  await ensureDayResetAlarm(settings.wakeUpTime);
  await syncMissedBadge();
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
  if (changeInfo.url) {
    // A tab just navigated to a (possibly) tracked URL — only moment a fresh
    // tracked tab can push us over the limit.
    await enforceTabLimit(tabId, changeInfo.url);
  }
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

browser.runtime.onMessage.addListener((message: unknown, sender: browser.Runtime.MessageSender) => {
  const msg = message as Message;
  if (msg.type === "breaktime:resume") {
    return handleBreaktimeResume().then(() => recompute());
  }
  if (msg.type === "breaktime:done") {
    return handleBreaktimeDone().then(() => recompute());
  }
  if (msg.type === "survey:submit") {
    return handleSurveySubmit(msg, sender?.tab?.id);
  }
  if (msg.type === "survey:open") {
    return handleSurveyOpen(msg);
  }
  if (msg.type === "survey:redirect") {
    return handleSurveyRedirect(msg, sender?.tab?.id);
  }
  if (msg.type === "survey:continue") {
    return handleSurveyContinue(sender?.tab?.id);
  }
  if (msg.type === "missed:dismiss") {
    return handleMissedDismiss();
  }
  return undefined;
});

async function handleSurveySubmit(
  msg: Extract<Message, { type: "survey:submit" }>,
  senderTabId: number | undefined,
): Promise<void> {
  const settings = await getSettings();
  const state = await getDayState();
  const currentDate = dateKey(currentWakeDayStart(Date.now(), settings.wakeUpTime));
  const totalMs =
    msg.date === currentDate ? effectiveMs(state, Date.now()) : undefined;
  await upsertDay(msg.date, {
    regret: msg.regret,
    notes: msg.notes,
    ...(totalMs !== undefined ? { totalMs } : {}),
  });
  const patch: Partial<typeof state> = {};
  if (msg.date === currentDate) {
    patch.surveyFilledFor = msg.date;
    // Re-editing the survey kicks off the redirect chain again until the
    // user explicitly clicks "Continue" on the survey page.
    patch.surveyContinueAllowed = false;
  }
  if (state.missedSurveyDate === msg.date) patch.missedSurveyDate = null;
  if (Object.keys(patch).length > 0) {
    await setDayState({ ...state, ...patch });
  }
  if (senderTabId !== undefined) {
    await browser.tabs.remove(senderTabId).catch(() => null);
  }
}

async function handleSurveyOpen(
  msg: Extract<Message, { type: "survey:open" }>,
): Promise<void> {
  await openSurveyTab(msg.date);
}

async function handleSurveyRedirect(
  msg: Extract<Message, { type: "survey:redirect" }>,
  senderTabId: number | undefined,
): Promise<void> {
  await openSurveyTab(msg.date);
  if (senderTabId !== undefined) {
    await browser.tabs.remove(senderTabId).catch(() => null);
  }
}

async function handleSurveyContinue(
  senderTabId: number | undefined,
): Promise<void> {
  const state = await getDayState();
  if (!state.surveyContinueAllowed) {
    await setDayState({ ...state, surveyContinueAllowed: true });
  }
  if (senderTabId !== undefined) {
    await browser.tabs.remove(senderTabId).catch(() => null);
  }
}

async function syncMissedBadge(): Promise<void> {
  const state = await getDayState();
  await setMissedBadge(state.missedSurveyDate !== null);
}

async function handleMissedDismiss(): Promise<void> {
  const state = await getDayState();
  if (state.missedSurveyDate === null) return;
  await setDayState({ ...state, missedSurveyDate: null });
}

onSettingsChange(async (next) => {
  await refreshAllTabIcons(next.trackedSites);
  await ensureDayResetAlarm(next.wakeUpTime);
  await recompute();
});

onDayStateChange((state) => {
  void setMissedBadge(state.missedSurveyDate !== null);
});
