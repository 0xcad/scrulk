import { DEFAULT_DAY_STATE, type DayState } from "./dayState";
import { DEFAULT_SETTINGS, type Settings } from "./settings";
import { normalizeWaitingScreen } from "../features/waiting-screen/model";

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
  return merged;
}

export function normalizeDayState(raw: Partial<DayState> | undefined): DayState {
  return { ...DEFAULT_DAY_STATE, ...(raw ?? {}) };
}
