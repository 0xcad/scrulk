import { FullPageOverlay, fullPageOverlayStyles } from "../shared/FullPageOverlay";
import { overlayBaseStyles } from "./overlayStyles";

export function AccessInProgressOverlay() {
  return (
    <>
      <style>{fullPageOverlayStyles + overlayBaseStyles}</style>
      <FullPageOverlay labelledBy="access-progress-title">
        <div class="card">
          <h2 id="access-progress-title">Continue in Scroll Unlock</h2>
          <p>Complete the active extension tab before returning here.</p>
        </div>
      </FullPageOverlay>
    </>
  );
}
