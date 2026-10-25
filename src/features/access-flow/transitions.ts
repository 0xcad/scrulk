import {
  effectiveMs,
  remainingAllowanceMs,
  type DayState,
} from "../../shared/dayState";

export type AccessFlowEvent =
  | { type: "waitingConfirmed"; skip: boolean }
  | { type: "waitingElapsed" }
  | { type: "waitingQuestionsCompleted" }
  | { type: "waitCompleted" }
  | { type: "waitingSkipped" }
  | { type: "waitingFocusChanged"; focused: boolean }
  | { type: "allowanceChosen"; allowanceMs: number; startTotalMs: number }
  | { type: "allowanceResumed" }
  | { type: "allowanceInterrupted" }
  | { type: "allowanceExpired"; openedAt: number }
  | { type: "postBreakWaitingStarted"; now: number; gateMs: number; skip: boolean }
  | {
      type: "extensionStarted";
      expiresAt: number;
      tabs: Record<string, string>;
    }
  | { type: "extensionEnded"; openedAt: number }
  | { type: "breaktimeDone" }
  | { type: "popupDone" }
  | { type: "surveyContinued" };

export function shouldInterruptAllowance(
  state: DayState,
  hasTrackedTabs: boolean,
  now: number,
): boolean {
  return state.accessFlowPhase === "browsing" &&
    !hasTrackedTabs &&
    remainingAllowanceMs(state, now) > 0 &&
    state.allowanceStartTotalMs !== null &&
    effectiveMs(state, now) > state.allowanceStartTotalMs;
}

/** Pure access-flow transitions; browser/storage effects belong in callers. */
export function reduceAccessFlow(
  state: DayState,
  event: AccessFlowEvent,
): DayState {
  switch (event.type) {
    case "waitingConfirmed":
      if (state.accessFlowPhase !== "waitingConfirmation") return state;
      return event.skip ? {
        ...resetWaiting(state),
        accessFlowPhase: "picking",
      } : {
        ...state,
        accessFlowPhase: "waiting",
        ...waitingDefaults(),
      };
    case "waitingElapsed":
      if (state.accessFlowPhase !== "waiting") return state;
      return {
        ...state,
        waitingTimerElapsed: true,
        waitingPageFocused: false,
      };
    case "waitingQuestionsCompleted":
      if (state.accessFlowPhase !== "waiting" || !state.waitingTimerElapsed) return state;
      return { ...state, accessFlowPhase: "waitingReady", waitingPageFocused: false };
    case "waitCompleted":
      if (state.accessFlowPhase !== "waitingReady") return state;
      return { ...state, accessFlowPhase: "picking", waitingPageFocused: false };
    case "waitingSkipped":
      if (state.accessFlowPhase !== "waiting") return state;
      return { ...resetWaiting(state), accessFlowPhase: "picking" };
    case "waitingFocusChanged":
      if (
        state.accessFlowPhase !== "waiting" ||
        state.waitingTimerElapsed ||
        state.waitingPageFocused === event.focused
      ) return state;
      return { ...state, waitingPageFocused: event.focused };
    case "allowanceChosen":
      if (state.accessFlowPhase !== "picking") return state;
      return {
        ...state,
        accessFlowPhase: "browsing",
        allowanceMs: event.allowanceMs,
        allowanceStartTotalMs: event.startTotalMs,
        breakOpenedAt: null,
        breaktimeExtensionExpiresAt: null,
        breaktimeExtensionUsed: false,
        breaktimeExtensionTabs: {},
        postBreakAllowanceStartedToday:
          state.postBreakAllowanceStartedToday || state.postBreakAllowancePending,
        postBreakAllowancePending: false,
      };
    case "allowanceResumed":
      return state.accessFlowPhase === "resumePrompt"
        ? { ...state, accessFlowPhase: "browsing" }
        : state;
    case "allowanceInterrupted":
      return state.accessFlowPhase === "browsing"
        ? { ...state, accessFlowPhase: "resumePrompt" }
        : state;
    case "allowanceExpired":
      if (state.accessFlowPhase !== "browsing") return state;
      return {
        ...state,
        accessFlowPhase: "break",
        activeSince: null,
        allSitesActiveSince: null,
        breakOpenedAt: event.openedAt,
        breaktimeShownToday: true,
      };
    case "postBreakWaitingStarted":
      if (
        state.accessFlowPhase !== "break" ||
        state.breakOpenedAt === null ||
        event.now - state.breakOpenedAt < event.gateMs
      ) return state;
      return {
        ...resetWaiting(state),
        accessFlowPhase: event.skip ? "picking" : "waiting",
        postBreakAllowancePending: true,
        allowanceMs: null,
        allowanceStartTotalMs: null,
        breakOpenedAt: null,
      };
    case "extensionStarted":
      if (state.accessFlowPhase !== "break" || state.breaktimeExtensionUsed) {
        return state;
      }
      return {
        ...state,
        accessFlowPhase: "browsing",
        breaktimeExtensionExpiresAt: event.expiresAt,
        breaktimeExtensionUsed: true,
        breaktimeExtensionTabs: event.tabs,
      };
    case "extensionEnded":
      if (state.breaktimeExtensionExpiresAt === null) return state;
      return {
        ...state,
        accessFlowPhase: "break",
        breakOpenedAt: event.openedAt,
        breaktimeExtensionExpiresAt: null,
        breaktimeExtensionTabs: {},
      };
    case "breaktimeDone":
      return clearAllowance({ ...state, accessFlowPhase: "picking" });
    case "popupDone":
      return clearAllowance({
        ...state,
        accessFlowPhase: "popupLocked",
        popupDoneToday: true,
        surveyContinueAllowed: false,
      });
    case "surveyContinued":
      if (
        state.accessFlowPhase !== "popupLocked" ||
        !state.popupDoneToday ||
        state.surveyContinueAllowed
      ) return state;
      return {
        ...state,
        surveyContinueAllowed: true,
        accessFlowPhase: "picking",
      };
  }
}

function clearAllowance(state: DayState): DayState {
  return {
    ...state,
    allowanceMs: null,
    allowanceStartTotalMs: null,
    breakOpenedAt: null,
    breaktimeExtensionExpiresAt: null,
    breaktimeExtensionUsed: false,
    breaktimeExtensionTabs: {},
    postBreakAllowancePending: false,
  };
}

function waitingDefaults(): Pick<
  DayState,
  | "waitingMs"
  | "waitingActiveSince"
  | "waitingCheckpointAt"
  | "waitingPageFocused"
  | "waitingTimerElapsed"
> {
  return {
    waitingMs: 0,
    waitingActiveSince: null,
    waitingCheckpointAt: null,
    waitingPageFocused: false,
    waitingTimerElapsed: false,
  };
}

function resetWaiting(state: DayState): DayState {
  return { ...state, ...waitingDefaults() };
}
