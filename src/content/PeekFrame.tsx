import browser from "webextension-polyfill";
import type { Message } from "../shared/messages";
import { makePeekUrl, PEEK_TOP_TOKEN_KEY } from "../shared/peek";
import type { PeekSession } from "../shared/types";

interface Props {
  session: PeekSession;
}

function persistTopToken(token: string | null): void {
  try {
    if (token === null) sessionStorage.removeItem(PEEK_TOP_TOKEN_KEY);
    else sessionStorage.setItem(PEEK_TOP_TOKEN_KEY, token);
  } catch {
    // Storage can be unavailable on privacy-restricted pages.
  }
}

export function PeekFrame({ session }: Props) {
  const finish = (type: "peek:close" | "peek:promote") => {
    persistTopToken(null);
    const message: Message = { type, token: session.token };
    void browser.runtime.sendMessage(message).then((accepted) => {
      if (accepted !== true) persistTopToken(session.token);
    }).catch(() => {
      persistTopToken(session.token);
    });
  };

  return (
    <>
      <style>{styles}</style>
      <div
        class="peek-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Tracked-site Peek preview"
      >
        <div class="peek-panel">
          <iframe
            src={makePeekUrl(session.destUrl, session.token)}
            title={`Peek preview of ${session.domain}`}
            sandbox="allow-forms allow-modals allow-presentation allow-same-origin allow-scripts"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
        <nav class="peek-controls" aria-label="Peek controls">
          <button
            type="button"
            aria-label="Close Peek"
            title="Close Peek"
            onClick={() => finish("peek:close")}
          >
            ×
          </button>
          <button
            type="button"
            aria-label="Open tracked site"
            title="Open tracked site"
            onClick={() => finish("peek:promote")}
          >
            →
          </button>
        </nav>
      </div>
    </>
  );
}

const styles = `
  .peek-backdrop {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    background: rgba(15, 23, 42, 0.18);
    backdrop-filter: blur(1px);
    font-family: system-ui, sans-serif;
  }
  .peek-panel {
    position: fixed;
    top: 12px;
    right: 58px;
    bottom: 12px;
    left: max(12px, 6vw);
    overflow: hidden;
    background: white;
    border: 1px solid rgba(20, 35, 45, 0.2);
    border-radius: 9px;
    box-shadow: 0 12px 38px rgba(15, 23, 42, 0.28);
  }
  .peek-panel iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    background: white;
  }
  .peek-controls {
    position: fixed;
    top: 14px;
    right: 10px;
    width: 36px;
    display: grid;
    gap: 8px;
  }
  .peek-controls button {
    box-sizing: border-box;
    width: 34px;
    height: 34px;
    padding: 0;
    display: grid;
    place-items: center;
    border: 1px solid rgba(20, 50, 65, 0.18);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.96);
    color: #39738b;
    box-shadow: 0 2px 5px rgba(15, 45, 60, 0.18);
    font: 600 22px/1 system-ui, sans-serif;
    cursor: pointer;
  }
  .peek-controls button:hover { background: white; color: #174e65; }
  .peek-controls button:focus-visible {
    outline: 2px solid #174e65;
    outline-offset: 2px;
  }
  @media (max-width: 520px), (max-height: 420px) {
    .peek-panel { top: 8px; right: 48px; bottom: 8px; left: 8px; }
    .peek-controls { top: 10px; right: 6px; width: 32px; }
    .peek-controls button { width: 30px; height: 30px; font-size: 19px; }
  }
`;
