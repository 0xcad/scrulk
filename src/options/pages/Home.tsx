import { useEffect, useState } from "preact/hooks";
import { type DayRecord, dateKey, getAllDays } from "../../shared/history";
import {
  getDayState,
  getSettings,
  onDayStateChange,
  onSettingsChange,
} from "../../shared/storage";
import { DEFAULT_DAY_STATE, effectiveAllSitesMs, effectiveFocusMs, effectiveMs, liveUsageStreakCount, type DayState } from "../../shared/dayState";
import type { Settings } from "../../shared/settings";
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
    if (
      state.activeSince === null && state.allSitesActiveSince === null &&
      state.focusActiveSince === null
    ) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.activeSince, state.totalMs, state.allSitesActiveSince, state.allSitesMs, state.focusActiveSince, state.focusMs]);

  if (!settings) return <section><p>Loading…</p></section>;

  const uptime = settings.installedAt
    ? formatUptime(now - settings.installedAt)
    : "—";
  const installedOn = settings.installedAt
    ? new Date(settings.installedAt).toLocaleDateString()
    : "—";

  const trackedMs = effectiveMs(state, now);
  const allSitesMs = effectiveAllSitesMs(state, now);
  const focusMs = effectiveFocusMs(state, now);
  const currentDate = dateKey(state.wakeDayStart || Date.now());
  const existingCurrent = days.find((day) => day.date === currentDate);
  const liveCurrent = {
    date: currentDate,
    totalMs: trackedMs,
    allSitesMs,
    focusMs,
    notes: existingCurrent?.notes ?? null,
    createdAt: existingCurrent?.createdAt ?? now,
    updatedAt: now,
  };
  const displayDays = [
    ...days.filter((day) => day.date !== currentDate),
    liveCurrent,
  ].sort((a, b) => a.date.localeCompare(b.date));
  const todayMs = settings.alwaysShowTimer ? allSitesMs : trackedMs;
  const usageStreak = liveUsageStreakCount(settings.usageStreak, state, now);
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
      <h2 class="scrulk-section-title dashboard-section-title">Today</h2>
      {settings.alwaysShowTimer ? (
        <div class="today-times">
          <div class="today-time-row primary">
            <span class="big-number">
              {formatDuration(todayMs)}
              {avgDirection && <AverageArrow direction={avgDirection} />}
            </span>
            <small>total</small>
          </div>
          <div class="today-time-row secondary">
            <span>{formatDuration(trackedMs)}</span>
            <small>tracked</small>
          </div>
        </div>
      ) : (
        <p class="big-number">
          {formatDuration(todayMs)}
          {avgDirection && <AverageArrow direction={avgDirection} />}
        </p>
      )}
      {usageStreak > 1 && (
        <p class="streak-today">{usageStreak}-day tracked-site usage streak</p>
      )}
      <p class="focus-today">Focus time: {formatDuration(focusMs)}</p>

      <h2 class="scrulk-section-title dashboard-section-title">Summary</h2>
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
      </dl>

      <h2 class="scrulk-section-title dashboard-section-title">Calendar</h2>
      <CalendarPanel
        days={displayDays}
        selectedDate={selectedDate ?? dateKey(state.wakeDayStart || Date.now())}
        onSelect={setSelectedDate}
        installedAt={settings.firstInstalledAt || settings.installedAt}
        showAllSitesTime={settings.alwaysShowTimer}
      />
    </section>
  );
}

function AverageArrow({ direction }: { direction: "up" | "down" }) {
  return (
    <span
      class={`avg-arrow ${direction}`}
      title={direction === "up" ? "Above your average — raising it" : "Below your average — lowering it"}
      aria-label={direction === "up" ? "above average" : "below average"}
    >
      {direction === "up" ? "↗" : "↘"}
    </span>
  );
}
