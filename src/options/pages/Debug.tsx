import { useState } from "preact/hooks";
import {
  cloneWaitingScreen,
  DEFAULT_WAITING_SCREEN,
} from "../../features/waiting-screen/model";
import { setSettings } from "../../shared/storage";
import { NumberField } from "../components/NumberField";
import { DayStateEditor } from "./debug/DayStateEditor";

export function Debug() {
  return (
    <>
      <section>
        <h2 class="scrulk-section-title dashboard-section-title">Debug</h2>
        <p>Adjust the focused waiting period used before the first tracked-site visit.</p>
        <NumberField
          field="waitingMinutes"
          label="Initial wait"
          min={1}
          max={60}
          hint="minutes"
        />
      </section>

      <WaitingScreenReset />
      <DayStateEditor />
    </>
  );
}

function WaitingScreenReset() {
  const [resetting, setResetting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = async () => {
    if (!window.confirm("Reset the saved waiting screen? Its current content will be discarded.")) return;
    setResetting(true);
    setStatus(null);
    setError(null);
    try {
      await setSettings({ waitingScreen: cloneWaitingScreen(DEFAULT_WAITING_SCREEN) });
      setStatus("Waiting screen data reset.");
    } catch (cause: unknown) {
      setError(`Could not reset waiting screen data: ${errorMessage(cause)}`);
    } finally {
      setResetting(false);
    }
  };

  return (
    <section>
      <h2 class="scrulk-section-title dashboard-section-title">Waiting screen data</h2>
      <p>Replace the stored DGM document with the built-in waiting screen.</p>
      <div class="debug-reset-row">
        <button type="button" disabled={resetting} onClick={() => void reset()}>
          {resetting ? "resetting…" : "reset waiting screen data"}
        </button>
        <span aria-live="polite">
          {status && <small>{status}</small>}
          {error && <small class="error">{error}</small>}
        </span>
      </div>
    </section>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
