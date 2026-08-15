import browser from "webextension-polyfill";
import { FullPageOverlay, fullPageOverlayStyles } from "../shared/FullPageOverlay";
import type { Message } from "../shared/messages";
import { overlayBaseStyles } from "./overlayStyles";

export function AccessInProgressOverlay({ challengeActive }: { challengeActive: boolean }) {
  const focusChallenge = () => {
    const message: Message = { type: "access:focusPage" };
    void browser.runtime.sendMessage(message);
  };

  return (
    <>
      <style>{fullPageOverlayStyles + overlayBaseStyles}</style>
      <FullPageOverlay labelledBy="access-progress-title">
        <div class="card">
          <h2 id="access-progress-title">Continue in Other Tab</h2>
          <p>Complete the active extension tab before returning here.</p>
          {challengeActive && (
            <div class="buttons">
              <button type="button" class="secondary" onClick={focusChallenge}>
                open hold challenge
              </button>
            </div>
          )}
        </div>
      </FullPageOverlay>
    </>
  );
}
