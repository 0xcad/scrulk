import { describe, expect, it } from "vitest";
import {
  DEFAULT_DAY_STATE,
  effectiveAllSitesMs,
  effectiveMs,
} from "../../../shared/dayState";
import {
  ACTIVITY_CHECK_INTERVAL_MS,
  ACTIVITY_STALE_AFTER_MS,
  checkpointOpenActivity,
  reconcileStaleActivity,
} from "./activityCheckpoint";

describe("reconcileStaleActivity", () => {
  it("caps tracked and all-sites time after a long suspend gap", () => {
    const checkpointAt = 1_000_000;
    const state = {
      ...DEFAULT_DAY_STATE,
      totalMs: 10_000,
      activeSince: checkpointAt - 30_000,
      allSitesMs: 20_000,
      allSitesActiveSince: checkpointAt - 30_000,
      activityCheckpointAt: checkpointAt,
    };

    const next = reconcileStaleActivity(state, checkpointAt + 4 * 60 * 60_000);

    expect(next.totalMs).toBe(10_000 + 90_000);
    expect(next.allSitesMs).toBe(20_000 + 90_000);
    expect(next.activeSince).toBeNull();
    expect(next.allSitesActiveSince).toBeNull();
    expect(next.activityCheckpointAt).toBeNull();
  });

  it("leaves a segment open when its checkpoint is still timely", () => {
    const checkpointAt = 1_000_000;
    const state = {
      ...DEFAULT_DAY_STATE,
      activeSince: checkpointAt - 30_000,
      activityCheckpointAt: checkpointAt,
    };

    expect(
      reconcileStaleActivity(
        state,
        checkpointAt + ACTIVITY_STALE_AFTER_MS,
      ),
    ).toBe(state);
  });

  it("caps a legacy open segment that has no checkpoint", () => {
    const activeSince = 1_000_000;
    const next = reconcileStaleActivity(
      { ...DEFAULT_DAY_STATE, totalMs: 5_000, activeSince },
      activeSince + 4 * 60 * 60_000,
    );

    expect(next.totalMs).toBe(5_000 + ACTIVITY_CHECK_INTERVAL_MS);
    expect(next.activeSince).toBeNull();
  });

  it("is safe to archive at a later wake-day boundary after reconciliation", () => {
    const checkpointAt = 1_000_000;
    const wakeDayBoundary = checkpointAt + 3 * 60 * 60_000;
    const next = reconcileStaleActivity(
      {
        ...DEFAULT_DAY_STATE,
        activeSince: checkpointAt - 30_000,
        allSitesActiveSince: checkpointAt - 30_000,
        activityCheckpointAt: checkpointAt,
      },
      checkpointAt + 4 * 60 * 60_000,
    );

    expect(effectiveMs(next, wakeDayBoundary)).toBe(90_000);
    expect(effectiveAllSitesMs(next, wakeDayBoundary)).toBe(90_000);
  });

  it("clears an orphan checkpoint when no segment is open", () => {
    const next = reconcileStaleActivity(
      { ...DEFAULT_DAY_STATE, activityCheckpointAt: 1_000_000 },
      2_000_000,
    );

    expect(next.activityCheckpointAt).toBeNull();
  });
});

describe("checkpointOpenActivity", () => {
  it("refreshes the checkpoint while either segment is open", () => {
    const now = 2_000_000;
    const next = checkpointOpenActivity(
      { ...DEFAULT_DAY_STATE, allSitesActiveSince: 1_000_000 },
      now,
    );

    expect(next.activityCheckpointAt).toBe(now);
  });

  it("clears the checkpoint after all segments close", () => {
    const next = checkpointOpenActivity(
      { ...DEFAULT_DAY_STATE, activityCheckpointAt: 1_000_000 },
      2_000_000,
    );

    expect(next.activityCheckpointAt).toBeNull();
  });
});
