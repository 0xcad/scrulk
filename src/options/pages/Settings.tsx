import { useEffect, useState } from "preact/hooks";
import { TrackedSitesList } from "../components/TrackedSitesList";
import { NumberField } from "../components/NumberField";
import { getSettings, onSettingsChange, setSettings } from "../../shared/storage";
import { CameraSettingsField } from "../../features/camera/CameraSettingsField";
import type { Settings as SettingsModel } from "../../shared/settings";

export function Settings() {
  return (
    <>
      <section>
        <h2 class="scrulk-section-title dashboard-section-title">Tracked websites</h2>
        <TrackedSitesList />
      </section>

      <section>
        <h2 class="scrulk-section-title dashboard-section-title">Wake up time</h2>
        <p>
          What time do you usually have to wake up? Daily usage resets when you need to wake up, not midnight.
        </p>
        <WakeUpTimeField />
      </section>

      <section>
        <h2 class="scrulk-section-title dashboard-section-title">Waiting periods</h2>
        <p>
          Choose how long the waiting screen stays active before selecting
          tracked-site time. The timer only runs while its tab is focused.
        </p>
        <WaitingDurationField
          field="initialWaitingSeconds"
          label="First wait of the day"
        />
        <WaitingDurationField
          field="repeatWaitingSeconds"
          label="Wait after each break"
        />
        <small>Set a wait to 0 to skip that waiting screen.</small>
      </section>

      <section>
        <h2 class="scrulk-section-title dashboard-section-title">Tab limit</h2>
        <p>
          You can only open this many tabs of tracked websites at once.
        </p>
        <NumberField
          field="tabLimit"
          label="Max tracked tabs"
          min={1}
          max={20}
        />
      </section>

      <section>
        <h2 class="scrulk-section-title dashboard-section-title">Peek previews</h2>
        <p>
          Open tracked links clicked on untracked websites in a temporary
          preview without starting tracked time or applying restrictions.
        </p>
        <PeekEnabledField />
      </section>

      <section>
        <h2 class="scrulk-section-title dashboard-section-title">Always show timer</h2>
        <p>
          Show your total time on all websites, even when the current site is not tracked.
        </p>
        <AlwaysShowTimerField />
      </section>

      <section>
        <h2 class="scrulk-section-title dashboard-section-title">Camera overlay</h2>
        <p>
          Show a small mirrored view of yourself on tracked websites. Scroll
          Unlock requests video-only access; the website never receives your
          camera stream. Firefox keeps a Scroll Unlock helper tab open while
          the camera is in use.
        </p>
        <CameraSettingsField />
      </section>

    </>
  );
}

type WaitingDurationKey =
  | "initialWaitingSeconds"
  | "repeatWaitingSeconds";

function WaitingDurationField({
  field,
  label,
}: {
  field: WaitingDurationKey;
  label: string;
}) {
  const [value, setValue] = useState<number | null>(null);
  const id = `setting-${field}`;

  useEffect(() => {
    void getSettings().then((settings) => setValue(settings[field]));
    return onSettingsChange((settings) => setValue(settings[field]));
  }, [field]);

  if (value === null) return <p>Loading…</p>;

  const display = formatWaitDuration(value);
  return (
    <label class="row waiting-duration-row" for={id}>
      <span>{label}</span>
      <input
        id={id}
        type="range"
        min={0}
        max={15 * 60}
        step={30}
        value={value}
        aria-valuetext={display}
        onInput={(event) => {
          const next = Number((event.target as HTMLInputElement).value);
          setValue(next);
        }}
        onChange={(event) => {
          const next = Number((event.target as HTMLInputElement).value);
          void setSettings({ [field]: next } as Partial<SettingsModel>);
        }}
      />
      <output for={id}>{display}</output>
    </label>
  );
}

function formatWaitDuration(seconds: number): string {
  if (seconds === 0) return "0 minutes (off)";
  const minutes = seconds / 60;
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

function PeekEnabledField() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    void getSettings().then((s) => setEnabled(s.peekEnabled));
    return onSettingsChange((s) => setEnabled(s.peekEnabled));
  }, []);

  if (enabled === null) return <p>Loading…</p>;

  return (
    <label class="row">
      <span>Open tracked links in Peek</span>
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => {
          const next = (e.target as HTMLInputElement).checked;
          setEnabled(next);
          void setSettings({ peekEnabled: next });
        }}
      />
    </label>
  );
}

function AlwaysShowTimerField() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    void getSettings().then((s) => setEnabled(s.alwaysShowTimer));
    return onSettingsChange((s) => setEnabled(s.alwaysShowTimer));
  }, []);

  if (enabled === null) return <p>Loading…</p>;

  return (
    <label class="row">
      <span>Always show timer</span>
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => {
          const next = (e.target as HTMLInputElement).checked;
          setEnabled(next);
          void setSettings({
            alwaysShowTimer: next,
            ...(next ? {} : { alwaysShowTimerExpanded: false }),
          });
        }}
      />
      <small>Also records and displays total time on all websites.</small>
    </label>
  );
}

function WakeUpTimeField() {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    void getSettings().then((s) => setValue(s.wakeUpTime));
    return onSettingsChange((s) => setValue(s.wakeUpTime));
  }, []);

  if (value === null) return <p>Loading…</p>;

  const commit = async (next: string) => {
    if (!/^\d{2}:\d{2}$/.test(next)) {
      const current = await getSettings();
      setValue(current.wakeUpTime);
      return;
    }
    await setSettings({ wakeUpTime: next });
  };

  return (
    <label class="row">
      <span>Wake up time</span>
      <input
        type="time"
        value={value}
        onChange={(e) => {
          const next = (e.target as HTMLInputElement).value;
          setValue(next);
          void commit(next);
        }}
      />
      <small>Local time. Day boundary for usage totals.</small>
    </label>
  );
}
