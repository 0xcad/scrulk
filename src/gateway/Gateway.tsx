import { useEffect, useRef, useState } from "preact/hooks";
import browser from "webextension-polyfill";
import { Challenge } from "../content/Challenge";
import { FullPageOverlay, fullPageOverlayStyles } from "../shared/FullPageOverlay";
import type { Message } from "../shared/messages";
import {
  getDayState,
  getSettings,
  onDayStateChange,
  onSettingsChange,
} from "../shared/storage";
import {
  DEFAULT_DAY_STATE,
  DEFAULT_SETTINGS,
  liveUsageStreakCount,
  type DayState,
  type Settings,
} from "../shared/types";

const TIMER_OPTIONS = [2, 5, 10] as const;
const DEFAULT_TITLE = "Scroll Unlock";
const INACTIVE_TITLE = "Return to Scroll Unlock to continue waiting";

function send(msg: Message): Promise<unknown> {
  return browser.runtime.sendMessage(msg);
}

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
    const sync = () => {
      const next = document.visibilityState === "visible" && document.hasFocus();
      setActive(next);
      if (dayState.accessFlowPhase === "waiting") {
        void send({ type: "access:setWaitingFocus", focused: next });
      }
      document.title =
        dayState.accessFlowPhase === "waiting" && !next
          ? INACTIVE_TITLE
          : DEFAULT_TITLE;
    };
    const onPageHide = () => {
      setActive(false);
      if (dayState.accessFlowPhase === "waiting") {
        void send({ type: "access:setWaitingFocus", focused: false });
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
    void send({ type: "access:chooseAllowance", minutes, destUrl: dest });
  };
  const usageStreak = liveUsageStreakCount(
    settings.usageStreak,
    dayState,
    Date.now(),
  );

  return (
    <div class="gateway-cards">
      <style>{fullPageOverlayStyles}</style>
      {dayState.accessFlowPhase === "challenge" && (
        <section class={`card camera-card${showCamera ? "" : " camera-card--hidden"}`}>
          <video ref={cameraRef} autoplay muted playsinline aria-label="Your camera preview" />
        </section>
      )}

      <main class="card">
        {(dayState.accessFlowPhase === "waiting" || dayState.accessFlowPhase === "waitingReady") && (
          <>
            <h1>Wait</h1>
            <p>Keep this tab active. Take a moment before opening tracked sites.</p>
          </>
        )}
        {dayState.accessFlowPhase === "picking" && (
          <>
            <h1>Pause</h1>
            <p>How much tracked-site time do you want to give yourself?</p>
            {usageStreak > 1 && <p>You've used tracked sites <b>{usageStreak} days in a row.</b></p>}
            <div class="timers">
              {TIMER_OPTIONS.map((minutes) => (
                <button type="button" key={minutes} onClick={() => pick(minutes)}>
                  {minutes} mins
                </button>
              ))}
            </div>
          </>
        )}
        {dayState.accessFlowPhase === "challenge" && (
          <Challenge
            onComplete={() => void send({ type: "access:challengeComplete" })}
          />
        )}
      </main>

      {dayState.accessFlowPhase === "waiting" && !active && (
        <FullPageOverlay labelledBy="inactive-title">
          <div class="card overlay-card">
            <h1 id="inactive-title">Return to this tab</h1>
            <p>The waiting period only continues while this tab is active.</p>
          </div>
        </FullPageOverlay>
      )}
      {dayState.accessFlowPhase === "waitingReady" && (
        <FullPageOverlay labelledBy="ready-title">
          <div class="card overlay-card">
            <h1 id="ready-title">You're ready</h1>
            <button
              type="button"
              class="primary"
              onClick={() => void send({ type: "access:waitContinue" })}
            >
              continue
            </button>
          </div>
        </FullPageOverlay>
      )}
    </div>
  );
}
