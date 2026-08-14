import browser from "webextension-polyfill";
import {
  DAY_STATE_KEY,
  DEFAULT_DAY_STATE,
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  type DayState,
  type Settings,
} from "./types";

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  const raw = stored[SETTINGS_KEY] as
    | (Partial<Settings> & { wakeUpHour?: number; breaktimeMinutes?: number })
    | undefined;
  const cleanRaw = { ...(raw ?? {}) };
  delete cleanRaw.breaktimeMinutes;
  const merged = { ...DEFAULT_SETTINGS, ...cleanRaw };
  // Migration: pre-minute-precision storage used `wakeUpHour: number`.
  if (raw?.wakeUpHour !== undefined && raw.wakeUpTime === undefined) {
    merged.wakeUpTime = `${String(raw.wakeUpHour).padStart(2, "0")}:00`;
  }
  return merged;
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next: Settings = { ...current, ...patch };
  await browser.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export async function getDayState(): Promise<DayState> {
  const stored = await browser.storage.local.get(DAY_STATE_KEY);
  const raw = stored[DAY_STATE_KEY] as Partial<DayState> | undefined;
  return { ...DEFAULT_DAY_STATE, ...(raw ?? {}) };
}

export async function setDayState(next: DayState): Promise<void> {
  await browser.storage.local.set({ [DAY_STATE_KEY]: next });
}

type Unsubscribe = () => void;

export function onSettingsChange(cb: (next: Settings) => void): Unsubscribe {
  const listener = (
    changes: Record<string, browser.Storage.StorageChange>,
    area: string,
  ) => {
    if (area !== "local") return;
    const change = changes[SETTINGS_KEY];
    if (!change) return;
    const raw = change.newValue as Partial<Settings> | undefined;
    cb({ ...DEFAULT_SETTINGS, ...(raw ?? {}) });
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

export function onDayStateChange(cb: (next: DayState) => void): Unsubscribe {
  const listener = (
    changes: Record<string, browser.Storage.StorageChange>,
    area: string,
  ) => {
    if (area !== "local") return;
    const change = changes[DAY_STATE_KEY];
    if (!change) return;
    const raw = change.newValue as Partial<DayState> | undefined;
    cb({ ...DEFAULT_DAY_STATE, ...(raw ?? {}) });
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
