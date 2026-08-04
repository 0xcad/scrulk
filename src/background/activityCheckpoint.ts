import type { DayState } from "../shared/types";

/**
 * While a usage segment is open, a one-shot alarm confirms that the browser
 * is still running once a minute. A gap longer than this is treated as a
 * suspend/restart gap rather than active usage.
 */
export const ACTIVITY_CHECK_INTERVAL_MS = 60_000;
export const ACTIVITY_STALE_AFTER_MS = 2 * ACTIVITY_CHECK_INTERVAL_MS;

function cappedElapsed(
  activeSince: number | null,
  checkpointAt: number | null,
  now: number,
): number {
  if (activeSince === null) return 0;

  // Stored states created before activity checkpoints existed have no
  // reliable end time. Allow at most one check interval from the segment's
  // start so an upgrade cannot preserve an hours-long suspended segment.
  const confirmedAt = checkpointAt ?? activeSince;
  const cutoff = Math.min(
    now,
    Math.max(activeSince, confirmedAt) + ACTIVITY_CHECK_INTERVAL_MS,
  );
  return Math.max(0, cutoff - activeSince);
}

/**
 * Close segments whose liveness checkpoint was missed. The caller may open
 * fresh segments at `now` after it re-reads focus, URL, and idle state.
 */
export function reconcileStaleActivity(
  state: DayState,
  now: number,
): DayState {
  const hasOpenSegment =
    state.activeSince !== null || state.allSitesActiveSince !== null;

  if (!hasOpenSegment) {
    return state.activityCheckpointAt === null
      ? state
      : { ...state, activityCheckpointAt: null };
  }

  const checkpointAt = state.activityCheckpointAt;
  if (
    checkpointAt !== null &&
    now - checkpointAt <= ACTIVITY_STALE_AFTER_MS
  ) {
    return state;
  }

  return {
    ...state,
    totalMs:
      state.totalMs + cappedElapsed(state.activeSince, checkpointAt, now),
    activeSince: null,
    allSitesMs:
      state.allSitesMs +
      cappedElapsed(state.allSitesActiveSince, checkpointAt, now),
    allSitesActiveSince: null,
    activityCheckpointAt: null,
  };
}

/** Refresh or clear the liveness checkpoint after activity transitions. */
export function checkpointOpenActivity(
  state: DayState,
  now: number,
): DayState {
  const checkpointAt =
    state.activeSince !== null || state.allSitesActiveSince !== null
      ? now
      : null;
  return state.activityCheckpointAt === checkpointAt
    ? state
    : { ...state, activityCheckpointAt: checkpointAt };
}
