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
import { formatDuration } from "../../shared/wakeDay";
import {
  AverageArrow,
  type AverageDirection,
  shouldShowAveragePercentage,
} from "../components/AverageArrow";
import { CalendarPanel } from "../components/CalendarPanel";
import { percentageDifference } from "../components/usageTrends";
import {
  daysWithScrulk,
  defaultSummaryTimeframe,
  SUMMARY_TIMEFRAMES,
  summaryUsage,
  type SummaryMetric,
  type SummaryTimeframe,
} from "../components/summaryStats";
export function Home() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [state, setState] = useState<DayState>(DEFAULT_DAY_STATE);
  const [now, setNow] = useState(Date.now());
  const [days, setDays] = useState<DayRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [summaryTimeframe, setSummaryTimeframe] =
    useState<SummaryTimeframe | null>(null);

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

  const loadedDays = settings.installedAt
    ? Math.floor(Math.max(0, now - settings.installedAt) / (24 * 60 * 60_000))
    : 0;

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
  const activeSummaryTimeframe = summaryTimeframe ??
    defaultSummaryTimeframe(days, currentDate);
  const summary = summaryUsage(
    displayDays,
    currentDate,
    activeSummaryTimeframe,
  );
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
  const avgDirection: AverageDirection | null =
    avgMs === null || avgMs <= 0 || todayMs === avgMs
      ? null
      : todayMs > avgMs
        ? "up"
        : "down";
  const trackedAvgDirection: AverageDirection | null =
    trackedAvgMs === null || trackedAvgMs <= 0 || trackedMs === trackedAvgMs
      ? null
      : trackedMs > trackedAvgMs
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
              {avgDirection && avgMs !== null && (
                <DashboardAverageArrow
                  direction={avgDirection}
                  value={todayMs}
                  average={avgMs}
                />
              )}
            </span>
            <small>total</small>
          </div>
          <div class="today-time-row secondary">
            <span>
              {formatDuration(trackedMs)}
              {trackedAvgDirection && trackedAvgMs !== null && (
                <DashboardAverageArrow
                  direction={trackedAvgDirection}
                  value={trackedMs}
                  average={trackedAvgMs}
                />
              )}
            </span>
            <small class="tracked-label">tracked</small>
          </div>
          <div class="today-time-row secondary">
            <span>{formatDuration(focusMs)}</span>
            <small class="focus-label">focus</small>
          </div>
        </div>
      ) : (
        <div class="today-times">
          <div class="today-time-row primary">
            <span class="big-number">
              {formatDuration(todayMs)}
              {avgDirection && avgMs !== null && (
                <DashboardAverageArrow
                  direction={avgDirection}
                  value={todayMs}
                  average={avgMs}
                />
              )}
            </span>
            <small class="tracked-label">tracked</small>
          </div>
          <div class="today-time-row secondary">
            <span>{formatDuration(focusMs)}</span>
            <small class="focus-label">focus</small>
          </div>
        </div>
      )}
      {usageStreak > 1 && (
        <p class="streak-today">{usageStreak}-day tracked-site usage streak</p>
      )}
      <h2 class="scrulk-section-title dashboard-section-title">Summary</h2>
      <div class="summary-cards">
        <article class="summary-card days-with-scrulk-card">
          <h3>Days with Scroll Unlock</h3>
          <strong>{daysWithScrulk(days, currentDate)}</strong>
          <small
            title="How long the extension has been enabled since it was last loaded/installed. Disabling the extension resets this count."
          >
            Extension loaded for {loadedDays} {loadedDays === 1 ? "day" : "days"}
          </small>
        </article>
        <article
          class={`summary-card average-card${
            settings.alwaysShowTimer ? " has-total-time" : ""
          }`}
        >
          <SummaryAverage
            label="Avg. daily tracked time"
            metric={summary.tracked}
            timeframe={activeSummaryTimeframe}
          />
          {settings.alwaysShowTimer && (
            <SummaryAverage
              label="Avg. daily total time"
              metric={summary.allSites}
              timeframe={activeSummaryTimeframe}
            />
          )}
          <div class="summary-timeframes" aria-label="Average timeframe">
            {SUMMARY_TIMEFRAMES.map((timeframe) => (
              <button
                key={timeframe}
                type="button"
                class="summary-timeframe"
                aria-pressed={timeframe === activeSummaryTimeframe}
                onClick={() => setSummaryTimeframe(timeframe)}
              >
                {timeframe}
              </button>
            ))}
          </div>
        </article>
      </div>

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

function SummaryAverage({
  label,
  metric,
  timeframe,
}: {
  label: string;
  metric: SummaryMetric;
  timeframe: SummaryTimeframe;
}) {
  return (
    <div class="summary-average">
      <h3>{label}</h3>
      <strong>{metric.averageMs === null ? "—" : formatDuration(metric.averageMs)}</strong>
      {metric.direction && metric.previousAverageMs !== null && (
        <span
          class="trend"
          title={`Compared with previous ${timeframe} average: ${
            formatDuration(metric.previousAverageMs)
          }`}
        >
          {metric.percentage === null
            ? (
              <span
                class={`avg-arrow ${metric.direction}`}
                aria-label={metric.direction === "up" ? "higher" : "lower"}
              >
                {metric.direction === "up" ? "↗" : "↘"}
              </span>
            )
            : (
              <AverageArrow
                direction={metric.direction}
                percentage={metric.percentage}
              />
            )}
        </span>
      )}
    </div>
  );
}

function DashboardAverageArrow({
  direction,
  value,
  average,
}: {
  direction: AverageDirection;
  value: number;
  average: number;
}) {
  const aboveAverage = direction === "up";
  const percentage = percentageDifference(value, average);
  if (percentage === null) return null;
  const percentageLabel = `${percentage.toFixed(1)}%`;
  const showPercentage = shouldShowAveragePercentage(direction, percentage);
  const comparisonLabel = showPercentage ? `${percentageLabel} ` : "";
  return (
    <AverageArrow
      direction={direction}
      percentage={percentage}
      title={aboveAverage
        ? `${comparisonLabel}above your average — raising it`
        : `${comparisonLabel}below your average — lowering it`}
      ariaLabel={aboveAverage
        ? `${comparisonLabel}above average`
        : `${comparisonLabel}below average`}
    />
  );
}
