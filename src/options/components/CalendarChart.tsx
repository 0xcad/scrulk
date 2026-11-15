import { useMemo, useState } from "preact/hooks";
import { type DayRecord } from "../../shared/history";
import { formatDuration } from "../../shared/wakeDay";
import { monthKey, monthNavigationBounds, shiftMonth } from "./calendarNavigation";
import { monthlyUsage, type MonthlyUsage } from "./usageTrends";
import { usageBreakdown, type UsageBreakdown } from "./UsagePie";

interface Props {
  days: DayRecord[];
  selectedDate?: string | null;
  onSelect: (date: string) => void;
  viewMonth: { year: number; month: number };
  onViewMonthChange: (m: { year: number; month: number }) => void;
  /** Epoch ms of first install. 0 = not set (no bounds enforced). */
  installedAt: number;
  showAllSitesTime: boolean;
}

interface CalendarDay {
  day: number;
  date: string;
  weekday: string;
}

const CHART_HEADROOM = 1.12;
const HOUR_MS = 60 * 60_000;
const HOUR_GUIDE_EXCLUSION_MS = 10 * 60_000;
const WEEKDAY_MARKERS = ["S", "M", "T", "W", "T", "F", "S"];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function calendarChartMaximum(
  records: DayRecord[],
  averages: MonthlyUsage,
  showAllSitesTime: boolean,
): number {
  const barMaximum = records.reduce((maximum, record) => {
    const value = displayedUsage(record, showAllSitesTime);
    return Math.max(maximum, value);
  }, 0);
  const averageMaximum = Math.max(
    averages.trackedAverageMs ?? 0,
    showAllSitesTime ? averages.allSitesAverageMs ?? 0 : 0,
  );
  return Math.max(1, barMaximum, averageMaximum) * CHART_HEADROOM;
}

export function displayedUsage(
  record: DayRecord,
  showAllSitesTime: boolean,
): number {
  return showAllSitesTime
    ? usageBreakdown(record).totalMs
    : Math.max(0, record.totalMs);
}

export interface MaximumDisplayedUsage {
  date: string;
  valueMs: number;
}

export function maximumDisplayedUsage(
  records: DayRecord[],
  showAllSitesTime: boolean,
): MaximumDisplayedUsage | null {
  let maximum: MaximumDisplayedUsage | null = null;
  for (const record of records) {
    const valueMs = displayedUsage(record, showAllSitesTime);
    if (
      valueMs > 0 &&
      (maximum === null || valueMs > maximum.valueMs ||
        (valueMs === maximum.valueMs && record.date < maximum.date))
    ) {
      maximum = { date: record.date, valueMs };
    }
  }
  return maximum;
}

export function hourGuideValues(
  maximumUsageMs: number,
  averageValuesMs: number[],
): number[] {
  const guides: number[] = [];
  for (let valueMs = HOUR_MS; valueMs <= maximumUsageMs; valueMs += HOUR_MS) {
    const isNearAverage = averageValuesMs.some(
      (averageMs) => Math.abs(averageMs - valueMs) <= HOUR_GUIDE_EXCLUSION_MS,
    );
    if (!isNearAverage) guides.push(valueMs);
  }
  return guides;
}

function percentage(value: number, maximum: number): string {
  return `${Math.max(0, Math.min(100, value / maximum * 100))}%`;
}

function barLabel(
  record: DayRecord,
  breakdown: UsageBreakdown,
  showAllSitesTime: boolean,
): string {
  if (!showAllSitesTime) {
    return `${record.date}. Tracked ${formatDuration(record.totalMs)}`;
  }
  return `${record.date}. Total ${formatDuration(breakdown.totalMs)}: tracked ${formatDuration(breakdown.trackedMs)}, focus ${formatDuration(breakdown.focusMs)}, non-focus ${formatDuration(breakdown.nonFocusMs)}`;
}

export function CalendarChart({
  days,
  selectedDate,
  onSelect,
  viewMonth,
  onViewMonthChange,
  installedAt,
  showAllSitesTime,
}: Props) {
  const [showTrackedOnly, setShowTrackedOnly] = useState(false);
  const showFullUsage = showAllSitesTime && !showTrackedOnly;
  const today = new Date();
  const todayKey = ymd(today.getFullYear(), today.getMonth(), today.getDate());
  const viewKey = monthKey(viewMonth);

  const installDate = installedAt > 0 ? new Date(installedAt) : null;
  const installMonthKey = installDate
    ? monthKey({ year: installDate.getFullYear(), month: installDate.getMonth() })
    : null;
  const installDateKey = installDate
    ? ymd(installDate.getFullYear(), installDate.getMonth(), installDate.getDate())
    : null;

  const { atInstallMonth, atCurrentMonth } = monthNavigationBounds(
    viewMonth,
    installedAt,
    today.getTime(),
  );

  const recordByDate = useMemo(() => {
    const map = new Map<string, DayRecord>();
    for (const day of days) map.set(day.date, day);
    return map;
  }, [days]);

  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
    const out: CalendarDay[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      out.push({
        day,
        date: ymd(viewMonth.year, viewMonth.month, day),
        weekday: WEEKDAY_MARKERS[
          new Date(viewMonth.year, viewMonth.month, day).getDay()
        ] ?? "",
      });
    }
    return out;
  }, [viewMonth]);

  const monthRecords = useMemo(
    () => calendarDays.flatMap(({ date }) => {
      const record = recordByDate.get(date);
      const isPreInstall =
        installDateKey !== null &&
        installMonthKey !== null &&
        viewKey === installMonthKey &&
        date < installDateKey;
      return record && !isPreInstall ? [record] : [];
    }),
    [calendarDays, installDateKey, installMonthKey, recordByDate, viewKey],
  );
  const averages = useMemo(
    () => monthlyUsage(days, viewMonth.year, viewMonth.month),
    [days, viewMonth],
  );
  const chartMaximum = calendarChartMaximum(
    monthRecords,
    averages,
    showFullUsage,
  );
  const maximum = maximumDisplayedUsage(monthRecords, showFullUsage);
  const displayedAverages = [
    averages.trackedAverageMs,
    showFullUsage ? averages.allSitesAverageMs : null,
  ].filter((value): value is number => value !== null);
  const hourGuides = hourGuideValues(maximum?.valueMs ?? 0, displayedAverages);
  const maximumDayIndex = maximum === null
    ? -1
    : calendarDays.findIndex(({ date }) => date === maximum.date);
  const flipMaximumLabel = maximumDayIndex >= calendarDays.length - 3;

  const prev = () => onViewMonthChange(shiftMonth(viewMonth, -1));
  const next = () => onViewMonthChange(shiftMonth(viewMonth, 1));
  const goToInstall = () => {
    if (installDate) {
      onViewMonthChange({ year: installDate.getFullYear(), month: installDate.getMonth() });
    }
  };
  const goToNow = () =>
    onViewMonthChange({ year: today.getFullYear(), month: today.getMonth() });

  return (
    <div class="cal">
      <div class="cal-head">
        <button
          type="button"
          onClick={goToInstall}
          disabled={atInstallMonth || installMonthKey === null}
          aria-label="First month"
        >
          «
        </button>
        <button
          type="button"
          onClick={prev}
          disabled={atInstallMonth}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span class="cal-title">{monthLabel(viewMonth.year, viewMonth.month)}</span>
        <button
          type="button"
          onClick={next}
          disabled={atCurrentMonth}
          aria-label="Next month"
        >
          ›
        </button>
        <button
          type="button"
          onClick={goToNow}
          disabled={atCurrentMonth}
          aria-label="Current month"
        >
          »
        </button>
      </div>
      <div
        class={`cal-chart${showAllSitesTime ? " has-tracked-toggle" : ""}`}
        style={{ "--cal-day-count": calendarDays.length }}
        role="group"
        aria-label={`Daily usage for ${monthLabel(viewMonth.year, viewMonth.month)}`}
      >
        <div class="cal-chart-plot">
          {hourGuides.map((valueMs) => (
            <HourGuide
              key={valueMs}
              valueMs={valueMs}
              maximum={chartMaximum}
            />
          ))}
          {showFullUsage && averages.allSitesAverageMs !== null && (
            <AverageLine
              kind="all-sites"
              label="all-sites"
              value={averages.allSitesAverageMs}
              maximum={chartMaximum}
              align="left"
            />
          )}
          {averages.trackedAverageMs !== null && (
            <AverageLine
              kind="tracked"
              label="tracked"
              value={averages.trackedAverageMs}
              maximum={chartMaximum}
              align={showFullUsage ? "right" : "left"}
            />
          )}
          {maximum !== null && maximumDayIndex >= 0 && (
            <span
              class={`cal-maximum-label${flipMaximumLabel ? " flip" : ""}`}
              style={{
                bottom: percentage(maximum.valueMs, chartMaximum),
                ...(flipMaximumLabel
                  ? {
                      right: `${(calendarDays.length - maximumDayIndex - 0.5) /
                        calendarDays.length * 100}%`,
                    }
                  : {
                      left: `${(maximumDayIndex + 0.5) /
                        calendarDays.length * 100}%`,
                    }),
              }}
              role="img"
              aria-label={`Maximum displayed usage: ${formatDuration(maximum.valueMs)} on ${maximum.date}`}
            >
              {formatDuration(maximum.valueMs)}
            </span>
          )}
          <div class="cal-day-slots">
            {calendarDays.map((calendarDay) => {
              const record = recordByDate.get(calendarDay.date);
              const breakdown = record ? usageBreakdown(record) : null;
              const displayedTotal = record
                ? displayedUsage(record, showFullUsage)
                : 0;
              const hasNotes = record?.notes !== null && record?.notes !== undefined;
              const isPreInstall =
                installDateKey !== null &&
                installMonthKey !== null &&
                viewKey === installMonthKey &&
                calendarDay.date < installDateKey;
              const classes = [
                "cal-day-slot",
                record ? "has-data" : "no-data",
                isPreInstall ? "pre-install" : "",
                calendarDay.date === todayKey ? "today" : "",
                calendarDay.date === selectedDate ? "selected" : "",
              ].filter(Boolean).join(" ");
              const label = record && breakdown
                ? barLabel(record, breakdown, showFullUsage)
                : calendarDay.date;

              return (
                <button
                  type="button"
                  class={classes}
                  disabled={!record || isPreInstall}
                  onClick={() => onSelect(calendarDay.date)}
                  aria-label={label}
                  title={breakdown ? label : undefined}
                >
                  <span class="cal-bar-area" aria-hidden="true">
                    {record && breakdown && !isPreInstall && displayedTotal > 0 && (
                      <span
                        class="cal-bar"
                        style={{ height: percentage(displayedTotal, chartMaximum) }}
                      >
                        {showFullUsage && breakdown.nonFocusMs > 0 && (
                          <span
                            class="cal-bar-segment non-focus"
                            style={{ height: percentage(breakdown.nonFocusMs, displayedTotal) }}
                          />
                        )}
                        {showFullUsage && breakdown.focusMs > 0 && (
                          <span
                            class="cal-bar-segment focus"
                            style={{ height: percentage(breakdown.focusMs, displayedTotal) }}
                          />
                        )}
                        {(!showFullUsage || breakdown.trackedMs > 0) && (
                          <span
                            class="cal-bar-segment tracked"
                            style={{ height: showFullUsage
                              ? percentage(breakdown.trackedMs, displayedTotal)
                              : "100%" }}
                          />
                        )}
                      </span>
                    )}
                  </span>
                  <span class="cal-day-label">
                    <span class="cal-day-num">{calendarDay.day}</span>
                    <span class="cal-weekday-marker" aria-hidden="true">
                      {calendarDay.weekday}
                    </span>
                    {hasNotes && !isPreInstall && (
                      <span class="cal-notes-dot" aria-hidden="true" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {showAllSitesTime && (
          <label class="cal-tracked-toggle">
            <input
              type="checkbox"
              checked={showTrackedOnly}
              onChange={(event) => setShowTrackedOnly(event.currentTarget.checked)}
            />
            Show only tracked usage
          </label>
        )}
      </div>
    </div>
  );
}

function AverageLine({
  kind,
  label,
  value,
  maximum,
  align,
}: {
  kind: "all-sites" | "tracked";
  label: string;
  value: number;
  maximum: number;
  align: "left" | "right";
}) {
  return (
    <div
      class={`cal-average-line ${kind} align-${align}`}
      style={{ bottom: percentage(value, maximum) }}
      role="img"
      aria-label={`${label} average: ${formatDuration(value)}`}
    >
      <span aria-hidden="true">{label} {formatDuration(value)}</span>
    </div>
  );
}

function HourGuide({
  valueMs,
  maximum,
}: {
  valueMs: number;
  maximum: number;
}) {
  const label = `${valueMs / HOUR_MS}h`;
  const bottom = percentage(valueMs, maximum);
  return (
    <>
      <div
        class="cal-hour-line"
        style={{ bottom }}
        aria-hidden="true"
      />
      <span
        class="cal-hour-label"
        style={{ bottom }}
        role="img"
        aria-label={`${label} usage guide`}
      >
        {label}
      </span>
    </>
  );
}
