import { useMemo } from "preact/hooks";
import { type DayRecord } from "../../shared/history";
import { formatDuration } from "../../shared/wakeDay";
import { AverageArrow } from "./AverageArrow";
import {
  type CalendarMonth,
  monthNavigationBounds,
  shiftMonth,
} from "./calendarNavigation";
import {
  monthlyUsage,
  percentageDifference,
  trendDirection,
  type TrendDirection,
} from "./usageTrends";

interface Props {
  days: DayRecord[];
  viewMonth: CalendarMonth;
  onViewMonthChange: (month: CalendarMonth) => void;
  installedAt: number;
  showAllSitesTime: boolean;
}

export function MonthStats({
  days,
  viewMonth,
  onViewMonthChange,
  installedAt,
  showAllSitesTime,
}: Props) {
  const { current, previous, previousMonthLabel } = useMemo(() => {
    const previousMonth = new Date(viewMonth.year, viewMonth.month - 1, 1);
    return {
      current: monthlyUsage(days, viewMonth.year, viewMonth.month),
      previous: monthlyUsage(
        days,
        previousMonth.getFullYear(),
        previousMonth.getMonth(),
      ),
      previousMonthLabel: previousMonth.toLocaleDateString(undefined, {
        month: "short",
      }).replace(/\.$/, ""),
    };
  }, [days, viewMonth]);

  const monthName = new Date(viewMonth.year, viewMonth.month, 1)
    .toLocaleDateString(undefined, { month: "long" });
  const today = new Date();
  const installDate = installedAt > 0 ? new Date(installedAt) : null;
  const { atInstallMonth, atCurrentMonth } = monthNavigationBounds(
    viewMonth,
    installedAt,
    today.getTime(),
  );

  return (
    <div class="month-stats">
      <div class="month-stats-nav">
        <button
          type="button"
          disabled={atInstallMonth || installDate === null}
          onClick={() => installDate && onViewMonthChange({
            year: installDate.getFullYear(),
            month: installDate.getMonth(),
          })}
          aria-label="First month"
        >
          «
        </button>
        <button
          type="button"
          disabled={atInstallMonth}
          onClick={() => onViewMonthChange(shiftMonth(viewMonth, -1))}
          aria-label="Previous month"
        >
          ←
        </button>
        <h4 class="month-stats-title">{monthName}</h4>
        <button
          type="button"
          disabled={atCurrentMonth}
          onClick={() => onViewMonthChange(shiftMonth(viewMonth, 1))}
          aria-label="Next month"
        >
          →
        </button>
        <button
          type="button"
          disabled={atCurrentMonth}
          onClick={() => onViewMonthChange({
            year: today.getFullYear(),
            month: today.getMonth(),
          })}
          aria-label="Current month"
        >
          »
        </button>
      </div>
      {current.trackedAverageMs === null ? (
        <p class="month-stats-empty">No data</p>
      ) : (
        <>
          <dl>
            {showAllSitesTime && (
              <>
                <dt>Avg daily total time</dt>
                <dd>
                  {current.allSitesAverageMs === null
                    ? "—"
                    : formatDuration(current.allSitesAverageMs)}
                  {current.allSitesAverageMs !== null &&
                    previous.allSitesAverageMs !== null &&
                    previous.allSitesAverageMs > 0 && (
                    <MonthTrend
                      direction={trendDirection(
                        current.allSitesAverageMs,
                        previous.allSitesAverageMs,
                        60_000,
                      )}
                      valueMs={current.allSitesAverageMs}
                      previousAverageMs={previous.allSitesAverageMs}
                      previousMonthLabel={previousMonthLabel}
                    />
                  )}
                </dd>
              </>
            )}
            <dt>Avg daily {showAllSitesTime ? "tracked " : ""}time</dt>
            <dd>
              {formatDuration(current.trackedAverageMs)}
              {previous.trackedAverageMs !== null && previous.trackedAverageMs > 0 && (
                <MonthTrend
                  direction={trendDirection(
                    current.trackedAverageMs,
                    previous.trackedAverageMs,
                    60_000,
                  )}
                  valueMs={current.trackedAverageMs}
                  previousAverageMs={previous.trackedAverageMs}
                  previousMonthLabel={previousMonthLabel}
                />
              )}
            </dd>
            <dt>Days recorded</dt>
            <dd>{current.dayCount}</dd>
          </dl>
        </>
      )}
    </div>
  );
}

function MonthTrend({
  direction,
  valueMs,
  previousAverageMs,
  previousMonthLabel,
}: {
  direction: TrendDirection;
  valueMs: number;
  previousAverageMs: number;
  previousMonthLabel: string;
}) {
  const percentage = percentageDifference(valueMs, previousAverageMs);
  if (percentage === null) return null;
  return (
    <small class="trend" title={`previous month avg ${formatDuration(previousAverageMs)}`}>
      {" "}
      {direction === "same"
        ? `→ ${percentage.toFixed(1)}%`
        : <AverageArrow direction={direction} percentage={percentage} />}
      {` vs ${previousMonthLabel}.`}
    </small>
  );
}
