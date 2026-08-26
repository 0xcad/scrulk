import browser from "webextension-polyfill";
import { dateKey, upsertDay } from "../shared/history";
import type { Message, MessageType } from "../shared/messages";
import { getDayState, getSettings, setDayState } from "../shared/storage";
import { effectiveAllSitesMs, effectiveFocusMs, effectiveMs } from "../shared/dayState";
import { currentWakeDayStart } from "../shared/wakeDay";
import {
  handleBreaktimeContinue,
  handleBreaktimeDone,
  handleBreaktimeExtend,
  handleChallengeComplete,
  handleChooseAllowance,
  handleConfirmWaiting,
  handlePopupDone,
  handleResumePrompt,
  handleWaitContinue,
  handleWaitingFocus,
  handleQuestionsComplete,
} from "../features/access-flow/background/breaktime";
import {
  closeCameraHub,
  ensureCameraHub,
  ensureCameraHubForOverlay,
} from "../features/camera/background";
import {
  ensureAccessPage,
  focusChallengePage,
} from "../features/access-flow/background/gateway";
import {
  recompute,
  resetDayStateForDebug,
} from "../features/tracking/background/tracker";
import { reduceAccessFlow } from "../features/access-flow/transitions";
import {
  deleteFocus,
  endFocus,
  openFocusTabOutside,
  renameFocus,
  resumeFocus,
  startFocus,
  stashFocusTab,
  isFocusWindow,
} from "../features/focus/background";

type Sender = browser.Runtime.MessageSender;
type HandlerResult = Promise<unknown> | unknown;
type CommandHandlers = {
  [T in MessageType]: (
    message: Extract<Message, { type: T }>,
    sender: Sender,
  ) => HandlerResult;
};

const withRecompute = async (operation: () => Promise<unknown>): Promise<void> => {
  await operation();
  await recompute();
};

const COMMAND_HANDLERS = {
  "access:confirmWaiting": () => withRecompute(handleConfirmWaiting),
  "access:declineWaiting": (_message, sender) => closeSenderTab(sender.tab?.id),
  "access:questionsComplete": () => withRecompute(handleQuestionsComplete),
  "access:waitContinue": () => withRecompute(handleWaitContinue),
  "access:setWaitingFocus": (message) =>
    withRecompute(() => handleWaitingFocus(message.focused)),
  "access:chooseAllowance": (message, sender) =>
    withRecompute(() =>
      handleChooseAllowance(message.minutes, message.destUrl, sender.tab?.id)
    ),
  "access:resumeAllowance": () => withRecompute(handleResumePrompt),
  "access:startChallenge": (_message, sender) =>
    withRecompute(() => handleBreaktimeContinue(sender.tab)),
  "access:focusPage": (_message, sender) => focusChallengePage(sender.tab),
  "access:challengeComplete": () => withRecompute(handleChallengeComplete),
  "breaktime:extend": () => withRecompute(handleBreaktimeExtend),
  "breaktime:done": () => withRecompute(handleBreaktimeDone),
  "popup:done": () => withRecompute(handlePopupDone),
  "popup:acknowledgeTabLimitWarning": () => acknowledgeTabLimitWarning(),
  "focus:start": (message) => withRecompute(() => startFocus(message.windowId)),
  "focus:end": (message) => withRecompute(() => endFocus(message.sessionId)),
  "focus:stashTab": (message) => withRecompute(() => stashFocusTab(message.tabId)),
  "focus:resume": (message) => withRecompute(() => resumeFocus(message.sessionId)),
  "focus:delete": (message) => withRecompute(() => deleteFocus(message.sessionId)),
  "focus:rename": (message) => renameFocus(message.sessionId, message.name),
  "focus:openTabOutside": (message) =>
    openFocusTabOutside(message.sessionId, message.tabId),
  "focus:getContext": (_message, sender) => isFocusWindow(sender.tab?.windowId),
  "survey:submit": (message, sender) => handleSurveySubmit(message, sender.tab?.id),
  "survey:continue": (_message, sender) =>
    withRecompute(() => handleSurveyContinue(sender.tab?.id)),
  "camera:enable": (_message, sender) => ensureCameraHub(true, sender.tab),
  "camera:ensure": (_message, sender) => ensureCameraHubForOverlay(sender.tab),
  "camera:disable": () => closeCameraHub(),
  "debug:resetDay": () => {
    if (__SCRULK_DEBUG__) return resetDayStateForDebug();
  },
  "debug:setDayStateField": (message) => {
    if (__SCRULK_DEBUG__) return setDebugDayStateField(message);
  },
} satisfies CommandHandlers;

async function closeSenderTab(tabId: number | undefined): Promise<void> {
  if (tabId !== undefined) await browser.tabs.remove(tabId).catch(() => null);
}

export function isCommand(value: unknown): value is Message {
  if (value === null || typeof value !== "object" || !("type" in value)) return false;
  const type = (value as { type?: unknown }).type;
  return typeof type === "string" && type in COMMAND_HANDLERS;
}

export function dispatchCommand(value: unknown, sender: Sender): HandlerResult {
  if (!isCommand(value)) return undefined;
  const handler = COMMAND_HANDLERS[value.type] as (
    message: Message,
    sender: Sender,
  ) => HandlerResult;
  return handler(value, sender);
}

async function acknowledgeTabLimitWarning(): Promise<void> {
  const state = await getDayState();
  if (state.tabLimitWarning) {
    await setDayState({ ...state, tabLimitWarning: false });
  }
}

async function setDebugDayStateField(
  message: Extract<Message, { type: "debug:setDayStateField" }>,
): Promise<void> {
  const state = await getDayState();
  await setDayState({ ...state, [message.field]: message.value });
}

async function handleSurveySubmit(
  message: Extract<Message, { type: "survey:submit" }>,
  senderTabId: number | undefined,
): Promise<void> {
  const settings = await getSettings();
  const state = await getDayState();
  const now = Date.now();
  const currentDate = dateKey(currentWakeDayStart(now, settings.wakeUpTime));
  const isCurrent = message.date === currentDate;
  await upsertDay(message.date, {
    notes: message.notes,
    ...(isCurrent ? { totalMs: effectiveMs(state, now) } : {}),
    ...(isCurrent ? { allSitesMs: effectiveAllSitesMs(state, now) } : {}),
    ...(isCurrent ? { focusMs: effectiveFocusMs(state, now) } : {}),
  });
  if (isCurrent) {
    await setDayState({ ...state, surveyFilledFor: message.date });
  }
  if (senderTabId !== undefined) {
    await browser.tabs.remove(senderTabId).catch(() => null);
  }
}

async function handleSurveyContinue(senderTabId: number | undefined): Promise<void> {
  const state = await getDayState();
  if (!state.popupDoneToday || state.surveyContinueAllowed) return;
  await setDayState(reduceAccessFlow(state, { type: "surveyContinued" }));
  if (senderTabId !== undefined) {
    const senderTab = await browser.tabs.get(senderTabId).catch(() => undefined);
    await ensureAccessPage(senderTab);
    await browser.tabs.remove(senderTabId).catch(() => null);
  }
}
