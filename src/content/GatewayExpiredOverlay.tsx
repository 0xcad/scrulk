import { useState } from "preact/hooks";
import browser from "webextension-polyfill";
import type { Message } from "../shared/messages";
import { overlayBaseStyles } from "./overlayStyles";

const MIN_CHARS = 20;

interface Props {
  /** The matched tracked domain this overlay is acting on. */
  domain: string;
}

function send(msg: Message): Promise<unknown> {
  return browser.runtime.sendMessage(msg);
}

/** Stop key events from reaching the host page (e.g. spacebar pausing
 * YouTube while typing in the journal). */
function stopKey(e: Event) {
  e.stopPropagation();
}

/**
 * Mounted on tracked tabs when the per-domain X-min timer has expired but
 * tabs are still open. User picks:
 *   - "I'm done"  → background back-navigates every tab on this domain.
 *   - "Continue"  → expands into two 20-char journal prompts; on submit
 *                   sets the per-domain CONTINUE flag and unmounts.
 */
export function GatewayExpiredOverlay({ domain }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const [alternativeText, setAlternativeText] = useState("");

  const onImDone = () => {
    void send({ type: "gateway:imDone", domain }).catch(() => null);
  };

  const onContinue = () => setExpanded(true);

  const onConfirm = () => {
    if (text.length < MIN_CHARS || alternativeText.length < MIN_CHARS) return;
    void send({ type: "gateway:setContinue", domain }).catch(() => null);
  };

  const count = text.length;
  const alternativeCount = alternativeText.length;
  const ready = count >= MIN_CHARS && alternativeCount >= MIN_CHARS;

  return (
    <>
      <style>{overlayBaseStyles}</style>
      <style>{extraStyles}</style>
      <div
        class="backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gw-expired-title"
      >
        <div class="card">
          <h2 id="gw-expired-title">Time's up.</h2>
          <p>Your time on <strong>{domain}</strong> is up.</p>
          <div class="buttons">
            <button type="button" class="primary" onClick={onImDone}>
              I'm done
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
                onKeyDown={stopKey}
                onKeyUp={stopKey}
                onKeyPress={stopKey}
                rows={4}
                autofocus
              />
              <div class="counter" aria-live="polite">
                {count}/{MIN_CHARS}
              </div>
              <label for="gw-alternative">
                If I could be doing anything right now, what would it be?
              </label>
              <textarea
                id="gw-alternative"
                value={alternativeText}
                onInput={(e) =>
                  setAlternativeText(
                    (e.currentTarget as HTMLTextAreaElement).value,
                  )
                }
                onKeyDown={stopKey}
                onKeyUp={stopKey}
                onKeyPress={stopKey}
                rows={4}
              />
              <div class="counter" aria-live="polite">
                {alternativeCount}/{MIN_CHARS}
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
  .journal .counter + label {
    margin-top: 14px;
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
