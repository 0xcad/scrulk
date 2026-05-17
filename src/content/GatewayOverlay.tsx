import { useEffect, useState } from "preact/hooks";
import browser from "webextension-polyfill";
import type { Message } from "../shared/messages";
import { overlayBaseStyles } from "./overlayStyles";

const MIN_CHARS = 20;
const DISMISSED_KEY = "scrulk:gateway-dismissed";

interface Props {
  /** Called when the user has chosen to continue (overlay should unmount). */
  onDismiss: () => void;
}

function send(msg: Message): Promise<unknown> {
  return browser.runtime.sendMessage(msg);
}

/**
 * Shown the first time a tab loads a tracked site whose document.referrer
 * is not also a tracked site (or is empty). Once dismissed, sets a
 * sessionStorage flag so the same tab won't see it again until a fresh
 * navigation moves it to a different origin.
 *
 * Pauses tracking while open via `gateway:open` / `gateway:close` messages
 * (mirrors the breaktime flag).
 */
export function GatewayOverlay({ onDismiss }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    void send({ type: "gateway:open" });
    const close = () => {
      void send({ type: "gateway:close" }).catch(() => null);
    };
    window.addEventListener("pagehide", close);
    return () => {
      close();
      window.removeEventListener("pagehide", close);
    };
  }, []);

  const onGoBack = () => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore (storage blocked)
    }
    // Prefer history.back() whenever the tab has any prior entry — this
    // covers the common "search-engine → tracked-site" case even when the
    // referrer was stripped by a Referrer-Policy header. Fall back to
    // closing the tab (via background, since window.close() is blocked for
    // user-opened tabs) when this is the tab's only entry.
    if (history.length > 1) {
      history.back();
    } else {
      void send({ type: "gateway:closeTab" }).catch(() => null);
    }
  };

  const onContinue = () => {
    setExpanded(true);
  };

  const onConfirm = () => {
    if (text.length < MIN_CHARS) return;
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
    onDismiss();
  };

  const count = text.length;
  const ready = count >= MIN_CHARS;

  return (
    <>
      <style>{overlayBaseStyles}</style>
      <style>{extraStyles}</style>
      <div
        class="backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gw-title"
      >
        <div class="card">
          <h2 id="gw-title">Do you really want to proceed?</h2>
          <p>
            You're about to load a tracked website. Are you sure you wish to
            continue?
          </p>
          <div class="buttons">
            <button type="button" class="primary" onClick={onGoBack}>
              I'll go back
            </button>
            <button
              type="button"
              class="secondary"
              onClick={onContinue}
              aria-expanded={expanded}
              data-disabled={expanded}
              disabled={expanded}
            >
              Continue &gt;
            </button>
          </div>

          {expanded && (
            <div class="journal">
              <label for="gw-journal">what do you want out of this?</label>
              <textarea
                id="gw-journal"
                value={text}
                onInput={(e) =>
                  setText((e.currentTarget as HTMLTextAreaElement).value)
                }
                rows={4}
                autofocus
              />
              <div class="counter" aria-live="polite">
                {count}/{MIN_CHARS}
              </div>
              <div class="buttons">
                <button
                  type="button"
                  class="secondary"
                  onClick={onConfirm}
                  aria-disabled={!ready}
                  data-disabled={!ready}
                  disabled={!ready}
                >
                  continue
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function gatewayAlreadyDismissedInTab(): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

const extraStyles = `
  .journal {
    margin-top: 18px;
    text-align: left;
  }
  .journal label {
    display: block;
    font-family: monospace;
    text-transform: lowercase;
    font-size: 12px;
    opacity: 0.8;
    margin-bottom: 6px;
  }
  .journal textarea {
    width: 100%;
    box-sizing: border-box;
    font: inherit;
    padding: 8px;
    border: 1px solid #999;
    background: white;
    color: inherit;
    resize: vertical;
    min-height: 80px;
  }
  .journal .counter {
    font-variant-numeric: tabular-nums;
    text-align: right;
    font-size: 12px;
    opacity: 0.65;
    margin-top: 4px;
  }
`;
