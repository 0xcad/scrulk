import { useEffect, useState } from "preact/hooks";
import { type DayRecord, dateKey, getAllDays } from "../../shared/history";
import {
  getDayState,
  getSettings,
  onDayStateChange,
  onSettingsChange,
} from "../../shared/storage";
import { DEFAULT_DAY_STATE, effectiveMs, STREAK_THRESHOLD_MS } from "../../shared/types";
import type { DayState, Settings } from "../../shared/types";
import { formatDuration, formatUptime } from "../../shared/wakeDay";
import { CalendarGrid } from "../components/CalendarGrid";
import { DayDrawer } from "../components/DayDrawer";
export function Home() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [state, setState] = useState<DayState>(DEFAULT_DAY_STATE);
  const [now, setNow] = useState(Date.now());
  const [days, setDays] = useState<DayRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const refreshDays = () => {
    void getAllDays().then(setDays);
  };

  useEffect(() => {
    void getSettings().then(setSettings);
    void getDayState().then(setState);
    refreshDays();
    const offS = onSettingsChange(setSettings);
    const offD = onDayStateChange((s) => {
      setState(s);
      refreshDays();
    });
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

  const todayMs = effectiveMs(state, now);
  const liveStreak = settings.currentStreak + (todayMs < STREAK_THRESHOLD_MS ? 1 : 0);
  const avgMs =
    days.length > 0
      ? days.reduce((acc, d) => acc + d.totalMs, 0) / days.length
      : null;
  const avgDirection: "up" | "down" | null =
    avgMs === null || todayMs === avgMs
      ? null
      : todayMs > avgMs
        ? "up"
        : "down";

  return (
    <section>
      <h2>Today</h2>
      <p class="big-number">
        {formatDuration(todayMs)}
        {avgDirection && (
          <span
            class={`avg-arrow ${avgDirection}`}
            title={
              avgDirection === "up"
                ? "Above your average — raising it"
                : "Below your average — lowering it"
            }
            aria-label={
              avgDirection === "up"
                ? "above average"
                : "below average"
            }
          >
            {avgDirection === "up" ? "↗" : "↘"}
          </span>
        )}
      </p>
      {liveStreak > 0 && (
        <p class="streak-today">{liveStreak} day streak 🔥</p>
      )}

      <h2>Summary</h2>
      <dl>
        <dt>Tracked sites</dt>
        <dd>{settings.trackedSites.length}</dd>
        <dt>Average time / day</dt>
        <dd>
          {days.length > 0
            ? formatDuration(
                days.reduce((acc, d) => acc + d.totalMs, 0) / days.length,
              )
            : "—"}
          {days.length > 0 ? (
            <small> (over {days.length} {days.length === 1 ? "day" : "days"})</small>
          ) : null}
        </dd>
        <dt>Uptime</dt>
        <dd>
          {uptime}
          {settings.installedAt ? (
            <small> (since {installedOn})</small>
          ) : null}
        </dd>
        <dt>Best Streak</dt>
        <dd>
          {settings.bestStreak > 0
            ? `${settings.bestStreak} day${settings.bestStreak !== 1 ? "s" : ""}`
            : "—"}
        </dd>
      </dl>

      <h2>This month</h2>
      <CalendarGrid
        days={days}
        selectedDate={selectedDate ?? dateKey(state.wakeDayStart || Date.now())}
        onSelect={setSelectedDate}
      />

      <DayDrawer
        days={days}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
      />
    </section>
  );
}
