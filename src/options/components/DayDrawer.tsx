import { useEffect, useState } from "preact/hooks";
import {
  type DayRecord,
  getRunningUsageAverages,
  type RunningUsageAverages,
} from "../../shared/history";
import { formatDuration } from "../../shared/wakeDay";
import { AverageArrow } from "./AverageArrow";
import { UsageLegend, UsagePie } from "./UsagePie";
import {
  percentageDifference,
  trendDirection,
  type TrendDirection,
} from "./usageTrends";

interface Props {
  /** All loaded records, sorted ascending by date. */
  days: DayRecord[];
  /** Currently-selected date ('YYYY-MM-DD'); pass null to render placeholder. */
  selectedDate: string | null;
  onSelect: (date: string) => void;
  showAllSitesTime: boolean;
}

function formatLong(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const parsedDate = new Date(y, m - 1, d);
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
  };

  if (parsedDate.getFullYear() !== new Date().getFullYear()) {
    options.year = "numeric";
  }
  return parsedDate.toLocaleDateString(undefined, options);
}

/**
 * Detail drawer for one day. Shows usage / notes; trend arrow
 * compares against the running average across all *other* recorded days.
 * Prev/next buttons hop to the surrounding days that have data.
 */
export function DayDrawer({ days, selectedDate, onSelect, showAllSitesTime }: Props) {
  const [averages, setAverages] = useState<RunningUsageAverages | null>(null);
  const record = selectedDate
    ? days.find((d) => d.date === selectedDate) ?? null
    : null;

  useEffect(() => {
    if (selectedDate === null) {
      setAverages(null);
      return;
    }
    let active = true;
    setAverages(null);
    void getRunningUsageAverages(selectedDate).then((next) => {
      if (active) setAverages(next);
    });
    return () => {
      active = false;
    };
  }, [selectedDate]);

  if (selectedDate === null || record === null) {
    return (
      <aside class="day-drawer empty">
        <p><small>Pick a day with data to see details.</small></p>
      </aside>
    );
  }

  const idx = days.findIndex((d) => d.date === selectedDate);
  const prev = idx > 0 ? days[idx - 1] : undefined;
  const next = idx >= 0 && idx < days.length - 1 ? days[idx + 1] : undefined;

  const trackedAverageMs = averages?.trackedMs ?? null;
  const allSitesAverageMs = averages?.allSitesMs ?? null;
  const trackedTrend = trackedAverageMs === null || trackedAverageMs <= 0
    ? null
    : trendDirection(record.totalMs, trackedAverageMs, 60_000);
  const allSitesTrend = record.allSitesMs === undefined ||
      allSitesAverageMs === null || allSitesAverageMs <= 0
    ? null
    : trendDirection(record.allSitesMs, allSitesAverageMs, 60_000);

  return (
    <aside class="day-drawer">
      <div class="day-nav">
        <button
          type="button"
          disabled={!prev}
          onClick={() => prev && onSelect(prev.date)}
          aria-label="Previous day with data"
        >
          ←
        </button>
        <h3 class="day-drawer-title">{formatLong(record.date)}</h3>
        <button
          type="button"
          disabled={!next}
          onClick={() => next && onSelect(next.date)}
          aria-label="Next day with data"
        >
          →
        </button>
      </div>
      <div class="day-usage-chart">
        <UsagePie record={record} large />
        <UsageLegend record={record} />
      </div>
      <dl>
        {showAllSitesTime && (
          <>
            <dt>Time on all sites</dt>
            <dd>
              {record.allSitesMs === undefined ? "—" : formatDuration(record.allSitesMs)}
              {allSitesTrend && allSitesAverageMs !== null && (
                <UsageTrend
                  direction={allSitesTrend}
                  valueMs={record.allSitesMs ?? 0}
                  averageMs={allSitesAverageMs}
                />
              )}
            </dd>
          </>
        )}
        <dt>Time on tracked sites</dt>
        <dd>
          {formatDuration(record.totalMs)}
          {trackedTrend && trackedAverageMs !== null && (
            <UsageTrend
              direction={trackedTrend}
              valueMs={record.totalMs}
              averageMs={trackedAverageMs}
            />
          )}
        </dd>
        <dt>Focus time</dt>
        <dd>{formatDuration(record.focusMs ?? 0)}</dd>
        <dt>Notes</dt>
        <dd class="notes">{record.notes ?? "—"}</dd>
      </dl>
    </aside>
  );
}

function UsageTrend({
  direction,
  valueMs,
  averageMs,
}: {
  direction: TrendDirection;
  valueMs: number;
  averageMs: number;
}) {
  const percentage = percentageDifference(valueMs, averageMs);
  if (percentage === null) return null;
  return (
    <small class="trend" title={`avg ${formatDuration(averageMs)}`}>
      {" "}
      {direction === "same"
        ? `→ ${percentage.toFixed(1)}%`
        : <AverageArrow direction={direction} percentage={percentage} />}
      {" vs avg"}
    </small>
  );
}
