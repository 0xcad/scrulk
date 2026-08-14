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
        <div class="card">
          <h2 id="remaining-title">Welcome back</h2>
          <p>You have {formatDuration(remainingMs)} of tracked-site time remaining.</p>
          <div class="buttons">
            <button type="button" class="primary" onClick={resume}>continue</button>
          </div>
        </div>
      </FullPageOverlay>
    </>
  );
}
