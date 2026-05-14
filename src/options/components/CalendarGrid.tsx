import { useMemo, useState } from "preact/hooks";
import { type DayRecord } from "../../shared/history";
import { formatDuration } from "../../shared/wakeDay";

interface Props {
  days: DayRecord[];
  selectedDate?: string | null;
  onSelect: (date: string) => void;
  /** Which month to focus initially. Defaults to today's month. */
  initialMonth?: { year: number; month: number };
}

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

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Hand-rolled month grid. Days with records show usage time; days with
 * notes get a small dot. Click → onSelect(date).
 */
export function CalendarGrid({ days, selectedDate, onSelect, initialMonth }: Props) {
  const today = new Date();
  const [view, setView] = useState(
    initialMonth ?? { year: today.getFullYear(), month: today.getMonth() },
  );

  const recordByDate = useMemo(() => {
    const map = new Map<string, DayRecord>();
    for (const d of days) map.set(d.date, d);
    return map;
  }, [days]);

  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    const startOffset = first.getDay(); // 0 = Sunday
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const out: ({ day: number; date: string } | null)[] = [];
    for (let i = 0; i < startOffset; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ day: d, date: ymd(view.year, view.month, d) });
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [view]);

  const todayKey = ymd(today.getFullYear(), today.getMonth(), today.getDate());

  const prev = () =>
    setView((v) =>
      v.month === 0
        ? { year: v.year - 1, month: 11 }
        : { ...v, month: v.month - 1 },
    );
  const next = () =>
    setView((v) =>
      v.month === 11
        ? { year: v.year + 1, month: 0 }
        : { ...v, month: v.month + 1 },
    );

  return (
    <div class="cal">
      <div class="cal-head">
        <button type="button" onClick={prev} aria-label="Previous month">‹</button>
        <span class="cal-title">{monthLabel(view.year, view.month)}</span>
        <button type="button" onClick={next} aria-label="Next month">›</button>
      </div>
      <div class="cal-grid">
        {WEEKDAYS.map((d) => (
          <div class="cal-weekday">{d}</div>
        ))}
        {cells.map((c) => {
          if (c === null) return <div class="cal-cell empty" />;
          const rec = recordByDate.get(c.date);
          const hasNotes = rec?.notes !== null && rec?.notes !== undefined;
          const classes = [
            "cal-cell",
            rec ? "has-data" : "no-data",
            c.date === todayKey ? "today" : "",
            c.date === selectedDate ? "selected" : "",
          ].filter(Boolean).join(" ");
          return (
            <button
              type="button"
              class={classes}
              disabled={!rec}
              onClick={() => onSelect(c.date)}
              aria-label={c.date}
            >
              <span class="cal-day-num">{c.day}</span>
              {rec && (
                <span class="cal-day-usage">{formatDuration(rec.totalMs)}</span>
              )}
              {hasNotes && (
                <span class="cal-notes-dot" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
