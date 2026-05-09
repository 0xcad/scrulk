import { useEffect, useState } from "preact/hooks";
import {
  getDayState,
  getSettings,
  onDayStateChange,
  onSettingsChange,
} from "../../shared/storage";
import { DEFAULT_DAY_STATE, effectiveMs } from "../../shared/types";
import type { DayState, Settings } from "../../shared/types";
import { formatDuration, formatUptime } from "../../shared/wakeDay";

export function Home() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [state, setState] = useState<DayState>(DEFAULT_DAY_STATE);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    void getSettings().then(setSettings);
    void getDayState().then(setState);
    const offS = onSettingsChange(setSettings);
    const offD = onDayStateChange(setState);
    return () => {
      offS();
      offD();
    };
  }, []);

  useEffect(() => {
    if (state.activeSince === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.activeSince, state.totalMs]);

  if (!settings) return <section><p>Loading…</p></section>;

  const uptime = settings.installedAt
    ? formatUptime(now - settings.installedAt)
    : "—";
  const installedOn = settings.installedAt
    ? new Date(settings.installedAt).toLocaleDateString()
    : "—";

  return (
    <section>
      <h2>Today</h2>
      <p class="big-number">{formatDuration(effectiveMs(state, now))}</p>
      <p>
        <small>
          On tracked sites since {new Date(state.wakeDayStart).toLocaleString()}
          {state.activeSince !== null ? " · tracking…" : ""}
        </small>
      </p>

      <h2>Summary</h2>
      <dl>
        <dt>Tracked sites</dt>
        <dd>{settings.trackedSites.length}</dd>
        <dt>Uptime</dt>
        <dd>
          {uptime}
          {settings.installedAt ? (
            <small> (since {installedOn})</small>
          ) : null}
        </dd>
      </dl>
    </section>
  );
}
