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
}

export function CalendarPanel({ days, selectedDate, onSelect, installedAt }: Props) {
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
        <DayDrawer days={days} selectedDate={selectedDate} onSelect={onSelect} />
        <MonthStats days={days} viewMonth={viewMonth} />
      </div>
    </>
  );
}
