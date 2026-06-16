import browser from "webextension-polyfill";
import { hostnameOf, isTracked } from "../shared/domain";
import { dateKey, upsertDay } from "../shared/history";
import {
  getDayState,
  getGatewayState,
  getSettings,
  setDayState,
  setSettings,
} from "../shared/storage";
import { anyExpiredAlertActive } from "./gateway";
import {
  currentWakeDayStart,
  nextWakeUpAt,
} from "../shared/wakeDay";
import { effectiveMs, STREAK_THRESHOLD_MS, type DayState } from "../shared/types";
import { scheduleBreaktimeAlarm } from "./breaktime";

const DAY_RESET_ALARM = "scrulk:day-reset";
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

export async function recompute(): Promise<void> {
  const settings = await getSettings();
  const now = Date.now();
  const expectedStart = currentWakeDayStart(now, settings.wakeUpTime);
  let state = await getDayState();

  // If we somehow missed an alarm-driven reset (browser was off across the
  // boundary), do it lazily here.
  if (state.wakeDayStart !== expectedStart) {
    state = await rolloverDay(state, expectedStart);
  }

  const inputs = await readActivity();
  // Mirror gateway state into dayState.gatewayOpen so the tracker pauses
  // while any expired-alert overlay is mounted on a tracked tab.
  const gatewayPaused = anyExpiredAlertActive(await getGatewayState());
  if (state.gatewayOpen !== gatewayPaused) {
    state = applyTransition(state, false, now);
    state = { ...state, gatewayOpen: gatewayPaused };
  }
  // Tracking pauses while a break alert is open: the user shouldn't accrue
  // time on the modal itself, and re-entry after "I'm done" should land on
  // a paused clock.
  const wantActive =
    !state.breaktimeOpen && !state.gatewayOpen && shouldBeActive(inputs);
  let next = applyTransition(state, wantActive, now);

  // If we've crossed the breaktime threshold while active and no alert is
  // currently open, raise it. Content scripts on tracked tabs pick this up
  // via storage.onChanged and mount the overlay.
  if (
    !next.breaktimeOpen &&
    next.activeSince !== null &&
    effectiveMs(next, now) - next.lastBreaktimeAt >=
      settings.breaktimeMinutes * 60_000
  ) {
    // Raising the alert pauses tracking — close the open segment now so the
    // clock stops the moment the alert appears, even if the user stays on
    // the page (no focus/idle event would otherwise fire to recompute).
    next = applyTransition(next, false, now);
    next = { ...next, breaktimeOpen: true, breaktimeShownToday: true };
  }

  if (!stateEqual(state, next)) {
    await setDayState(next);
  }
  await ensureDayResetAlarm(settings.wakeUpTime);
  await scheduleBreaktimeAlarm(next, settings);
}

function applyTransition(
  state: DayState,
  wantActive: boolean,
  now: number,
): DayState {
  const isActive = state.activeSince !== null;
  if (wantActive && !isActive) {
    return { ...state, activeSince: now };
  }
  if (!wantActive && isActive) {
    const elapsed = Math.max(0, now - (state.activeSince ?? now));
    return { ...state, totalMs: state.totalMs + elapsed, activeSince: null };
  }
  return state;
}

function stateEqual(a: DayState, b: DayState): boolean {
  return (
    a.wakeDayStart === b.wakeDayStart &&
    a.totalMs === b.totalMs &&
    a.activeSince === b.activeSince &&
    a.lastBreaktimeAt === b.lastBreaktimeAt &&
    a.breaktimeOpen === b.breaktimeOpen &&
    a.gatewayOpen === b.gatewayOpen &&
    a.tabLimitWarning === b.tabLimitWarning &&
    a.surveyFilledFor === b.surveyFilledFor &&
    a.breaktimeShownToday === b.breaktimeShownToday &&
    a.surveyContinueAllowed === b.surveyContinueAllowed
  );
}

/**
 * Compute the next-day state from an outgoing day. Persists the outgoing
 * day's totalMs to IndexedDB.
 */
export async function rolloverDay(
  outgoing: DayState,
  newWakeDayStart: number,
): Promise<DayState> {
  const now = Date.now();
  const finalTotalMs = effectiveMs(outgoing, now);
  const outgoingDate = dateKey(outgoing.wakeDayStart);

  const settings = await getSettings();
  const newStreak = finalTotalMs < STREAK_THRESHOLD_MS ? settings.currentStreak + 1 : 0;
  const newBest = Math.max(settings.bestStreak, newStreak);
  await setSettings({ currentStreak: newStreak, bestStreak: newBest });

  if (outgoing.wakeDayStart > 0 && finalTotalMs > 0) {
    const streakPatch = newStreak > 0 ? { streak: newStreak } : {};
    await upsertDay(outgoingDate, { totalMs: finalTotalMs, ...streakPatch }).catch(() => null);
  }

  return {
    wakeDayStart: newWakeDayStart,
    totalMs: 0,
    activeSince: outgoing.activeSince !== null ? now : null,
    lastBreaktimeAt: 0,
    breaktimeOpen: false,
    gatewayOpen: false,
    tabLimitWarning: false,
    surveyFilledFor: null,
    breaktimeShownToday: false,
    surveyContinueAllowed: false,
  };
}

export async function ensureDayResetAlarm(wakeUpTime: string): Promise<void> {
  const when = nextWakeUpAt(Date.now(), wakeUpTime);
  const existing = await browser.alarms.get(DAY_RESET_ALARM).catch(() => null);
  if (existing && Math.abs(existing.scheduledTime - when) < 1000) return;
  await browser.alarms.create(DAY_RESET_ALARM, { when });
}

export async function handleDayResetAlarm(): Promise<void> {
  const settings = await getSettings();
  const now = Date.now();
  const state = await getDayState();
  const next = await rolloverDay(
    state,
    currentWakeDayStart(now, settings.wakeUpTime),
  );
  await setDayState(next);
  await ensureDayResetAlarm(settings.wakeUpTime);
}

export const ALARM_NAMES = { DAY_RESET: DAY_RESET_ALARM } as const;
