import { useEffect, useState } from "preact/hooks";
import { type DayRecord, dateKey, getAllDays } from "../../shared/history";
import { onDayStateChange } from "../../shared/storage";
import { CalendarGrid } from "../components/CalendarGrid";
import { DayDrawer } from "../components/DayDrawer";

export function Calendar() {
  const [days, setDays] = useState<DayRecord[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = () => {
    void getAllDays().then((rows) => {
      setDays(rows);
      // Default selection to today if it has data, else the most recent day.
      if (selected === null && rows.length > 0) {
        const today = dateKey(Date.now());
        const todayRow = rows.find((r) => r.date === today);
        setSelected((todayRow ?? rows[rows.length - 1])?.date ?? null);
      }
    });
  };

  useEffect(() => {
    refresh();
    // dayState changes are the proxy for "history may have updated" (survey
    // submit, day reset). IndexedDB doesn't broadcast on its own.
    return onDayStateChange(() => refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section>
      <h2>Calendar</h2>
      <CalendarGrid
        days={days}
        selectedDate={selected}
        onSelect={setSelected}
      />
      <DayDrawer days={days} selectedDate={selected} onSelect={setSelected} />
    </section>
  );
}
