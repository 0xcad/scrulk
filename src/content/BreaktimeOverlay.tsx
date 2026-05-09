import { useState } from "preact/hooks";
import browser from "webextension-polyfill";
import type { Message } from "../shared/messages";
import { Challenge } from "./Challenge";

type Phase = "alert" | "challenge";

function send(msg: Message): Promise<unknown> {
  return browser.runtime.sendMessage(msg);
}

export function BreaktimeOverlay() {
  const [phase, setPhase] = useState<Phase>("alert");

  const onDone = () => {
    void send({ type: "breaktime:done" });
  };
  const onContinue = () => setPhase("challenge");
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

          {phase === "challenge" && <Challenge onComplete={onChallengeComplete} />}
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
    font-size: 32px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    margin: 12px 0;
    user-select: none;
    touch-action: none;
  }
  button.hold:active {
    background: #962d22;
  }
  small { opacity: 0.65; }
`;
