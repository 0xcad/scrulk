import browser from "webextension-polyfill";
import {
  DAY_STATE_KEY,
  DEFAULT_DAY_STATE,
  DEFAULT_SETTINGS,
  GATEWAY_STATE_KEY,
  SETTINGS_KEY,
  TAB_BACK_MAP_KEY,
  type DayState,
  type GatewayState,
  type Settings,
  type TabBackMap,
} from "./types";

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  const raw = stored[SETTINGS_KEY] as
    | (Partial<Settings> & { wakeUpHour?: number })
    | undefined;
  const merged = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
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

export async function getGatewayState(): Promise<GatewayState> {
  const stored = await browser.storage.local.get(GATEWAY_STATE_KEY);
  return (stored[GATEWAY_STATE_KEY] as GatewayState | undefined) ?? {};
}

export async function setGatewayState(next: GatewayState): Promise<void> {
  await browser.storage.local.set({ [GATEWAY_STATE_KEY]: next });
}

export function onGatewayStateChange(
  cb: (next: GatewayState) => void,
): Unsubscribe {
  const listener = (
    changes: Record<string, browser.Storage.StorageChange>,
    area: string,
  ) => {
    if (area !== "local") return;
    const change = changes[GATEWAY_STATE_KEY];
    if (!change) return;
    cb((change.newValue as GatewayState | undefined) ?? {});
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

export async function getTabBackMap(): Promise<TabBackMap> {
  const stored = await browser.storage.local.get(TAB_BACK_MAP_KEY);
  return (stored[TAB_BACK_MAP_KEY] as TabBackMap | undefined) ?? {};
}

export async function setTabBackMap(next: TabBackMap): Promise<void> {
  await browser.storage.local.set({ [TAB_BACK_MAP_KEY]: next });
}
