import { useEffect, useState } from "preact/hooks";
import browser from "webextension-polyfill";
import type { Message } from "../shared/messages";
import { getDayState, onDayStateChange } from "../shared/storage";
import { DEFAULT_DAY_STATE, type DayState, effectiveMs } from "../shared/types";
import { Challenge } from "./Challenge";

/*import windowImgPath from "../assets/window.gif";
const windowImg = browser.runtime.getURL(windowImgPath);*/

const ALERT_GATE_MS = 30_000;

type Phase = "alert" | "challenge";

function send(msg: Message): Promise<unknown> {
  return browser.runtime.sendMessage(msg);
}

function formatUsage(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes - hours * 60;
  if (hours > 0) {
    const hPart = `${hours} ${hours === 1 ? "hour" : "hours"}`;
    const mPart = `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
    return `${hPart} and ${mPart}`;
  }
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

export function BreaktimeOverlay() {
  const [phase, setPhase] = useState<Phase>("alert");
  const [continueReady, setContinueReady] = useState(false);
  const [state, setState] = useState<DayState>(DEFAULT_DAY_STATE);

  useEffect(() => {
    void getDayState().then(setState);
    return onDayStateChange(setState);
  }, []);

  useEffect(() => {
    if (phase !== "alert") return;
    const id = window.setTimeout(() => setContinueReady(true), ALERT_GATE_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  const usageMs = effectiveMs(state, Date.now());

  const onDone = () => {
    void send({ type: "breaktime:done" });
  };
  const onContinue = () => {
    if (!continueReady) return;
    setPhase("challenge");
  };
  const onChallengeComplete = () => {
    void send({ type: "breaktime:resume" });
  };

  return (
    <>
      <style>{styles}</style>
      <div class="backdrop" role="dialog" aria-modal="true" aria-labelledby="bt-title">
        <div class="card">
          {phase === "alert" && (
            <>
            {/*<img src={windowImg} class="window" alt="" />*/}
              <h2 id="bt-title">Time for a break</h2>
              <p>You've been at this for {formatUsage(usageMs)}.</p>
              <div class="buttons">
                <button type="button" class="primary" onClick={onDone}>
                  I'm done!
                </button>
                <button
                  title="this action cannot be undone"
                  type="button"
                  class="secondary"
                  onClick={onContinue}
                  aria-disabled={!continueReady}
                  data-disabled={!continueReady}
                >
                  Continue &gt;
                </button>
              </div>
            </>
          )}

          {phase === "challenge" && <Challenge onComplete={onChallengeComplete} />}
        </div>
      </div>
    </>
  );
}

const styles = `
  :host { all: initial; }
  .window {
    max-width: 100%;
  }
  .backdrop {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    background: color-mix(in srgb, currentColor 4%, Canvas);
    display: grid;
    place-items: center;
    font: 14px/1.4 system-ui, sans-serif;
    color: #111;
    --primary: #FF5733;
  }
  .card {
    background: Canvas;
    max-width: 380px;
    width: 380px;
    text-align: center;
    border: 1px dashed;
    padding: 32px 64px;
  }
  .card h2 { margin: 0 0 8px; font-size: 18px; font-family: monospace; text-transform: uppercase; }
  .card p { margin: 8px 0; }
  .big {
    font-size: 48px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    margin: 12px 0;
  }
  .buttons {
    display: flex;
    flex-flow: column;
    gap: 6px;
    justify-content: center;
    margin-top: 16px;
  }
  button {
    text-transform: lowercase;
    font: inherit;
    padding: 6px 14px;
    border: 1px solid #999;
    background: white;
    color: inherit;
    cursor: pointer;
  }
  button.primary {
    background: var(--primary);
    border-color: var(--primary);
    color: white;
    transition: 0.2s;
  }
  button.primary:hover {
    opacity: 0.9;
  }
  button.secondary {
    border: none;
    opacity: 0.7;
  }
  button.secondary:hover {
    text-decoration: underline;
  }
  button[data-disabled="true"] {
    cursor: not-allowed;
    opacity: 0.35;
  }
  button[data-disabled="true"]:hover {
    text-decoration: none;
  }
  button.hold {
    user-select: none;
    touch-action: none;
    width: 100%;
    margin: 10px 0;
  }
  button.hold:active {
    background: color-mix(in srgb, currentColor 12%, transparent);
  }
  small { opacity: 0.65; }
`;
