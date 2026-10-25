import type { CameraOverlaySize, ClockPosition } from "./uiTypes";
import {
  DEFAULT_WAITING_SCREEN,
  type WaitingScreen,
} from "../features/waiting-screen/model";

export interface Settings {
  trackedSites: string[];
  ignoredSites: string[];
  installedAt: number;
  firstInstalledAt: number;
  /** Local "HH:MM" wake-day boundary. */
  wakeUpTime: string;
  initialWaitingSeconds: number;
  repeatWaitingSeconds: number;
  tabLimit: number;
  peekEnabled: boolean;
  alwaysShowTimer: boolean;
  alwaysShowTimerExpanded: boolean;
  clockPositions: Record<string, ClockPosition>;
  sleepClockPosition: ClockPosition | null;
  allSitesClockPosition: ClockPosition | null;
  cameraOverlayEnabled: boolean;
  cameraOverlayPermission: CameraOverlayPermission;
  cameraOverlayPosition: ClockPosition | null;
  cameraOverlaySize: CameraOverlaySize | null;
  usageStreak: number;
  waitingScreen: WaitingScreen;
}

export type CameraOverlayPermission = "unknown" | "granted" | "denied";

export const DEFAULT_SETTINGS: Settings = {
  trackedSites: [],
  ignoredSites: [],
  installedAt: 0,
  firstInstalledAt: 0,
  wakeUpTime: "07:00",
  initialWaitingSeconds: 5 * 60,
  repeatWaitingSeconds: 60,
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
  waitingScreen: DEFAULT_WAITING_SCREEN,
};

export type SettingScope = "settings" | "debug" | "internal" | "component";

/** Every setting must have an intentional owner before it can be added. */
export const SETTINGS_SCOPES = {
  trackedSites: "settings",
  ignoredSites: "settings",
  installedAt: "internal",
  firstInstalledAt: "internal",
  wakeUpTime: "settings",
  initialWaitingSeconds: "settings",
  repeatWaitingSeconds: "settings",
  tabLimit: "settings",
  peekEnabled: "settings",
  alwaysShowTimer: "settings",
  alwaysShowTimerExpanded: "component",
  clockPositions: "component",
  sleepClockPosition: "component",
  allSitesClockPosition: "component",
  cameraOverlayEnabled: "settings",
  cameraOverlayPermission: "component",
  cameraOverlayPosition: "component",
  cameraOverlaySize: "component",
  usageStreak: "internal",
  waitingScreen: "component",
} as const satisfies Record<keyof Settings, SettingScope>;

export const SETTINGS_KEY = "settings" as const;
