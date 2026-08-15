import browser from "webextension-polyfill";
import { hostnameOf, isTracked } from "../../../shared/domain";
import { dateKey, upsertDay } from "../../../shared/history";
import {
  getDayState,
  getSettings,
  setDayState,
  setSettings,
} from "../../../shared/storage";
import { isAccessPageUrl } from "../../access-flow/background/gateway";
import {
  currentWakeDayStart,
  nextWakeUpAt,
} from "../../../shared/wakeDay";
import {
  effectiveAllSitesMs,
  effectiveMs,
  effectiveWaitingMs,
  isUsageStreakDay,
  remainingAllowanceMs,
  DEFAULT_DAY_STATE,
  type DayState,
} from "../../../shared/dayState";
import { scheduleBreaktimeAlarm } from "../../access-flow/background/breaktime";
import { ALARM_NAMES } from "../../../background/alarms";
import { reduceAccessFlow } from "../../access-flow/transitions";
import {
  ACTIVITY_CHECK_INTERVAL_MS,
  checkpointOpenActivity,
  reconcileStaleActivity,
} from "./activityCheckpoint";
import {
  applyAllSitesTransition,
  applyTrackedTransition,
  applyWaitingTransition,
  checkpointWaiting,
  dayStateEqual,
  reconcileStaleWaiting,
} from "./segments";

/**
 * The tracker is *event-driven*. We never tick a counter. Instead we
 * maintain `dayState.activeSince`: the moment the user became active on a
 * tracked page. Any state change closes the open segment (totalMs += elapsed)
 * and may open a new one. The displayed time is computed live as
 * totalMs + (now - activeSince).
 *
 * The recompute() function below is the single decision point. It is called
 * from every relevant event listener and is idempotent.
 */

type ActivityInputs = {
  windowFocused: boolean;
  activeTabUrl: string | undefined;
  idleState: chrome.idle.IdleState;
  trackedSites: string[];
};

async function readActivity(): Promise<ActivityInputs> {
  const [settings, focusedWindow] = await Promise.all([
    getSettings(),
    browser.windows
      .getLastFocused({ populate: true })
      .catch(() => null),
  ]);

  let activeTabUrl: string | undefined;
  let windowFocused = false;
  if (focusedWindow && focusedWindow.focused && focusedWindow.tabs) {
    windowFocused = true;
    const active = focusedWindow.tabs.find((t) => t.active);
    activeTabUrl = active?.url;
  }

  // queryState requires an interval; 60s matches the user spec.
  const idleState = await browser.idle.queryState(60).catch(
    () => "active" as chrome.idle.IdleState,
  );

  return {
    windowFocused,
    activeTabUrl,
    idleState,
    trackedSites: settings.trackedSites,
  };
}

function shouldBeActive(inputs: ActivityInputs): boolean {
  if (!inputs.windowFocused) return false;
  if (inputs.idleState !== "active") return false;
  const host = hostnameOf(inputs.activeTabUrl);
  if (!host) return false;
  return isTracked(host, inputs.trackedSites);
}

function shouldTrackAllSites(inputs: ActivityInputs): boolean {
  if (!inputs.windowFocused || inputs.idleState !== "active") return false;
  return hostnameOf(inputs.activeTabUrl) !== null;
}

export async function recompute(): Promise<void> {
  const settings = await getSettings();
  const now = Date.now();
  const expectedStart = currentWakeDayStart(now, settings.wakeUpTime);
  const storedState = await getDayState();
  // Reconcile a missed liveness checkpoint before rollover. Otherwise an
  // open segment spanning sleep and a wake-day boundary would be finalized
  // at the boundary and still count suspended time.
  let state = reconcileStaleActivity(storedState, now);
  state = reconcileStaleWaiting(state, now);

  // If we somehow missed an alarm-driven reset (browser was off across the
  // boundary), do it lazily here.
  if (state.wakeDayStart !== expectedStart) {
    state = await rolloverDay(state, expectedStart);
  }

  const inputs = await readActivity();
  const waitingActive =
    state.accessFlowPhase === "waiting" &&
    state.waitingPageFocused &&
    inputs.windowFocused &&
    isAccessPageUrl(inputs.activeTabUrl);
  state = applyWaitingTransition(state, waitingActive, now);
  if (
    state.accessFlowPhase === "waiting" &&
    effectiveWaitingMs(state, now) >= settings.waitingMinutes * 60_000
  ) {
    state = applyWaitingTransition(state, false, now);
    state = reduceAccessFlow(state, { type: "waitingElapsed" });
  }

  const flowAllowsTracking = state.accessFlowPhase === "browsing";
  const wantActive = flowAllowsTracking && shouldBeActive(inputs);
  const allSitesPaused =
    state.accessFlowPhase === "break" ||
    state.accessFlowPhase === "challenge" ||
    state.accessFlowPhase === "resumePrompt" ||
    state.accessFlowPhase === "popupLocked";
  const wantAllSitesActive = !allSitesPaused && shouldTrackAllSites(inputs);
  let next = applyTrackedTransition(state, wantActive, now);
  next = applyAllSitesTransition(next, wantAllSitesActive, now);

  // If we've crossed the breaktime threshold while active and no alert is
  // currently open, raise it. Content scripts on tracked tabs pick this up
  // via storage.onChanged and mount the overlay.
  if (
    next.accessFlowPhase === "browsing" &&
    next.breaktimeExtensionExpiresAt === null &&
    next.allowanceMs !== null &&
    next.activeSince !== null &&
    remainingAllowanceMs(next, now) <= 0
  ) {
    // Raising the alert pauses tracking — close the open segment now so the
    // clock stops the moment the alert appears, even if the user stays on
    // the page (no focus/idle event would otherwise fire to recompute).
    next = applyTrackedTransition(next, false, now);
    next = applyAllSitesTransition(next, false, now);
    next = reduceAccessFlow(next, { type: "allowanceExpired", openedAt: now });
  }

  next = checkpointOpenActivity(next, now);
  next = checkpointWaiting(next, now);

  if (!dayStateEqual(storedState, next)) {
    await setDayState(next);
  }
  await ensureDayResetAlarm(settings.wakeUpTime);
  await syncActivityCheckAlarm(next);
  await syncWaitingAlarm(next, settings.waitingMinutes);
  await scheduleBreaktimeAlarm(next);
}

/** Discard the current debug state without archiving it or changing streaks. */
export async function resetDayStateForDebug(): Promise<void> {
  const settings = await getSettings();
  await setDayState({
    ...DEFAULT_DAY_STATE,
    wakeDayStart: currentWakeDayStart(Date.now(), settings.wakeUpTime),
  });
  await recompute();
}

async function syncActivityCheckAlarm(state: DayState): Promise<void> {
  const hasOpenSegment =
    state.activeSince !== null ||
    state.allSitesActiveSince !== null ||
    state.waitingActiveSince !== null;
  const existing = await browser.alarms
    .get(ALARM_NAMES.activityCheck)
    .catch(() => null);

  if (!hasOpenSegment) {
    if (existing) {
      await browser.alarms.clear(ALARM_NAMES.activityCheck).catch(() => false);
    }
    return;
  }

  const when =
    (state.activityCheckpointAt ?? Date.now()) + ACTIVITY_CHECK_INTERVAL_MS;
  if (existing && Math.abs(existing.scheduledTime - when) < 1000) return;
  await browser.alarms.create(ALARM_NAMES.activityCheck, { when });
}

async function syncWaitingAlarm(state: DayState, waitingMinutes: number): Promise<void> {
  if (state.accessFlowPhase !== "waiting" || state.waitingActiveSince === null) {
    await browser.alarms.clear(ALARM_NAMES.waiting).catch(() => null);
    return;
  }
  const remaining = waitingMinutes * 60_000 - effectiveWaitingMs(state, Date.now());
  if (remaining <= 0) return;
  const when = Date.now() + remaining;
  const existing = await browser.alarms.get(ALARM_NAMES.waiting).catch(() => null);
  if (existing && Math.abs(existing.scheduledTime - when) < 1000) return;
  await browser.alarms.create(ALARM_NAMES.waiting, { when });
}

/**
 * Compute the next-day state from an outgoing day. Open segments are closed
 * at the wake-day boundary, not at a delayed alarm/resume time, so suspended
 * time cannot be counted as usage.
 */
export async function rolloverDay(
  outgoing: DayState,
  newWakeDayStart: number,
): Promise<DayState> {
  const finalTotalMs = effectiveMs(outgoing, newWakeDayStart);
  const finalAllSitesMs = effectiveAllSitesMs(outgoing, newWakeDayStart);
  const outgoingDate = dateKey(outgoing.wakeDayStart);

  const settings = await getSettings();
  const usageStreak = isUsageStreakDay(outgoing, newWakeDayStart)
    ? settings.usageStreak + 1
    : 0;
  await setSettings({ usageStreak });

  if (outgoing.wakeDayStart > 0 && (finalTotalMs > 0 || finalAllSitesMs > 0)) {
    await upsertDay(outgoingDate, {
      totalMs: finalTotalMs,
      allSitesMs: finalAllSitesMs,
    }).catch(() => null);
  }

  return {
    wakeDayStart: newWakeDayStart,
    totalMs: 0,
    activeSince: null,
    allSitesMs: 0,
    allSitesActiveSince: null,
    activityCheckpointAt: null,
    accessFlowPhase: "waiting",
    waitingMs: 0,
    waitingActiveSince: null,
    waitingCheckpointAt: null,
    waitingPageFocused: false,
    allowanceMs: null,
    allowanceStartTotalMs: null,
    breakOpenedAt: null,
    breaktimeExtensionExpiresAt: null,
    breaktimeExtensionUsed: false,
    breaktimeExtensionTabs: {},
    tabLimitWarning: false,
    surveyFilledFor: null,
    breaktimeShownToday: false,
    breaktimeChallengeCompletedToday: false,
    popupDoneToday: false,
    surveyContinueAllowed: false,
  };
}

export async function ensureDayResetAlarm(wakeUpTime: string): Promise<void> {
  const when = nextWakeUpAt(Date.now(), wakeUpTime);
  const existing = await browser.alarms.get(ALARM_NAMES.dayReset).catch(() => null);
  if (existing && Math.abs(existing.scheduledTime - when) < 1000) return;
  await browser.alarms.create(ALARM_NAMES.dayReset, { when });
}

export async function handleDayResetAlarm(): Promise<void> {
  const settings = await getSettings();
  const now = Date.now();
  // Missed alarms can be delivered in any order after device wake. Reconcile
  // here as well as in recompute() so a delayed day-reset alarm cannot archive
  // suspended time before the activity-check alarm gets a chance to run.
  const state = reconcileStaleActivity(await getDayState(), now);
  const next = await rolloverDay(
    state,
    currentWakeDayStart(now, settings.wakeUpTime),
  );
  await setDayState(next);
  await ensureDayResetAlarm(settings.wakeUpTime);
}
