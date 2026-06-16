import browser from "webextension-polyfill";
import {
  getDayState,
  getSettings,
  onSettingsChange,
  setDayState,
  setSettings,
} from "../shared/storage";
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
  openSurveyTab,
} from "./breaktime";
import { enforceTabLimit } from "./tabLimit";
import { dateKey, upsertDay } from "../shared/history";
import type { Message } from "../shared/messages";
import { effectiveMs } from "../shared/types";
import { currentWakeDayStart } from "../shared/wakeDay";
import {
  forgetTab,
  handleBeforeNavigate,
  handleCommitted,
  handleImDone,
  handleSetContinue,
  maybeHandleAlarm as maybeHandleGatewayAlarm,
  startTimer as startGatewayTimer,
  navigateTabBack,
  syncDomainTabPresence,
} from "./gateway";
import { onGatewayStateChange } from "../shared/storage";

// MV3 service worker: ephemeral. No long-lived module-level state.
// All listeners must be registered synchronously at top level so the worker
// can be revived to handle events.

browser.runtime.onInstalled.addListener(async ({ reason }) => {
  const current = await getSettings();
  if (reason === "install") {
    await setSettings({ installedAt: Date.now() });
  }
  await refreshAllTabIcons(current.trackedSites);
  await ensureDayResetAlarm(current.wakeUpTime);
  await recompute();
});

browser.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  await refreshAllTabIcons(settings.trackedSites);
  await ensureDayResetAlarm(settings.wakeUpTime);
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
    // The set of tabs-on-each-tracked-domain may have changed; refresh
    // gateway state so domains with zero remaining tabs get cleared.
    await syncDomainTabPresence();
  }
  if (changeInfo.url || changeInfo.status === "complete") {
    await recompute();
  }
});

browser.tabs.onRemoved.addListener(async (tabId) => {
  await forgetTab(tabId);
  await syncDomainTabPresence();
  await recompute();
});

browser.webNavigation.onBeforeNavigate.addListener((details) => {
  void handleBeforeNavigate(details);
});

browser.webNavigation.onCommitted.addListener((details) => {
  void handleCommitted(details);
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
    return;
  }
  if (alarm.name === BREAKTIME_ALARM) {
    // recompute() will detect we've passed the threshold and flip
    // breaktimeOpen, which content scripts on tracked tabs pick up.
    await recompute();
    return;
  }
  if (await maybeHandleGatewayAlarm(alarm.name)) {
    await recompute();
    return;
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
  if (msg.type === "gateway:startTimer") {
    return startGatewayTimer(
      msg.domain,
      msg.minutes,
      msg.destUrl,
      sender?.tab?.id,
    ).then(() => recompute());
  }
  if (msg.type === "gateway:goBack") {
    const tabId = sender?.tab?.id;
    if (tabId !== undefined) return navigateTabBack(tabId);
    return undefined;
  }
  if (msg.type === "gateway:imDone") {
    return handleImDone(msg.domain).then(() => recompute());
  }
  if (msg.type === "gateway:setContinue") {
    return handleSetContinue(msg.domain).then(() => recompute());
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

onSettingsChange(async (next) => {
  await refreshAllTabIcons(next.trackedSites);
  await ensureDayResetAlarm(next.wakeUpTime);
  await recompute();
});

// Propagate gateway-state changes into the tracker so dayState.gatewayOpen
// mirrors the "expired alert active" flag.
onGatewayStateChange(() => {
  void recompute();
});
