import { useEffect, useState } from "preact/hooks";
import { TrackedSitesList } from "../components/TrackedSitesList";
import { NumberField } from "../components/NumberField";
import { getSettings, onSettingsChange, setSettings } from "../../shared/storage";

export function Settings() {
  return (
    <>
      <section>
        <h2>Tracked websites</h2>
        <TrackedSitesList />
      </section>

      <section>
        <h2>Wake up time</h2>
        <p>
          What time do you usually have to wake up? Daily usage resets when you need to wake up, not midnight.
        </p>
        <WakeUpTimeField />
      </section>

      <section>
        <h2>Breaktime</h2>
        <p>
          After this many minutes of accumulated tracked usage, you'll get an
          alert prompting you to take a break.
        </p>
        <NumberField
          field="breaktimeMinutes"
          label="Alert every"
          min={1}
          max={240}
          hint="minutes"
        />
      </section>

      <section>
        <h2>Tab limit</h2>
        <p>
          You can only open this many tabs of track websites at once.
        </p>
        <NumberField
          field="tabLimit"
          label="Max tracked tabs"
          min={1}
          max={20}
        />
      </section>
    </>
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
