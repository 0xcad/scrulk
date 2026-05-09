/**
 * Settings is the single object stored under storage key "settings".
 * Future slices add fields here. When adding a field: extend this interface,
 * give it a default in DEFAULT_SETTINGS, and surface a control on Settings.tsx.
 */
export interface Settings {
  trackedSites: string[];
  installedAt: number;
  /** Hour-of-day (0-23) at which the day boundary rolls over. Default 7. */
  wakeUpHour: number;
  /** Minutes of accumulated tracked usage between breaktime alerts. Default 30. */
  breaktimeMinutes: number;
  /** Max simultaneous tabs whose host is tracked. Excess tabs auto-close. Default 3. */
  tabLimit: number;
  /** Per tracked-domain saved overlay position. */
  clockPositions: Record<string, ClockPosition>;
}

export interface ClockPosition {
  x: number;
  y: number;
}

export const DEFAULT_SETTINGS: Settings = {
  trackedSites: [],
  installedAt: 0,
  wakeUpHour: 7,
  breaktimeMinutes: 30,
  tabLimit: 3,
  clockPositions: {},
};

export const SETTINGS_KEY = "settings" as const;

/**
 * DayState is the running tally for the current wake-day. Stored separately
 * from settings so settings changes don't churn it.
 *
 * - `wakeDayStart`: epoch ms of the wake-up boundary that opened this day.
 * - `totalMs`: accumulated active+tracked time, NOT including the open
 *   segment if `activeSince` is set.
 * - `activeSince`: epoch ms when the user became active+tracked, or null.
 */
export interface DayState {
  wakeDayStart: number;
  totalMs: number;
  activeSince: number | null;
  /** effectiveMs at which the most recent breaktime alert was resolved. */
  lastBreaktimeAt: number;
  /** True while a breaktime alert is currently outstanding. */
  breaktimeOpen: boolean;
}

export const DEFAULT_DAY_STATE: DayState = {
  wakeDayStart: 0,
  totalMs: 0,
  activeSince: null,
  lastBreaktimeAt: 0,
  breaktimeOpen: false,
};

export const DAY_STATE_KEY = "dayState" as const;

/** Computed live display = totalMs + (activeSince ? now - activeSince : 0). */
export function effectiveMs(state: DayState, now: number): number {
  if (state.activeSince === null) return state.totalMs;
  return state.totalMs + Math.max(0, now - state.activeSince);
}
