import { useEffect, useState } from "preact/hooks";
import { type DayRecord } from "../../shared/history";
import { CalendarGrid } from "./CalendarGrid";
import { DayDrawer } from "./DayDrawer";
import { MonthStats } from "./MonthStats";

interface Props {
  days: DayRecord[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
  installedAt: number;
  showAllSitesTime: boolean;
}

export function CalendarPanel({ days, selectedDate, onSelect, installedAt, showAllSitesTime }: Props) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });

  useEffect(() => {
    if (!selectedDate) return;
    const [y, m] = selectedDate.split("-").map(Number);
    if (!y || !m) return;
    setViewMonth((prev) => {
      if (prev.year === y && prev.month === m - 1) return prev;
      return { year: y, month: m - 1 };
    });
  }, [selectedDate]);

  return (
    <>
      <CalendarGrid
        days={days}
        selectedDate={selectedDate}
        onSelect={onSelect}
        viewMonth={viewMonth}
        onViewMonthChange={setViewMonth}
        installedAt={installedAt}
      />
      <div class="cal-bottom">
        <DayDrawer days={days} selectedDate={selectedDate} onSelect={onSelect} showAllSitesTime={showAllSitesTime} />
        <MonthStats days={days} viewMonth={viewMonth} showAllSitesTime={showAllSitesTime} />
      </div>
    </>
  );
}
