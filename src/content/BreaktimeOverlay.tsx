import { useEffect, useState } from "preact/hooks";
import browser from "webextension-polyfill";
import type { Message } from "../shared/messages";
import { getDayState, onDayStateChange } from "../shared/storage";
import { DEFAULT_DAY_STATE, type DayState, effectiveMs } from "../shared/types";
import { overlayBaseStyles } from "./overlayStyles";
import { FullPageOverlay, fullPageOverlayStyles } from "../shared/FullPageOverlay";

/*import windowImgPath from "../assets/window.gif";
const windowImg = browser.runtime.getURL(windowImgPath);*/

const ALERT_GATE_MS = 30_000;

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
  const [continueReady, setContinueReady] = useState(false);
  const [state, setState] = useState<DayState>(DEFAULT_DAY_STATE);

  useEffect(() => {
    void getDayState().then(setState);
    return onDayStateChange(setState);
  }, []);

  useEffect(() => {
    const sync = () => {
      setContinueReady(
        state.breakOpenedAt !== null &&
        Date.now() - state.breakOpenedAt >= ALERT_GATE_MS,
      );
    };
    sync();
    const id = window.setInterval(sync, 250);
    return () => window.clearInterval(id);
  }, [state.breakOpenedAt]);

  const usageMs = effectiveMs(state, Date.now());

  const onDone = () => {
    void send({ type: "breaktime:done" });
  };
  const onContinue = () => {
    if (!continueReady) return;
    void send({ type: "access:startChallenge" });
  };
  const onExtend = () => {
    void send({ type: "breaktime:extend" });
  };
  return (
    <>
      <style>{fullPageOverlayStyles + overlayBaseStyles}</style>
      <FullPageOverlay labelledBy="bt-title">
        <div class="card">
            {/*<img src={windowImg} class="window" alt="" />*/}
          <h2 id="bt-title">Time for a break</h2>
          <p>You've been at this for {formatUsage(usageMs)}.</p>
          <div class="buttons">
            <button type="button" class="primary" onClick={onDone}>I'm done!</button>
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
            {!state.breaktimeExtensionUsed && (
              <button type="button" class="secondary" onClick={onExtend}>
                extend for 2 minutes
              </button>
            )}
          </div>
        </div>
      </FullPageOverlay>
    </>
  );
}
