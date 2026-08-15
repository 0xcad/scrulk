import browser from "webextension-polyfill";
import type { Message } from "../shared/messages";
import { FullPageOverlay, fullPageOverlayStyles } from "../shared/FullPageOverlay";
import { formatDuration } from "../shared/wakeDay";
import { overlayBaseStyles } from "./overlayStyles";

export function RemainingTimeOverlay({ remainingMs }: { remainingMs: number }) {
  const resume = () => {
    const message: Message = { type: "access:resumeAllowance" };
    void browser.runtime.sendMessage(message);
  };
  return (
    <>
      <style>{fullPageOverlayStyles + overlayBaseStyles}</style>
      <FullPageOverlay labelledBy="remaining-title">
        <div class="scrulk-card content-card">
          <h2 class="scrulk-card-title" id="remaining-title">Pause</h2>
          <p class="scrulk-card-copy">You have {formatDuration(remainingMs)} of tracked-site time remaining.</p>
          <div class="scrulk-card-actions">
            <button type="button" class="primary" onClick={resume}>continue</button>
          </div>
        </div>
      </FullPageOverlay>
    </>
  );
}
