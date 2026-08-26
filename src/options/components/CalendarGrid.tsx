import { useMemo } from "preact/hooks";
import { type DayRecord } from "../../shared/history";
import { formatDuration } from "../../shared/wakeDay";
import { UsagePie } from "./UsagePie";

interface Props {
  days: DayRecord[];
  selectedDate?: string | null;
  onSelect: (date: string) => void;
  viewMonth: { year: number; month: number };
  onViewMonthChange: (m: { year: number; month: number }) => void;
  /** Epoch ms of first install. 0 = not set (no bounds enforced). */
  installedAt: number;
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

function monthKey(year: number, month: number): string {
  return `${year}-${pad(month + 1)}`;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function CalendarGrid({
  days,
  selectedDate,
  onSelect,
  viewMonth,
  onViewMonthChange,
  installedAt,
}: Props) {
  const today = new Date();
  const todayKey = ymd(today.getFullYear(), today.getMonth(), today.getDate());
  const currentMonthKey = monthKey(today.getFullYear(), today.getMonth());
  const viewKey = monthKey(viewMonth.year, viewMonth.month);

  const installDate = installedAt > 0 ? new Date(installedAt) : null;
  const installMonthKey = installDate
    ? monthKey(installDate.getFullYear(), installDate.getMonth())
    : null;
  const installDateKey = installDate
    ? ymd(installDate.getFullYear(), installDate.getMonth(), installDate.getDate())
    : null;

  const atInstallMonth = installMonthKey !== null && viewKey <= installMonthKey;
  const atCurrentMonth = viewKey >= currentMonthKey;

  const recordByDate = useMemo(() => {
    const map = new Map<string, DayRecord>();
    for (const d of days) map.set(d.date, d);
    return map;
  }, [days]);

  const cells = useMemo(() => {
    const first = new Date(viewMonth.year, viewMonth.month, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
    const out: ({ day: number; date: string } | null)[] = [];
    for (let i = 0; i < startOffset; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ day: d, date: ymd(viewMonth.year, viewMonth.month, d) });
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [viewMonth]);

  const prev = () =>
    onViewMonthChange(
      viewMonth.month === 0
        ? { year: viewMonth.year - 1, month: 11 }
        : { ...viewMonth, month: viewMonth.month - 1 },
    );
  const next = () =>
    onViewMonthChange(
      viewMonth.month === 11
        ? { year: viewMonth.year + 1, month: 0 }
        : { ...viewMonth, month: viewMonth.month + 1 },
    );
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
      <div class="cal-grid">
        {WEEKDAYS.map((d) => (
          <div class="cal-weekday">{d}</div>
        ))}
        {cells.map((c) => {
          if (c === null) return <div class="cal-cell empty" />;
          const rec = recordByDate.get(c.date);
          const hasNotes = rec?.notes !== null && rec?.notes !== undefined;
          const isPreInstall =
            installDateKey !== null &&
            installMonthKey !== null &&
            viewKey === installMonthKey &&
            c.date < installDateKey;
          const classes = [
            "cal-cell",
            rec ? "has-data" : "no-data",
            isPreInstall ? "pre-install" : "",
            c.date === todayKey ? "today" : "",
            c.date === selectedDate ? "selected" : "",
          ].filter(Boolean).join(" ");
          return (
            <button
              type="button"
              class={classes}
              disabled={!rec || isPreInstall}
              onClick={() => onSelect(c.date)}
              aria-label={c.date}
            >
              <span class="cal-day-num">{c.day}</span>
              {rec && !isPreInstall && (
                <>
                  <UsagePie record={rec} />
                  <span class="cal-day-usage">
                    {formatDuration(rec.allSitesMs ?? rec.totalMs)}
                  </span>
                </>
              )}
              {hasNotes && !isPreInstall && (
                <span class="cal-notes-dot" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
