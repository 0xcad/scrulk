import { useCallback, useEffect, useState } from "preact/hooks";
import { FullPageOverlay, fullPageOverlayStyles } from "../../../shared/FullPageOverlay";
import {
  allowanceOptions,
  completedTrackedAverageMs,
  isCustomAllowanceMinutes,
} from "../allowanceOptions";
import { getAllDays } from "../../../shared/history";
import { sendCommand } from "../../../shared/messages";
import {
  getDayState,
  getSettings,
  onDayStateChange,
  onSettingsChange,
} from "../../../shared/storage";
import {
  DEFAULT_DAY_STATE,
  effectiveMs,
  liveUsageStreakCount,
  type DayState,
} from "../../../shared/dayState";
import { DEFAULT_SETTINGS, type Settings } from "../../../shared/settings";
import { WaitingScreenView } from "../../waiting-screen/WaitingScreenView";
import {
  isWaitingPageEligible,
  isWaitingWindowLargeEnough,
  type WaitingWindowMetrics,
} from "./waitingWindow";

const DEFAULT_TITLE = "Scroll Unlock";
const INACTIVE_TITLE = "waiting timer paused ⏸️";
const WAITING_WINDOW_CHECK_INTERVAL_MS = 1000;

interface WaitingPageStatus {
  focused: boolean;
  largeEnough: boolean;
}

function waitingWindowMetrics(): WaitingWindowMetrics {
  return {
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
    availWidth: window.screen.availWidth,
    availHeight: window.screen.availHeight,
  };
}

function currentWaitingPageStatus(): WaitingPageStatus {
  return {
    focused: document.visibilityState === "visible" && document.hasFocus(),
    largeEnough: isWaitingWindowLargeEnough(waitingWindowMetrics()),
  };
}

function destination(): string | undefined {
  return new URLSearchParams(window.location.search).get("dest") ?? undefined;
}

export function Gateway() {
  const dest = destination();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [dayState, setDayState] = useState<DayState>(DEFAULT_DAY_STATE);
  const [waitingPageStatus, setWaitingPageStatus] = useState(
    currentWaitingPageStatus,
  );
  const [trackedAverageMs, setTrackedAverageMs] = useState<number | null>(null);
  const [customMinutes, setCustomMinutes] = useState("");

  useEffect(() => {
    void getSettings().then(setSettings);
    void getDayState().then(setDayState);
    const offSettings = onSettingsChange(setSettings);
    const offState = onDayStateChange(setDayState);
    return () => {
      offSettings();
      offState();
    };
  }, []);

  useEffect(() => {
    if (dayState.wakeDayStart <= 0) return;
    let disposed = false;
    setTrackedAverageMs(null);
    void getAllDays()
      .then((days) => {
        if (!disposed) {
          setTrackedAverageMs(
            completedTrackedAverageMs(days, dayState.wakeDayStart),
          );
        }
      })
      .catch(() => {
        if (!disposed) setTrackedAverageMs(null);
      });
    return () => {
      disposed = true;
    };
  }, [dayState.wakeDayStart]);

  useEffect(() => {
    const waitingCountdownActive =
      dayState.accessFlowPhase === "waiting" &&
      !dayState.waitingTimerElapsed;
    let lastReportedEligibility: boolean | undefined;

    const updateStatus = (next: WaitingPageStatus) => {
      setWaitingPageStatus((current) =>
        current.focused === next.focused &&
          current.largeEnough === next.largeEnough
          ? current
          : next
      );
      const eligible = isWaitingPageEligible(next.focused, next.largeEnough);
      if (
        waitingCountdownActive &&
        eligible !== lastReportedEligibility
      ) {
        lastReportedEligibility = eligible;
        void sendCommand({ type: "access:setWaitingFocus", focused: eligible });
      }
      document.title = waitingCountdownActive && !eligible
        ? INACTIVE_TITLE
        : DEFAULT_TITLE;
    };
    const sync = () => {
      updateStatus(currentWaitingPageStatus());
    };
    const onPageHide = () => {
      updateStatus({
        focused: false,
        largeEnough: isWaitingWindowLargeEnough(waitingWindowMetrics()),
      });
    };
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("blur", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("pagehide", onPageHide);
    const checkInterval = waitingCountdownActive
      ? window.setInterval(sync, WAITING_WINDOW_CHECK_INTERVAL_MS)
      : undefined;
    sync();
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("blur", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("pagehide", onPageHide);
      if (checkInterval !== undefined) window.clearInterval(checkInterval);
      document.title = DEFAULT_TITLE;
    };
  }, [dayState.accessFlowPhase, dayState.waitingTimerElapsed]);

  const pick = (minutes: number) => {
    void sendCommand({ type: "access:chooseAllowance", minutes, destUrl: dest });
  };
  const submitCustomTime = (event: SubmitEvent) => {
    event.preventDefault();
    const minutes = Number(customMinutes);
    if (!isCustomAllowanceMinutes(minutes)) return;
    pick(minutes);
  };
  const usageStreak = liveUsageStreakCount(
    settings.usageStreak,
    dayState,
    Date.now(),
  );
  const timerOptions = allowanceOptions(
    trackedAverageMs,
    effectiveMs(dayState, Date.now()),
  );

  const questionsComplete = useCallback(() => {
    void sendCommand({ type: "access:questionsComplete" });
  }, []);

  if (dayState.accessFlowPhase === "waitingConfirmation") {
    return (
      <main class="scrulk-card flow-card gateway-confirmation">
        <h1 class="scrulk-card-title">Do you want to continue?</h1>
        <p class="scrulk-card-copy">
          {settings.initialWaitingSeconds === 0
            ? "You are about to enter a tracked site. Choose how much time you want to spend before continuing."
            : "You are about to enter a tracked site. To give you clarity on this decision, you'll have to wait first."}
        </p>
        <div class="scrulk-card-actions">
          <button type="button" class="primary" onClick={() => void sendCommand({ type: "access:declineWaiting" })}>no thanks, I'll go back</button>
          <button type="button" class="secondary" onClick={() => void sendCommand({ type: "access:confirmWaiting" })}>continue &gt;</button>
        </div>
      </main>
    );
  }

  if (dayState.accessFlowPhase === "waiting" || dayState.accessFlowPhase === "waitingReady") {
    return (
      <div class="gateway-waiting-root">
        <style>{fullPageOverlayStyles}</style>
        <WaitingScreenView
          screen={settings.waitingScreen}
          timerElapsed={dayState.waitingTimerElapsed}
          onQuestionsComplete={questionsComplete}
        />
        {dayState.accessFlowPhase === "waiting" &&
          !dayState.waitingTimerElapsed &&
          !waitingPageStatus.largeEnough && (
          <FullPageOverlay labelledBy="inactive-title">
            <div>
              <h1 class="scrulk-card-title" id="inactive-title">Resize this tab</h1>
              <p class="scrulk-card-copy">The waiting period only continues if this tab has a large enough size.</p>
            </div>
          </FullPageOverlay>
        )}
        {dayState.accessFlowPhase === "waiting" &&
          !dayState.waitingTimerElapsed &&
          waitingPageStatus.largeEnough &&
          !waitingPageStatus.focused && (
          <FullPageOverlay labelledBy="inactive-title">
            <div>
              <h1 class="scrulk-card-title" id="inactive-title">Return to this tab</h1>
              <p class="scrulk-card-copy">The waiting period only continues while this tab is active.</p>
            </div>
          </FullPageOverlay>
        )}
        {dayState.accessFlowPhase === "waitingReady" && (
          <FullPageOverlay labelledBy="ready-title">
            <div class="scrulk-card flow-card overlay-card">
              <h1 class="scrulk-card-title" id="ready-title">Proceed</h1>
              <button
                type="button"
                class="primary"
                onClick={() => void sendCommand({ type: "access:waitContinue" })}
              >
                continue
              </button>
            </div>
          </FullPageOverlay>
        )}
      </div>
    );
  }

  return (
    <div class="gateway-cards">
      <style>{fullPageOverlayStyles}</style>
      <main class="scrulk-card flow-card">
        {dayState.accessFlowPhase === "picking" && (
          <>
            <h1 class="scrulk-card-title">Pause</h1>
            <p class="scrulk-card-copy">How much tracked-site time do you want to give yourself?</p>
            {usageStreak > 1 && <p class="scrulk-card-copy">You've used tracked sites <b>{usageStreak} days in a row.</b></p>}
            <div class="timers">
              {timerOptions.map((option) => (
                <button
                  type="button"
                  key={option.minutes}
                  onClick={() => pick(option.minutes)}
                  aria-label={option.showDownArrow
                    ? `${option.minutes} mins, below average`
                    : undefined}
                >
                  {option.minutes} mins
                  {option.showDownArrow && (
                    <span class="timer-arrow" aria-hidden="true">↘</span>
                  )}
                </button>
              ))}
            </div>
            <form class="write-in-time" onSubmit={submitCustomTime}>
              <label class="write-in-time-label" for="write-in-minutes">
                Write In Time
              </label>
              <div class="write-in-time-row">
                <div class="write-in-time-input">
                  <input
                    id="write-in-minutes"
                    type="number"
                    min="1"
                    max="29"
                    step="1"
                    required
                    value={customMinutes}
                    onInput={(event) => setCustomMinutes(event.currentTarget.value)}
                  />
                  <span>mins</span>
                </div>
                <button type="submit">submit</button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
