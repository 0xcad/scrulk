import browser from "webextension-polyfill";
import type { Message } from "../shared/messages";

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

  const onGoBack = () => {
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

  return (
    <main>
      <h1>Pause</h1>
      <p>
        You're about to load <span class="domain">{domain || "a tracked site"}</span>.
        How long do you want to give yourself?
      </p>
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
  );
}
