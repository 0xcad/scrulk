import type { DayState } from "../../../shared/dayState";
import {
  ACTIVITY_CHECK_INTERVAL_MS,
  ACTIVITY_STALE_AFTER_MS,
} from "./activityCheckpoint";

export function applyWaitingTransition(
  state: DayState,
  wantActive: boolean,
  now: number,
): DayState {
  if (wantActive && state.waitingActiveSince === null) {
    return { ...state, waitingActiveSince: now };
  }
  if (!wantActive && state.waitingActiveSince !== null) {
    return {
      ...state,
      waitingMs: state.waitingMs + Math.max(0, now - state.waitingActiveSince),
      waitingActiveSince: null,
      waitingCheckpointAt: null,
    };
  }
  return state;
}

export function reconcileStaleWaiting(state: DayState, now: number): DayState {
  if (state.waitingActiveSince === null) return state;
  if (
    state.waitingCheckpointAt !== null &&
    now - state.waitingCheckpointAt <= ACTIVITY_STALE_AFTER_MS
  ) return state;
  const confirmedAt = state.waitingCheckpointAt ?? state.waitingActiveSince;
  const cutoff = Math.min(now, confirmedAt + ACTIVITY_CHECK_INTERVAL_MS);
  return {
    ...state,
    waitingMs: state.waitingMs + Math.max(0, cutoff - state.waitingActiveSince),
    waitingActiveSince: null,
    waitingCheckpointAt: null,
  };
}

export function checkpointWaiting(state: DayState, now: number): DayState {
  const checkpoint = state.waitingActiveSince === null ? null : now;
  return state.waitingCheckpointAt === checkpoint
    ? state
    : { ...state, waitingCheckpointAt: checkpoint };
}

export function applyAllSitesTransition(
  state: DayState,
  wantActive: boolean,
  now: number,
): DayState {
  const isActive = state.allSitesActiveSince !== null;
  if (wantActive && !isActive) return { ...state, allSitesActiveSince: now };
  if (!wantActive && isActive) {
    const elapsed = Math.max(0, now - (state.allSitesActiveSince ?? now));
    return {
      ...state,
      allSitesMs: state.allSitesMs + elapsed,
      allSitesActiveSince: null,
    };
  }
  return state;
}

export function applyTrackedTransition(
  state: DayState,
  wantActive: boolean,
  now: number,
): DayState {
  const isActive = state.activeSince !== null;
  if (wantActive && !isActive) return { ...state, activeSince: now };
  if (!wantActive && isActive) {
    const elapsed = Math.max(0, now - (state.activeSince ?? now));
    return { ...state, totalMs: state.totalMs + elapsed, activeSince: null };
  }
  return state;
}

/** Compare every persisted field so additions cannot be omitted from dirty checks. */
export function dayStateEqual(a: DayState, b: DayState): boolean {
  const keys = Object.keys(a) as Array<keyof DayState>;
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => {
    const left = a[key];
    const right = b[key];
    if (Object.is(left, right)) return true;
    if (isStringRecord(left) && isStringRecord(right)) {
      const leftKeys = Object.keys(left);
      return leftKeys.length === Object.keys(right).length &&
        leftKeys.every((recordKey) => left[recordKey] === right[recordKey]);
    }
    return false;
  });
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string");
}
