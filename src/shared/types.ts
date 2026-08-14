/**
 * Settings is the single object stored under storage key "settings".
 * When adding a field: extend this interface, give it a default in
 * DEFAULT_SETTINGS, and surface a control on Settings.tsx.
 */
export const STREAK_THRESHOLD_MS = 20_000;

export interface Settings {
  trackedSites: string[];
  installedAt: number;
  firstInstalledAt: number;
  /** Local time-of-day "HH:MM" (24h) at which the day boundary rolls over. Default "07:00". */
  wakeUpTime: string;
  /** Focused minutes required on the once-per-wake-day waiting page. */
  waitingMinutes: number;
  /** Max simultaneous tabs whose host is tracked. Excess tabs auto-close. Default 3. */
  tabLimit: number;
  /** Open tracked links clicked on untracked pages in an embedded Peek preview. */
  peekEnabled: boolean;
  /** Show the all-websites clock on every HTTP(S) page. Default false. */
  alwaysShowTimer: boolean;
  /** Whether the shared all-websites timer is showing its detail rows. */
  alwaysShowTimerExpanded: boolean;
  /** Per tracked-domain saved overlay position. */
  clockPositions: Record<string, ClockPosition>;
  /** Single global position for the universal sleep clock. */
  sleepClockPosition: ClockPosition | null;
  /** Global position for the all-websites clock on untracked pages. */
  allSitesClockPosition: ClockPosition | null;
  /** Show a mirrored, video-only self-view on tracked sites. */
  cameraOverlayEnabled: boolean;
  /** Last result of asking Firefox for this extension's camera access. */
  cameraOverlayPermission: CameraOverlayPermission;
  /** Single global position for the tracked-site camera overlay. */
  cameraOverlayPosition: ClockPosition | null;
  /** Single global size for the tracked-site camera overlay. */
  cameraOverlaySize: CameraOverlaySize | null;
  /** Consecutive tracked-site usage days ending with the last completed day. */
  usageStreak: number;
}

export interface ClockPosition {
  x: number;
  y: number;
}

export interface CameraOverlaySize {
  width: number;
  height: number;
}

export type CameraOverlayPermission = "unknown" | "granted" | "denied";

export type AccessFlowPhase =
  | "waiting"
  | "waitingReady"
  | "picking"
  | "browsing"
  | "resumePrompt"
  | "break"
  | "challenge"
  | "popupLocked";

export const DEFAULT_SETTINGS: Settings = {
  trackedSites: [],
  installedAt: 0,
  firstInstalledAt: 0,
  wakeUpTime: "07:00",
  waitingMinutes: 5,
  tabLimit: 3,
  peekEnabled: true,
  alwaysShowTimer: false,
  alwaysShowTimerExpanded: false,
  clockPositions: {},
  sleepClockPosition: null,
  allSitesClockPosition: null,
  cameraOverlayEnabled: false,
  cameraOverlayPermission: "unknown",
  cameraOverlayPosition: null,
  cameraOverlaySize: null,
  usageStreak: 0,
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
 * - `allSitesMs` / `allSitesActiveSince`: the equivalent tally for any
 *   focused, non-idle HTTP(S) page. This never drives friction behavior.
 * - `activityCheckpointAt`: latest confirmation that an open segment was
 *   running, used to exclude laptop-sleep and browser-restart gaps.
 */
export interface DayState {
  wakeDayStart: number;
  totalMs: number;
  activeSince: number | null;
  allSitesMs: number;
  allSitesActiveSince: number | null;
  activityCheckpointAt: number | null;
  /** Global access state shared by every tracked domain. */
  accessFlowPhase: AccessFlowPhase;
  waitingMs: number;
  waitingActiveSince: number | null;
  waitingCheckpointAt: number | null;
  /** Last focus report from the waiting extension document. */
  waitingPageFocused: boolean;
  /** Chosen tracked-usage allowance and its effectiveMs baseline. */
  allowanceMs: number | null;
  allowanceStartTotalMs: number | null;
  /** Wall-clock moment the current break prompt opened. */
  breakOpenedAt: number | null;
  /** Wall-clock expiry for a one-time breaktime extension, else null. */
  breaktimeExtensionExpiresAt: number | null;
  /** Prevents another extension until this breaktime cycle is resolved. */
  breaktimeExtensionUsed: boolean;
  /** Original tracked page URL for each tab allowed during an extension. */
  breaktimeExtensionTabs: Record<string, string>;
  /** Set true when the tab limit blocked a new tracked tab; popup clears on view. */
  tabLimitWarning: boolean;
  /** 'YYYY-MM-DD' wake-day key the survey was submitted for, else null. */
  surveyFilledFor: string | null;
  /** True once the breaktime alert has been shown at least once this wake-day. */
  breaktimeShownToday: boolean;
  /** The popup's explicit "done with tracked sites" action was used today. */
  popupDoneToday: boolean;
  /**
   * True once the user overrides today's popup-originated lock from the
   * survey. Together with popupDoneToday this enables the grayscale frame.
   */
  surveyContinueAllowed: boolean;
}

export const DEFAULT_DAY_STATE: DayState = {
  wakeDayStart: 0,
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
  popupDoneToday: false,
  surveyContinueAllowed: false,
};

export const DAY_STATE_KEY = "dayState" as const;

/** Computed live display = totalMs + (activeSince ? now - activeSince : 0). */
export function effectiveMs(state: DayState, now: number): number {
  if (state.activeSince === null) return state.totalMs;
  return state.totalMs + Math.max(0, now - state.activeSince);
}

export function effectiveWaitingMs(state: DayState, now: number): number {
  return state.waitingMs +
    (state.waitingActiveSince === null
      ? 0
      : Math.max(0, now - state.waitingActiveSince));
}

export function remainingAllowanceMs(state: DayState, now: number): number {
  if (state.allowanceMs === null || state.allowanceStartTotalMs === null) return 0;
  return Math.max(
    0,
    state.allowanceMs - (effectiveMs(state, now) - state.allowanceStartTotalMs),
  );
}

/** Computed live display for active time on all HTTP(S) websites. */
export function effectiveAllSitesMs(state: DayState, now: number): number {
  if (state.allSitesActiveSince === null) return state.allSitesMs;
  return state.allSitesMs + Math.max(0, now - state.allSitesActiveSince);
}

/** Whether the current wake-day has enough tracked usage to extend a streak. */
export function isUsageStreakDay(state: DayState, now: number): boolean {
  return effectiveMs(state, now) >= STREAK_THRESHOLD_MS;
}

/**
 * Current consecutive-use run. A completed prior-day run remains current
 * until today's wake-day completes without qualifying tracked usage.
 */
export function liveUsageStreakCount(
  completedStreak: number,
  state: DayState,
  now: number,
): number {
  return completedStreak + (isUsageStreakDay(state, now) ? 1 : 0);
}
