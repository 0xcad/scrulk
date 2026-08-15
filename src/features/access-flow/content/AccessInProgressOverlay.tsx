import { FullPageOverlay, fullPageOverlayStyles } from "../../../shared/FullPageOverlay";
import { sendCommand } from "../../../shared/messages";
import { overlayBaseStyles } from "../../../content/overlayStyles";

export function AccessInProgressOverlay({ challengeActive }: { challengeActive: boolean }) {
  const focusChallenge = () => {
    void sendCommand({ type: "access:focusPage" });
  };

  return (
    <>
      <style>{fullPageOverlayStyles + overlayBaseStyles}</style>
      <FullPageOverlay labelledBy="access-progress-title">
        <div class="scrulk-card content-card">
          <h2 class="scrulk-card-title" id="access-progress-title">Continue in Other Tab</h2>
          <p class="scrulk-card-copy">Complete the active extension tab before returning here.</p>
          {challengeActive && (
            <div class="scrulk-card-actions">
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
