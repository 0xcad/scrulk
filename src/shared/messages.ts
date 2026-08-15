import browser from "webextension-polyfill";
import type { DayState } from "./dayState";

export type DebugSetDayStateField = {
  [K in keyof DayState]: {
    type: "debug:setDayStateField";
    field: K;
    value: DayState[K];
  };
}[keyof DayState];

/** Typed commands between extension/content pages and the background. */
export type Message =
  | { type: "access:confirmWaiting" }
  | { type: "access:declineWaiting" }
  | { type: "access:questionsComplete" }
  | { type: "access:waitContinue" }
  | { type: "access:setWaitingFocus"; focused: boolean }
  | { type: "access:chooseAllowance"; minutes: number; destUrl?: string }
  | { type: "access:resumeAllowance" }
  | { type: "access:startChallenge" }
  | { type: "access:focusPage" }
  | { type: "access:challengeComplete" }
  | { type: "breaktime:done" }
  | { type: "breaktime:extend" }
  | { type: "popup:done" }
  | { type: "popup:acknowledgeTabLimitWarning" }
  | { type: "survey:submit"; date: string; notes: string }
  | { type: "survey:continue" }
  | { type: "camera:enable" }
  | { type: "camera:ensure" }
  | { type: "camera:disable" }
  | { type: "debug:resetDay" }
  | DebugSetDayStateField;

export type MessageType = Message["type"];

export function sendCommand(message: Message): Promise<unknown> {
  return browser.runtime.sendMessage(message);
}

export function sendDayStateFieldCommand<K extends keyof DayState>(
  field: K,
  value: DayState[K],
): Promise<unknown> {
  const message = {
    type: "debug:setDayStateField" as const,
    field,
    value,
  } as DebugSetDayStateField;
  return sendCommand(message);
}
