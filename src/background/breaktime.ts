import browser from "webextension-polyfill";
import { hostnameOf, isTracked } from "../shared/domain";
import { getDayState, getSettings, setDayState } from "../shared/storage";
import { effectiveMs, type DayState, type Settings } from "../shared/types";

export const BREAKTIME_ALARM = "scrulk:breaktime";

/**
 * Schedule the next breaktime alarm based on remaining time until the
 * threshold. Cleared if no segment is open or an alert is already showing —
 * tracker.recompute() will re-call this on every relevant event.
 */
export async function scheduleBreaktimeAlarm(
  state: DayState,
  settings: Settings,
): Promise<void> {
  if (state.breaktimeOpen || state.activeSince === null) {
    await browser.alarms.clear(BREAKTIME_ALARM).catch(() => null);
    return;
  }
  const now = Date.now();
  const since = effectiveMs(state, now) - state.lastBreaktimeAt;
  const remaining = settings.breaktimeMinutes * 60_000 - since;
  if (remaining <= 0) {
    // Already past threshold — recompute() will flip breaktimeOpen on its
    // next call. Don't schedule.
    await browser.alarms.clear(BREAKTIME_ALARM).catch(() => null);
    return;
  }
  const when = now + remaining;
  const existing = await browser.alarms.get(BREAKTIME_ALARM).catch(() => null);
  if (existing && Math.abs(existing.scheduledTime - when) < 1000) return;
  await browser.alarms.create(BREAKTIME_ALARM, { when });
}

/**
 * Called when the user successfully completes the hold challenge. Closes the
 * current alert and opens a new breaktime cycle from the current effectiveMs.
 */
export async function handleBreaktimeResume(): Promise<void> {
  const state = await getDayState();
  if (!state.breaktimeOpen) return;
  const now = Date.now();
  await setDayState({
    ...state,
    breaktimeOpen: false,
    lastBreaktimeAt: effectiveMs(state, now),
  });
}

/**
 * Called when the user clicks "I'm done!". Closes every tracked-site tab
 * across all windows. Leaves `breaktimeOpen=true` deliberately: if the user
 * reopens any tracked site, the overlay mounts immediately so they have to
 * re-do the hold challenge to keep browsing. Only a successful hold
 * (`handleBreaktimeResume`) clears the flag.
 */
export async function handleBreaktimeDone(): Promise<void> {
  const settings = await getSettings();
  const tabs = await browser.tabs.query({});
  const ids = tabs
    .filter((t) => {
      const host = hostnameOf(t.url);
      return host !== null && isTracked(host, settings.trackedSites);
    })
    .map((t) => t.id)
    .filter((id): id is number => id !== undefined);
  if (ids.length > 0) {
    await browser.tabs.remove(ids).catch(() => null);
  }
}
