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

      <DayStateEditor />
    </>
  );
}
