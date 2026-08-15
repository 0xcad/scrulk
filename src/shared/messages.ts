/** Typed commands between extension/content pages and the background. */
export type Message =
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
  | { type: "survey:submit"; date: string; notes: string }
  | { type: "survey:continue" }
  | { type: "camera:enable" }
  | { type: "camera:ensure" }
  | { type: "camera:disable" }
  | { type: "debug:resetDay" };

export type MessageType = Message["type"];
