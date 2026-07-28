import { useEffect, useState } from "preact/hooks";
import { type DayRecord, dateKey, getAllDays } from "../../shared/history";
import {
  getDayState,
  getSettings,
  onDayStateChange,
  onSettingsChange,
} from "../../shared/storage";
import { DEFAULT_DAY_STATE, effectiveAllSitesMs, effectiveMs, liveStreakCount } from "../../shared/types";
import type { DayState, Settings } from "../../shared/types";
import { formatDuration, formatUptime } from "../../shared/wakeDay";
import { CalendarPanel } from "../components/CalendarPanel";
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
    if (state.activeSince === null && state.allSitesActiveSince === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.activeSince, state.totalMs, state.allSitesActiveSince, state.allSitesMs]);

  if (!settings) return <section><p>Loading…</p></section>;

  const uptime = settings.installedAt
    ? formatUptime(now - settings.installedAt)
    : "—";
  const installedOn = settings.installedAt
    ? new Date(settings.installedAt).toLocaleDateString()
    : "—";

  const trackedMs = effectiveMs(state, now);
  const allSitesMs = effectiveAllSitesMs(state, now);
  const todayMs = settings.alwaysShowTimer ? allSitesMs : trackedMs;
  const liveStreak = liveStreakCount(settings.currentStreak, state, now);
  const trackedAvgMs = days.length > 0
    ? days.reduce((acc, d) => acc + d.totalMs, 0) / days.length
    : null;
  const allSitesDays = days.filter((d) => d.allSitesMs !== undefined);
  const allSitesAvgMs = allSitesDays.length > 0
    ? allSitesDays.reduce((acc, d) => acc + (d.allSitesMs ?? 0), 0) / allSitesDays.length
    : null;
  const avgMs = settings.alwaysShowTimer ? allSitesAvgMs : trackedAvgMs;
  const avgDirection: "up" | "down" | null =
    avgMs === null || todayMs === avgMs
      ? null
      : todayMs > avgMs
        ? "up"
        : "down";

  return (
    <section>
      <h2>Today</h2>
      {settings.alwaysShowTimer && <p><small>Time on all sites</small></p>}
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
        {settings.alwaysShowTimer && (
          <>
            <dt>Time on tracked sites today</dt>
            <dd>{formatDuration(trackedMs)}</dd>
            <dt>Average tracked time / day</dt>
            <dd>
              {trackedAvgMs === null ? "—" : formatDuration(trackedAvgMs)}
              {trackedAvgMs !== null && (
                <small> (over {days.length} {days.length === 1 ? "day" : "days"})</small>
              )}
            </dd>
          </>
        )}
        <dt>Average {settings.alwaysShowTimer ? "all-sites " : ""}time / day</dt>
        <dd>
          {avgMs !== null
            ? formatDuration(avgMs)
            : "—"}
          {avgMs !== null ? (
            <small> (over {settings.alwaysShowTimer ? allSitesDays.length : days.length} {(settings.alwaysShowTimer ? allSitesDays.length : days.length) === 1 ? "day" : "days"})</small>
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

      <h2>Calendar</h2>
      <CalendarPanel
        days={days}
        selectedDate={selectedDate ?? dateKey(state.wakeDayStart || Date.now())}
        onSelect={setSelectedDate}
        installedAt={settings.firstInstalledAt || settings.installedAt}
        showAllSitesTime={settings.alwaysShowTimer}
      />
    </section>
  );
}
