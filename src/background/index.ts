import browser from "webextension-polyfill";
import {
  getSettings,
  onDayStateChange,
  onSettingsChange,
  setSettings,
} from "../shared/storage";
import { refreshAllTabIcons, updateIconForTab } from "./icon";
import {
  ensureDayResetAlarm,
  handleDayResetAlarm,
  recompute,
} from "../features/tracking/background/tracker";
import {
  endBreaktimeExtension,
  enforceExtensionNavigation,
  handleExtensionTabRemoved,
} from "../features/access-flow/background/breaktime";
import { enforceTabLimit } from "../features/access-flow/background/tabLimit";
import {
  handleBeforeNavigate,
  syncTrackedTabPresence,
} from "../features/access-flow/background/gateway";
import {
  closeCameraHub,
  syncCameraHubForActiveTab,
} from "../features/camera/background";
import { syncPeekFrameRule } from "../features/peek/background";
import { ALARM_NAMES, isAlarmName, type AlarmName } from "./alarms";
import { dispatchCommand } from "./commandHandlers";
import { runBackgroundTask } from "./taskQueue";

// MV3 service worker: ephemeral. Durable behavior cannot rely on module state.
// All listeners must be registered synchronously at top level so the worker
// can be revived to handle events.

browser.runtime.onInstalled.addListener(({ reason }) =>
  runBackgroundTask(async () => {
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
  })
);

browser.runtime.onStartup.addListener(() =>
  runBackgroundTask(async () => {
    const settings = await getSettings();
    await refreshAllTabIcons(settings.trackedSites);
    await syncPeekFrameRule(settings);
    await ensureDayResetAlarm(settings.wakeUpTime);
    await recompute();
    await syncTrackedTabPresence();
    await recompute();
    await syncCameraHubForActiveTab();
  })
);

browser.tabs.onActivated.addListener(({ tabId }) =>
  runBackgroundTask(async () => {
    const tab = await browser.tabs.get(tabId).catch(() => null);
    if (tab) {
      const { trackedSites } = await getSettings();
      await updateIconForTab(tabId, tab.url, trackedSites);
    }
    await recompute();
    await syncCameraHubForActiveTab();
  })
);

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) =>
  runBackgroundTask(async () => {
    if (!changeInfo.url && changeInfo.status !== "loading") return;
    const { trackedSites } = await getSettings();
    await updateIconForTab(tabId, tab.url, trackedSites);
    if (changeInfo.url) {
      if (await enforceExtensionNavigation(tabId, changeInfo.url)) {
        await recompute();
        await syncTrackedTabPresence();
        await recompute();
        await syncCameraHubForActiveTab();
        return;
      }
      // A tab just navigated to a (possibly) tracked URL — only moment a fresh
      // tracked tab can push us over the limit.
      await enforceTabLimit(tabId, changeInfo.url);
      await recompute();
      await syncTrackedTabPresence();
      await recompute();
    } else if (changeInfo.status === "complete") {
      await recompute();
    }
    await syncCameraHubForActiveTab();
  })
);

browser.tabs.onRemoved.addListener((tabId) =>
  runBackgroundTask(async () => {
    await handleExtensionTabRemoved(tabId);
    await recompute();
    await syncTrackedTabPresence(tabId);
    await recompute();
    await syncCameraHubForActiveTab();
  })
);

browser.webNavigation.onBeforeNavigate.addListener((details) => {
  void runBackgroundTask(() => handleBeforeNavigate(details));
});

browser.windows.onFocusChanged.addListener(() =>
  runBackgroundTask(async () => {
    await recompute();
    await syncCameraHubForActiveTab();
  })
);

// 60s idle threshold matches the user spec ("AFK with focused tab shouldn't
// count as usage"). Set once per service-worker lifecycle.
browser.idle.setDetectionInterval(60);
browser.idle.onStateChanged.addListener(() => runBackgroundTask(recompute));

const ALARM_HANDLERS = {
  [ALARM_NAMES.activityCheck]: recompute,
  [ALARM_NAMES.allowance]: recompute,
  [ALARM_NAMES.breaktimeExtension]: async () => {
    await endBreaktimeExtension();
    await recompute();
  },
  [ALARM_NAMES.dayReset]: async () => {
    await handleDayResetAlarm();
    await recompute();
  },
  [ALARM_NAMES.waiting]: recompute,
} satisfies Record<AlarmName, () => Promise<void>>;

browser.alarms.onAlarm.addListener((alarm) => {
  if (isAlarmName(alarm.name)) {
    return runBackgroundTask(ALARM_HANDLERS[alarm.name]);
  }
});

browser.runtime.onMessage.addListener((
  message: unknown,
  sender: browser.Runtime.MessageSender,
) =>
  runBackgroundTask(() => dispatchCommand(message, sender))
);

onSettingsChange((next) => {
  void runBackgroundTask(async () => {
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
});

onDayStateChange(() => {
  void runBackgroundTask(syncCameraHubForActiveTab);
});
