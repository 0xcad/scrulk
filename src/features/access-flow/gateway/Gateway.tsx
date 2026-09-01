import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { Challenge } from "../content/Challenge";
import { FullPageOverlay, fullPageOverlayStyles } from "../../../shared/FullPageOverlay";
import {
  allowanceOptions,
  completedTrackedAverageMs,
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

const DEFAULT_TITLE = "Scroll Unlock";
const INACTIVE_TITLE = "waiting timer paused ⏸️";

function destination(): string | undefined {
  return new URLSearchParams(window.location.search).get("dest") ?? undefined;
}

export function Gateway() {
  const dest = destination();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [dayState, setDayState] = useState<DayState>(DEFAULT_DAY_STATE);
  const [active, setActive] = useState(
    document.visibilityState === "visible" && document.hasFocus(),
  );
  const [showCamera, setShowCamera] = useState(false);
  const [trackedAverageMs, setTrackedAverageMs] = useState<number | null>(null);
  const cameraRef = useRef<HTMLVideoElement>(null);

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
    const sync = () => {
      const next = document.visibilityState === "visible" && document.hasFocus();
      setActive(next);
      if (dayState.accessFlowPhase === "waiting") {
        void sendCommand({ type: "access:setWaitingFocus", focused: next });
      }
      document.title =
        dayState.accessFlowPhase === "waiting" && !next
          ? INACTIVE_TITLE
          : DEFAULT_TITLE;
    };
    const onPageHide = () => {
      setActive(false);
      if (dayState.accessFlowPhase === "waiting") {
        void sendCommand({ type: "access:setWaitingFocus", focused: false });
      }
    };
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("blur", sync);
    window.addEventListener("pagehide", onPageHide);
    sync();
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("blur", sync);
      window.removeEventListener("pagehide", onPageHide);
      document.title = DEFAULT_TITLE;
    };
  }, [dayState.accessFlowPhase, dayState.wakeDayStart]);

  useEffect(() => {
    let disposed = false;
    let stream: MediaStream | null = null;
    let requestInFlight = false;
    const pageIsActive = () =>
      dayState.accessFlowPhase === "challenge" &&
      document.visibilityState === "visible" &&
      document.hasFocus();
    const stopCamera = () => {
      if (cameraRef.current) cameraRef.current.srcObject = null;
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      setShowCamera(false);
    };
    const startCamera = () => {
      if (!navigator.mediaDevices?.getUserMedia || !pageIsActive() || stream || requestInFlight) return;
      requestInFlight = true;
      void navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "user" } },
      }).then((next) => {
        requestInFlight = false;
        if (disposed || !pageIsActive() || !cameraRef.current) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = next;
        cameraRef.current.srcObject = next;
        setShowCamera(true);
        void cameraRef.current.play().catch(() => null);
      }).catch(() => {
        requestInFlight = false;
        if (!disposed) setShowCamera(false);
      });
    };
    const sync = () => pageIsActive() ? startCamera() : stopCamera();
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("blur", sync);
    sync();
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("blur", sync);
      stopCamera();
    };
  }, [dayState.accessFlowPhase]);

  const pick = (minutes: number) => {
    void sendCommand({ type: "access:chooseAllowance", minutes, destUrl: dest });
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
        <p class="scrulk-card-copy">You are about to enter a tracked site. To give you clarity on this decision, you'll have to wait first.</p>
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
        {dayState.accessFlowPhase === "waiting" && !active && (
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
      {dayState.accessFlowPhase === "challenge" && (
        <section class={`scrulk-card flow-card camera-card${showCamera ? "" : " camera-card--hidden"}`}>
          <video ref={cameraRef} autoplay muted playsinline aria-label="Your camera preview" />
        </section>
      )}

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
          </>
        )}
        {dayState.accessFlowPhase === "challenge" && (
          <Challenge
            onComplete={() => void sendCommand({ type: "access:challengeComplete" })}
          />
        )}
      </main>
    </div>
  );
}
