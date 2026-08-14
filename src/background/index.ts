import browser from "webextension-polyfill";
import {
  getDayState,
  getSettings,
  onDayStateChange,
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
  BREAKTIME_EXTENSION_ALARM,
  endBreaktimeExtension,
  enforceExtensionNavigation,
  handleBreaktimeExtend,
  handleBreaktimeDone,
  handleBreaktimeContinue,
  handleChallengeComplete,
  handleChooseAllowance,
  handleExtensionTabRemoved,
  handlePopupDone,
  handleResumePrompt,
  handleWaitContinue,
  handleWaitingFocus,
} from "./breaktime";
import { enforceTabLimit } from "./tabLimit";
import { dateKey, upsertDay } from "../shared/history";
import type { Message } from "../shared/messages";
import { effectiveAllSitesMs, effectiveMs } from "../shared/types";
import { currentWakeDayStart } from "../shared/wakeDay";
import {
  ensureAccessPage,
  handleBeforeNavigate,
  syncTrackedTabPresence,
} from "./gateway";
import {
  closeCameraHub,
  ensureCameraHub,
  ensureCameraHubForOverlay,
  syncCameraHubForActiveTab,
} from "./camera";
import { syncPeekFrameRule } from "./peek";

// MV3 service worker: ephemeral. No long-lived module-level state.
// All listeners must be registered synchronously at top level so the worker
// can be revived to handle events.

browser.runtime.onInstalled.addListener(async ({ reason }) => {
  const current = await getSettings();
  if (reason === "install") {
    await setSettings({ installedAt: Date.now() });
  }
  if (current.firstInstalledAt === 0) {
    await setSettings({ firstInstalledAt: Date.now() });
  }
  await refreshAllTabIcons(current.trackedSites);
  await syncPeekFrameRule(current);
  await ensureDayResetAlarm(current.wakeUpTime);
  await recompute();
  await syncTrackedTabPresence();
  await recompute();
  await syncCameraHubForActiveTab();
});

browser.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  await refreshAllTabIcons(settings.trackedSites);
  await syncPeekFrameRule(settings);
  await ensureDayResetAlarm(settings.wakeUpTime);
  await recompute();
  await syncTrackedTabPresence();
  await recompute();
  await syncCameraHubForActiveTab();
});

browser.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await browser.tabs.get(tabId).catch(() => null);
  if (tab) {
    const { trackedSites } = await getSettings();
    await updateIconForTab(tabId, tab.url, trackedSites);
  }
  await recompute();
  await syncCameraHubForActiveTab();
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "loading") return;
  const { trackedSites } = await getSettings();
  await updateIconForTab(tabId, tab.url, trackedSites);
  if (changeInfo.url) {
    if (await enforceExtensionNavigation(tabId, changeInfo.url)) {
      await syncTrackedTabPresence();
      await recompute();
      await syncCameraHubForActiveTab();
      return;
    }
    // A tab just navigated to a (possibly) tracked URL — only moment a fresh
    // tracked tab can push us over the limit.
    await enforceTabLimit(tabId, changeInfo.url);
    await syncTrackedTabPresence();
  }
  if (changeInfo.url || changeInfo.status === "complete") {
    await recompute();
  }
  await syncCameraHubForActiveTab();
});

browser.tabs.onRemoved.addListener(async (tabId) => {
  await handleExtensionTabRemoved(tabId);
  await syncTrackedTabPresence();
  await recompute();
  await syncCameraHubForActiveTab();
});

browser.webNavigation.onBeforeNavigate.addListener((details) => {
  void handleBeforeNavigate(details);
});

browser.windows.onFocusChanged.addListener(async () => {
  await recompute();
  await syncCameraHubForActiveTab();
});

// 60s idle threshold matches the user spec ("AFK with focused tab shouldn't
// count as usage"). Set once per service-worker lifecycle.
browser.idle.setDetectionInterval(60);
browser.idle.onStateChanged.addListener(async () => {
  await recompute();
});

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAMES.ACTIVITY_CHECK) {
    await recompute();
    return;
  }
  if (alarm.name === ALARM_NAMES.DAY_RESET) {
    await handleDayResetAlarm();
    await recompute();
    return;
  }
  if (alarm.name === ALARM_NAMES.WAITING) {
    await recompute();
    return;
  }
  if (alarm.name === BREAKTIME_ALARM) {
    // recompute() detects the exhausted allowance and opens the global break.
    await recompute();
    return;
  }
  if (alarm.name === BREAKTIME_EXTENSION_ALARM) {
    await endBreaktimeExtension();
    await recompute();
    return;
  }
});

browser.runtime.onMessage.addListener((message: unknown, sender: browser.Runtime.MessageSender) => {
  const msg = message as Message;
  if (msg.type === "access:waitContinue") {
    return handleWaitContinue().then(() => recompute());
  }
  if (msg.type === "access:setWaitingFocus") {
    return handleWaitingFocus(msg.focused).then(() => recompute());
  }
  if (msg.type === "access:chooseAllowance") {
    return handleChooseAllowance(
      msg.minutes,
      msg.destUrl,
      sender?.tab?.id,
    ).then(() => recompute());
  }
  if (msg.type === "access:resumeAllowance") {
    return handleResumePrompt().then(() => recompute());
  }
  if (msg.type === "access:startChallenge") {
    return handleBreaktimeContinue(sender.tab).then(() => recompute());
  }
  if (msg.type === "access:challengeComplete") {
    return handleChallengeComplete().then(() => recompute());
  }
  if (msg.type === "breaktime:extend") {
    return handleBreaktimeExtend().then(() => recompute());
  }
  if (msg.type === "breaktime:done") {
    return handleBreaktimeDone().then(() => recompute());
  }
  if (msg.type === "popup:done") {
    return handlePopupDone().then(() => recompute());
  }
  if (msg.type === "survey:submit") {
    return handleSurveySubmit(msg, sender?.tab?.id);
  }
  if (msg.type === "survey:continue") {
    return handleSurveyContinue(sender?.tab?.id).then(() => recompute());
  }
  if (msg.type === "camera:enable") {
    return ensureCameraHub(true, sender.tab);
  }
  if (msg.type === "camera:ensure") {
    return ensureCameraHubForOverlay(sender.tab);
  }
  if (msg.type === "camera:disable") {
    return closeCameraHub();
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
  const allSitesMs =
    msg.date === currentDate ? effectiveAllSitesMs(state, Date.now()) : undefined;
  await upsertDay(msg.date, {
    notes: msg.notes,
    ...(totalMs !== undefined ? { totalMs } : {}),
    ...(allSitesMs !== undefined ? { allSitesMs } : {}),
  });
  const patch: Partial<typeof state> = {};
  if (msg.date === currentDate) {
    patch.surveyFilledFor = msg.date;
  }
  if (Object.keys(patch).length > 0) {
    await setDayState({ ...state, ...patch });
  }
  if (senderTabId !== undefined) {
    await browser.tabs.remove(senderTabId).catch(() => null);
  }
}

async function handleSurveyContinue(
  senderTabId: number | undefined,
): Promise<void> {
  const state = await getDayState();
  if (!state.popupDoneToday || state.surveyContinueAllowed) return;
  await setDayState({
    ...state,
    surveyContinueAllowed: true,
    accessFlowPhase: "picking",
  });
  if (senderTabId !== undefined) {
    const senderTab = await browser.tabs.get(senderTabId).catch(() => undefined);
    await ensureAccessPage(senderTab);
    await browser.tabs.remove(senderTabId).catch(() => null);
  }
}

onSettingsChange(async (next) => {
  if (!next.cameraOverlayEnabled) {
    await closeCameraHub();
  }
  await refreshAllTabIcons(next.trackedSites);
  await syncPeekFrameRule(next);
  await ensureDayResetAlarm(next.wakeUpTime);
  await recompute();
  await syncTrackedTabPresence();
  await recompute();
  await syncCameraHubForActiveTab();
});

onDayStateChange(() => {
  void syncCameraHubForActiveTab();
});
