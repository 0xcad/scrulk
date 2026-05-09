import { useEffect, useState } from "preact/hooks";
import { type DayRecord, getRunningAverageMs } from "../../shared/history";
import { formatDuration } from "../../shared/wakeDay";

interface Props {
  /** All loaded records, sorted ascending by date. */
  days: DayRecord[];
  /** Currently-selected date ('YYYY-MM-DD'); pass null to render placeholder. */
  selectedDate: string | null;
  onSelect: (date: string) => void;
}

function formatLong(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function trendArrow(diff: number): string {
  if (diff > 60_000) return "↑";
  if (diff < -60_000) return "↓";
  return "→";
}

/**
 * Detail drawer for one day. Shows usage / regret / notes; trend arrow
 * compares against the running average across all *other* recorded days.
 * Prev/next buttons hop to the surrounding days that have data.
 */
export function DayDrawer({ days, selectedDate, onSelect }: Props) {
  const [avgExcluding, setAvgExcluding] = useState<number | null>(null);
  const record = selectedDate
    ? days.find((d) => d.date === selectedDate) ?? null
    : null;

  useEffect(() => {
    if (selectedDate === null) {
      setAvgExcluding(null);
      return;
    }
    void getRunningAverageMs(selectedDate).then(setAvgExcluding);
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

  const diff = avgExcluding !== null ? record.totalMs - avgExcluding : 0;
  const showTrend = avgExcluding !== null && days.length > 1;

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
        <h3>{formatLong(record.date)}</h3>
        <button
          type="button"
          disabled={!next}
          onClick={() => next && onSelect(next.date)}
          aria-label="Next day with data"
        >
          →
        </button>
      </div>
      <dl>
        <dt>Time on tracked sites</dt>
        <dd>
          {formatDuration(record.totalMs)}
          {showTrend && (
            <small class="trend" title={`avg ${formatDuration(avgExcluding ?? 0)}`}>
              {" "}{trendArrow(diff)} vs avg
            </small>
          )}
        </dd>
        <dt>Regret</dt>
        <dd>{record.regret !== null ? `${record.regret} / 5` : "—"}</dd>
        <dt>Notes</dt>
        <dd class="notes">{record.notes ?? "—"}</dd>
      </dl>
    </aside>
  );
}
