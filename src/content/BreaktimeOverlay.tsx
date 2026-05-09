import { useEffect, useRef, useState } from "preact/hooks";
import browser from "webextension-polyfill";
import type { Message } from "../shared/messages";

const WAIT_MS = 30_000;
const HOLD_MS = 30_000;

type Phase = "alert" | "wait" | "hold";

function send(msg: Message): Promise<unknown> {
  return browser.runtime.sendMessage(msg);
}

export function BreaktimeOverlay() {
  const [phase, setPhase] = useState<Phase>("alert");
  // ms remaining in the current sub-timer (wait or hold). -1 when inactive.
  const [remaining, setRemaining] = useState(-1);

  // Wait phase: 30s countdown to hold phase.
  useEffect(() => {
    if (phase !== "wait") return;
    const startedAt = Date.now();
    setRemaining(WAIT_MS);
    const id = setInterval(() => {
      const left = WAIT_MS - (Date.now() - startedAt);
      if (left <= 0) {
        clearInterval(id);
        setPhase("hold");
      } else {
        setRemaining(left);
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  // Hold phase: 30s of accumulated press time. Releasing pauses; pressing
  // again resumes from where it left off. Only the wait phase is one-shot.
  const heldMs = useRef(0);
  const heldSince = useRef<number | null>(null);
  const holdTimer = useRef<number | null>(null);

  const onHoldStart = (e: PointerEvent) => {
    if (phase !== "hold") return;
    if (heldSince.current !== null) return; // already pressing
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    heldSince.current = Date.now();
    setRemaining(HOLD_MS - heldMs.current);
    holdTimer.current = window.setInterval(() => {
      const since = heldSince.current;
      if (since === null) return;
      const left = HOLD_MS - heldMs.current - (Date.now() - since);
      if (left <= 0) {
        if (holdTimer.current !== null) clearInterval(holdTimer.current);
        holdTimer.current = null;
        heldSince.current = null;
        heldMs.current = 0;
        void send({ type: "breaktime:resume" });
      } else {
        setRemaining(left);
      }
    }, 100);
  };

  const onHoldEnd = () => {
    if (phase !== "hold") return;
    const since = heldSince.current;
    if (since === null) return;
    heldMs.current = Math.min(HOLD_MS, heldMs.current + (Date.now() - since));
    heldSince.current = null;
    if (holdTimer.current !== null) clearInterval(holdTimer.current);
    holdTimer.current = null;
    setRemaining(HOLD_MS - heldMs.current);
  };

  const onDone = () => {
    void send({ type: "breaktime:done" });
  };
  const onContinue = () => setPhase("wait");

  return (
    <>
      <style>{styles}</style>
      <div class="backdrop" role="dialog" aria-modal="true" aria-labelledby="bt-title">
        <div class="card">
          {phase === "alert" && (
            <>
              <h2 id="bt-title">Time for a break</h2>
              <p>You've been on tracked websites for a while. Want to step away?</p>
              <div class="row">
                <button type="button" class="primary" onClick={onDone}>
                  I'm done!
                </button>
                <button type="button" onClick={onContinue}>
                  Continue
                </button>
              </div>
            </>
          )}

          {phase === "wait" && (
            <>
              <h2 id="bt-title">Wait a moment</h2>
              <p class="big">{Math.ceil(remaining / 1000)}s</p>
              <p>
                <small>Then you'll need to hold a button for 30 seconds.</small>
              </p>
            </>
          )}

          {phase === "hold" && (
            <>
              <h2 id="bt-title">Hold to continue</h2>
              <button
                type="button"
                class="hold"
                onPointerDown={onHoldStart}
                onPointerUp={onHoldEnd}
                onPointerCancel={onHoldEnd}
                onPointerLeave={onHoldEnd}
              >
                Hold
              </button>
              <p>
                <small>Release to pause; press again to keep going.</small>
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}

const styles = `
  :host { all: initial; }
  .backdrop {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    background: rgba(0, 0, 0, 0.65);
    display: grid;
    place-items: center;
    font: 14px/1.4 system-ui, sans-serif;
    color: #111;
  }
  .card {
    background: white;
    padding: 28px 32px;
    border-radius: 12px;
    max-width: 380px;
    text-align: center;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  }
  .card h2 { margin: 0 0 8px; font-size: 18px; }
  .card p { margin: 8px 0; }
  .big {
    font-size: 48px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    margin: 12px 0;
  }
  .row {
    display: flex;
    gap: 8px;
    justify-content: center;
    margin-top: 16px;
  }
  button {
    font: inherit;
    padding: 8px 14px;
    border-radius: 6px;
    border: 1px solid #999;
    background: white;
    color: inherit;
    cursor: pointer;
  }
  button.primary {
    background: #c0392b;
    border-color: #c0392b;
    color: white;
  }
  button.hold {
    width: 160px;
    height: 160px;
    border-radius: 50%;
    background: #c0392b;
    border-color: #c0392b;
    color: white;
    font-size: 18px;
    font-weight: 600;
    margin: 12px 0;
    user-select: none;
    touch-action: none;
  }
  button.hold:active {
    background: #962d22;
  }
  small { opacity: 0.65; }
`;
