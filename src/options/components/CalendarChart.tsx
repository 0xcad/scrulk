import { useMemo } from "preact/hooks";
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
}

const CHART_HEADROOM = 1.12;

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
    const value = showAllSitesTime
      ? usageBreakdown(record).totalMs
      : Math.max(0, record.totalMs);
    return Math.max(maximum, value);
  }, 0);
  const averageMaximum = Math.max(
    averages.trackedAverageMs ?? 0,
    showAllSitesTime ? averages.allSitesAverageMs ?? 0 : 0,
  );
  return Math.max(1, barMaximum, averageMaximum) * CHART_HEADROOM;
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
      out.push({ day, date: ymd(viewMonth.year, viewMonth.month, day) });
    }
    return out;
  }, [viewMonth]);

  const monthRecords = useMemo(
    () => calendarDays.flatMap(({ date }) => {
      const record = recordByDate.get(date);
      return record ? [record] : [];
    }),
    [calendarDays, recordByDate],
  );
  const averages = useMemo(
    () => monthlyUsage(days, viewMonth.year, viewMonth.month),
    [days, viewMonth],
  );
  const chartMaximum = calendarChartMaximum(
    monthRecords,
    averages,
    showAllSitesTime,
  );

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
        class="cal-chart"
        style={{ "--cal-day-count": calendarDays.length }}
        role="group"
        aria-label={`Daily usage for ${monthLabel(viewMonth.year, viewMonth.month)}`}
      >
        <div class="cal-chart-plot">
          {showAllSitesTime && averages.allSitesAverageMs !== null && (
            <AverageLine
              kind="all-sites"
              label="all-sites"
              value={averages.allSitesAverageMs}
              maximum={chartMaximum}
            />
          )}
          {averages.trackedAverageMs !== null && (
            <AverageLine
              kind="tracked"
              label="tracked"
              value={averages.trackedAverageMs}
              maximum={chartMaximum}
            />
          )}
          <div class="cal-day-slots">
            {calendarDays.map((calendarDay) => {
              const record = recordByDate.get(calendarDay.date);
              const breakdown = record ? usageBreakdown(record) : null;
              const displayedTotal = record
                ? showAllSitesTime ? breakdown?.totalMs ?? 0 : Math.max(0, record.totalMs)
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
                ? barLabel(record, breakdown, showAllSitesTime)
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
                        {showAllSitesTime && breakdown.nonFocusMs > 0 && (
                          <span
                            class="cal-bar-segment non-focus"
                            style={{ height: percentage(breakdown.nonFocusMs, displayedTotal) }}
                          />
                        )}
                        {showAllSitesTime && breakdown.focusMs > 0 && (
                          <span
                            class="cal-bar-segment focus"
                            style={{ height: percentage(breakdown.focusMs, displayedTotal) }}
                          />
                        )}
                        {(!showAllSitesTime || breakdown.trackedMs > 0) && (
                          <span
                            class="cal-bar-segment tracked"
                            style={{ height: showAllSitesTime
                              ? percentage(breakdown.trackedMs, displayedTotal)
                              : "100%" }}
                          />
                        )}
                      </span>
                    )}
                  </span>
                  <span class="cal-day-label">
                    <span class="cal-day-num">{calendarDay.day}</span>
                    {hasNotes && !isPreInstall && (
                      <span class="cal-notes-dot" aria-hidden="true" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function AverageLine({
  kind,
  label,
  value,
  maximum,
}: {
  kind: "all-sites" | "tracked";
  label: string;
  value: number;
  maximum: number;
}) {
  return (
    <div
      class={`cal-average-line ${kind}`}
      style={{ bottom: percentage(value, maximum) }}
      role="img"
      aria-label={`${label} average: ${formatDuration(value)}`}
    >
      <span aria-hidden="true">{label}: {formatDuration(value)}</span>
    </div>
  );
}
