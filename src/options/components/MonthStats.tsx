import { useMemo } from "preact/hooks";
import { type DayRecord } from "../../shared/history";
import { formatDuration } from "../../shared/wakeDay";

interface Props {
  days: DayRecord[];
  viewMonth: { year: number; month: number };
  showAllSitesTime: boolean;
}

export function MonthStats({ days, viewMonth, showAllSitesTime }: Props) {
  const { avg, allSitesAvg, count } = useMemo(() => {
    const prefix = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, "0")}`;
    const monthDays = days.filter((d) => d.date.startsWith(prefix));
    if (monthDays.length === 0) return { avg: null, allSitesAvg: null, count: 0 };
    const sum = monthDays.reduce((acc, d) => acc + d.totalMs, 0);
    const allSitesDays = monthDays.filter((d) => d.allSitesMs !== undefined);
    const allSitesSum = allSitesDays.reduce((acc, d) => acc + (d.allSitesMs ?? 0), 0);
    return {
      avg: sum / monthDays.length,
      allSitesAvg: allSitesDays.length > 0 ? allSitesSum / allSitesDays.length : null,
      count: monthDays.length,
    };
  }, [days, viewMonth]);

  const monthName = new Date(viewMonth.year, viewMonth.month, 1).toLocaleDateString(undefined, { month: "long" });

  return (
    <div class="month-stats">
      <h4>{monthName}</h4>
      {avg === null ? (
        <p class="month-stats-empty">No data</p>
      ) : (
        <>
          <dl>
            {showAllSitesTime && (
              <>
                <dt>Avg all-sites time</dt>
                <dd>{allSitesAvg === null ? "—" : formatDuration(allSitesAvg)}</dd>
              </>
            )}
            <dt>Avg {showAllSitesTime ? "tracked " : ""}daily usage</dt>
            <dd>{formatDuration(avg)}</dd>
            <dt>Days recorded</dt>
            <dd>{count}</dd>
          </dl>
        </>
      )}
    </div>
  );
}
