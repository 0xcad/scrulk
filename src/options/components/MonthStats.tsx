import { useMemo } from "preact/hooks";
import { type DayRecord } from "../../shared/history";
import { formatDuration } from "../../shared/wakeDay";

interface Props {
  days: DayRecord[];
  viewMonth: { year: number; month: number };
}

export function MonthStats({ days, viewMonth }: Props) {
  const { avg, count } = useMemo(() => {
    const prefix = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, "0")}`;
    const monthDays = days.filter((d) => d.date.startsWith(prefix));
    if (monthDays.length === 0) return { avg: null, count: 0 };
    const sum = monthDays.reduce((acc, d) => acc + d.totalMs, 0);
    return { avg: sum / monthDays.length, count: monthDays.length };
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
            <dt>Avg daily usage</dt>
            <dd>{formatDuration(avg)}</dd>
            <dt>Days recorded</dt>
            <dd>{count}</dd>
          </dl>
        </>
      )}
    </div>
  );
}
