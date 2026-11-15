import { DEFAULT_DAY_STATE, type DayState } from "./dayState";
import { DEFAULT_SETTINGS, type Settings } from "./settings";
import { domainsOverlap } from "./domain";
import { normalizeWaitingScreen } from "../features/waiting-screen/model";
import { isValidPeekBlocklistPattern } from "../features/peek/model";

export type StoredSettings = Partial<Settings> & {
  wakeUpHour?: number;
  breaktimeMinutes?: number;
};

export function normalizeSettings(raw: StoredSettings | undefined): Settings {
  const cleanRaw = { ...(raw ?? {}) };
  delete cleanRaw.breaktimeMinutes;
  const merged = { ...DEFAULT_SETTINGS, ...cleanRaw };
  // Old installs stored only an integer hour; preserve their chosen boundary.
  if (raw?.wakeUpHour !== undefined && raw.wakeUpTime === undefined) {
    merged.wakeUpTime = `${String(raw.wakeUpHour).padStart(2, "0")}:00`;
  }
  merged.waitingScreen = normalizeWaitingScreen(raw?.waitingScreen);
  merged.peekBlocklistPatterns = uniqueStrings(raw?.peekBlocklistPatterns)
    .filter(isValidPeekBlocklistPattern);
  // Ignore is the safer behavior if malformed or legacy storage ever contains
  // overlapping entries. Normal UI mutations keep the lists disjoint.
  merged.trackedSites = merged.trackedSites.filter(
    (tracked) => !merged.ignoredSites.some((ignored) => domainsOverlap(tracked, ignored)),
  );
  merged.pendingTrackedSiteRemovals = normalizePendingRemovals(
    raw?.pendingTrackedSiteRemovals,
    merged.trackedSites,
  );
  merged.pendingPeekBlocklistRemovals = normalizePendingRemovals(
    raw?.pendingPeekBlocklistRemovals,
    merged.peekBlocklistPatterns,
  );
  return merged;
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => typeof entry === "string"))];
}

function normalizePendingRemovals(
  value: unknown,
  activeEntries: string[],
): Record<string, number> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const active = new Set(activeEntries);
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        active.has(entry[0]) &&
        typeof entry[1] === "number" &&
        Number.isFinite(entry[1]) &&
        entry[1] > 0,
    ),
  );
}

export function normalizeDayState(raw: Partial<DayState> | undefined): DayState {
  return { ...DEFAULT_DAY_STATE, ...(raw ?? {}) };
}
