import {
  effectiveMs,
  remainingAllowanceMs,
  type DayState,
} from "../../shared/dayState";

export type AccessFlowEvent =
  | { type: "waitingConfirmed" }
  | { type: "waitingElapsed" }
  | { type: "waitingQuestionsCompleted" }
  | { type: "waitCompleted" }
  | { type: "waitingFocusChanged"; focused: boolean }
  | { type: "allowanceChosen"; allowanceMs: number; startTotalMs: number }
  | { type: "allowanceResumed" }
  | { type: "allowanceInterrupted" }
  | { type: "allowanceExpired"; openedAt: number }
  | { type: "challengeStarted"; now: number; gateMs: number }
  | { type: "challengeCompleted" }
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
      return {
        ...state,
        accessFlowPhase: "waiting",
        waitingTimerElapsed: false,
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
    case "challengeStarted":
      if (
        state.accessFlowPhase !== "break" ||
        state.breakOpenedAt === null ||
        event.now - state.breakOpenedAt < event.gateMs
      ) return state;
      return { ...state, accessFlowPhase: "challenge" };
    case "challengeCompleted":
      if (state.accessFlowPhase !== "challenge") return state;
      return {
        ...state,
        accessFlowPhase: "picking",
        breaktimeChallengeCompletedToday: true,
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
  };
}
