import browser from "webextension-polyfill";
import { DAY_STATE_KEY, type DayState } from "./dayState";
import { SETTINGS_KEY, type Settings } from "./settings";
import {
  normalizeDayState,
  normalizeSettings,
  type StoredSettings,
} from "./storageNormalization";
import {
  DEFAULT_FOCUS_SESSIONS,
  FOCUS_SESSIONS_KEY,
  normalizeFocusSessions,
  type FocusSessionsState,
} from "./focusSessions";

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(stored[SETTINGS_KEY] as StoredSettings | undefined);
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
  return normalizeDayState(raw);
}

export async function setDayState(next: DayState): Promise<void> {
  await browser.storage.local.set({ [DAY_STATE_KEY]: next });
}

export async function getFocusSessions(): Promise<FocusSessionsState> {
  const stored = await browser.storage.local.get(FOCUS_SESSIONS_KEY);
  return normalizeFocusSessions(stored[FOCUS_SESSIONS_KEY] ?? DEFAULT_FOCUS_SESSIONS);
}

export async function setFocusSessions(next: FocusSessionsState): Promise<void> {
  await browser.storage.local.set({ [FOCUS_SESSIONS_KEY]: next });
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
    const raw = change.newValue as StoredSettings | undefined;
    cb(normalizeSettings(raw));
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
    cb(normalizeDayState(raw));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

export function onFocusSessionsChange(
  cb: (next: FocusSessionsState) => void,
): Unsubscribe {
  const listener = (
    changes: Record<string, browser.Storage.StorageChange>,
    area: string,
  ) => {
    if (area !== "local") return;
    const change = changes[FOCUS_SESSIONS_KEY];
    if (!change) return;
    cb(normalizeFocusSessions(change.newValue));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
