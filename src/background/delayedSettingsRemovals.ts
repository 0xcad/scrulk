import browser from "webextension-polyfill";
import { getSettings, setSettings } from "../shared/storage";
import type { Settings } from "../shared/settings";
import { ALARM_NAMES } from "./alarms";
import { pendingRemovalDeadline } from "../shared/delayedRemovals";

interface ReconciledRemovals {
  patch: Pick<
    Settings,
    | "trackedSites"
    | "peekBlocklistPatterns"
    | "pendingTrackedSiteRemovals"
    | "pendingPeekBlocklistRemovals"
  >;
  changed: boolean;
  nextDeadline: number | null;
}

export function reconcileRemovalState(
  settings: Settings,
  now: number,
): ReconciledRemovals {
  const pendingTrackedSiteRemovals = futureRemovals(
    settings.pendingTrackedSiteRemovals,
    settings.trackedSites,
    now,
  );
  const pendingPeekBlocklistRemovals = futureRemovals(
    settings.pendingPeekBlocklistRemovals,
    settings.peekBlocklistPatterns,
    now,
  );
  const trackedSites = settings.trackedSites.filter(
    (entry) => !isDue(
      pendingRemovalDeadline(settings.pendingTrackedSiteRemovals, entry),
      now,
    ),
  );
  const peekBlocklistPatterns = settings.peekBlocklistPatterns.filter(
    (entry) => !isDue(
      pendingRemovalDeadline(settings.pendingPeekBlocklistRemovals, entry),
      now,
    ),
  );
  const deadlines = [
    ...Object.values(pendingTrackedSiteRemovals),
    ...Object.values(pendingPeekBlocklistRemovals),
  ];
  const patch = {
    trackedSites,
    peekBlocklistPatterns,
    pendingTrackedSiteRemovals,
    pendingPeekBlocklistRemovals,
  };
  return {
    patch,
    changed:
      !sameArray(trackedSites, settings.trackedSites) ||
      !sameArray(peekBlocklistPatterns, settings.peekBlocklistPatterns) ||
      !sameRecord(pendingTrackedSiteRemovals, settings.pendingTrackedSiteRemovals) ||
      !sameRecord(pendingPeekBlocklistRemovals, settings.pendingPeekBlocklistRemovals),
    nextDeadline: deadlines.length === 0 ? null : Math.min(...deadlines),
  };
}

export async function syncDelayedSettingsRemovals(now = Date.now()): Promise<void> {
  const settings = await getSettings();
  const reconciled = reconcileRemovalState(settings, now);
  if (reconciled.changed) await setSettings(reconciled.patch);

  const existing = await browser.alarms
    .get(ALARM_NAMES.delayedSettingsRemoval)
    .catch(() => null);
  if (reconciled.nextDeadline === null) {
    if (existing) {
      await browser.alarms
        .clear(ALARM_NAMES.delayedSettingsRemoval)
        .catch(() => false);
    }
    return;
  }
  if (
    existing &&
    Math.abs(existing.scheduledTime - reconciled.nextDeadline) < 1000
  ) return;
  await browser.alarms.create(ALARM_NAMES.delayedSettingsRemoval, {
    when: reconciled.nextDeadline,
  });
}

function futureRemovals(
  pending: Record<string, number>,
  activeEntries: string[],
  now: number,
): Record<string, number> {
  const active = new Set(activeEntries);
  return Object.fromEntries(
    Object.entries(pending).filter(
      ([entry, deadline]) => active.has(entry) && deadline > now,
    ),
  );
}

function isDue(deadline: number | undefined, now: number): boolean {
  return deadline !== undefined && deadline <= now;
}

function sameArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function sameRecord(
  left: Record<string, number>,
  right: Record<string, number>,
): boolean {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  return leftEntries.length === rightEntries.length &&
    leftEntries.every(([key, value]) => right[key] === value);
}
