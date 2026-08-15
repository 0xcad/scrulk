import { sendCommand } from "../../../shared/messages";
import { FullPageOverlay, fullPageOverlayStyles } from "../../../shared/FullPageOverlay";
import { formatDuration } from "../../../shared/wakeDay";
import { overlayBaseStyles } from "../../../content/overlayStyles";

export function RemainingTimeOverlay({ remainingMs }: { remainingMs: number }) {
  const resume = () => {
    void sendCommand({ type: "access:resumeAllowance" });
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
