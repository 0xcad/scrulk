import { useEffect, useRef, useState } from "preact/hooks";
import browser from "webextension-polyfill";
import type { Message } from "../shared/messages";
import { getDayState, getSettings } from "../shared/storage";
import type { DayState, Settings } from "../shared/types";
import { DEFAULT_DAY_STATE, liveUsageStreakCount } from "../shared/types";

const TIMER_OPTIONS = [2, 5, 10] as const;

function send(msg: Message): Promise<unknown> {
  return browser.runtime.sendMessage(msg);
}

function readParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    domain: p.get("domain") ?? "",
    dest: p.get("dest") ?? "",
    back: p.get("back"),
  };
}

export function Gateway() {
  const { domain, dest, back } = readParams();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [dayState, setDayState] = useState<DayState>(DEFAULT_DAY_STATE);
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    void getSettings().then(setSettings);
    void getDayState().then(setDayState);
  }, []);

  useEffect(() => {
    let disposed = false;
    let stream: MediaStream | null = null;
    let requestInFlight = false;

    if (!navigator.mediaDevices?.getUserMedia) return undefined;

    const pageIsActive = () =>
      document.visibilityState === "visible" && document.hasFocus();

    const stopCamera = () => {
      if (cameraRef.current !== null) cameraRef.current.srcObject = null;
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      setShowCamera(false);
    };

    const startCamera = () => {
      if (!pageIsActive() || stream !== null || requestInFlight) return;

      requestInFlight = true;
      void navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "user" } },
      }).then((nextStream) => {
        requestInFlight = false;
        if (disposed || !pageIsActive() || cameraRef.current === null) {
          nextStream.getTracks().forEach((track) => track.stop());
          return;
        }

        stream = nextStream;
        cameraRef.current.srcObject = nextStream;
        setShowCamera(true);
        void cameraRef.current.play().catch(() => null);
      }).catch(() => {
        requestInFlight = false;
        if (!disposed) setShowCamera(false);
      });
    };

    const syncCamera = () => {
      if (pageIsActive()) startCamera();
      else stopCamera();
    };

    document.addEventListener("visibilitychange", syncCamera);
    window.addEventListener("focus", syncCamera);
    window.addEventListener("blur", syncCamera);
    syncCamera();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", syncCamera);
      window.removeEventListener("focus", syncCamera);
      window.removeEventListener("blur", syncCamera);
      stopCamera();
    };
  }, []);

  const onGoBack = () => {
    if (back) {
      void send({ type: "gateway:goBack" }).catch(() => null);
      return;
    }
    // Prefer browser-back: it preserves the user's history including any
    // forward stack. Falls back to background-orchestrated navigation when
    // there's no prior entry (e.g. tab was opened fresh on TRACKED).
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    void send({ type: "gateway:goBack" }).catch(() => null);
  };

  const onPickTimer = (minutes: number) => {
    void send({
      type: "gateway:startTimer",
      domain,
      minutes,
      destUrl: dest,
    }).catch(() => null);
  };

  const usageStreak = settings !== null
    ? liveUsageStreakCount(settings.usageStreak, dayState, Date.now())
    : 0;

  return (
    <div class="gateway-cards">
      <section
        class={`card camera-card${showCamera ? "" : " camera-card--hidden"}`}
        aria-label="Camera preview"
      >
        <video ref={cameraRef} autoplay muted playsinline />
      </section>
      <main class="card">
        <h1>Pause</h1>
        <p>
          You're about to load <span class="domain">{domain || "a tracked site"}</span>.
          How long do you want to give yourself?
        </p>
        {usageStreak > 1 && (
          <p>
            You've used tracked sites <b>{usageStreak} days in a row.</b>
          </p>
        )}
        <div class="buttons">
          <button type="button" class="primary" onClick={onGoBack}>
            {back ? "I'll go back" : "I'll go back"}
          </button>
        </div>
        <div class="timers">
          {TIMER_OPTIONS.map((m) => (
            <button type="button" key={m} onClick={() => onPickTimer(m)}>
              {m} mins
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
