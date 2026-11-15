export interface CalendarMonth {
  year: number;
  month: number;
}

export function monthKey({ year, month }: CalendarMonth): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function shiftMonth(
  viewMonth: CalendarMonth,
  offset: -1 | 1,
): CalendarMonth {
  const shifted = new Date(viewMonth.year, viewMonth.month + offset, 1);
  return { year: shifted.getFullYear(), month: shifted.getMonth() };
}

export function monthNavigationBounds(
  viewMonth: CalendarMonth,
  installedAt: number,
  now = Date.now(),
): { atInstallMonth: boolean; atCurrentMonth: boolean } {
  const viewKey = monthKey(viewMonth);
  const today = new Date(now);
  const currentMonthKey = monthKey({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const installDate = installedAt > 0 ? new Date(installedAt) : null;
  const installMonthKey = installDate
    ? monthKey({ year: installDate.getFullYear(), month: installDate.getMonth() })
    : null;

  return {
    atInstallMonth: installMonthKey !== null && viewKey <= installMonthKey,
    atCurrentMonth: viewKey >= currentMonthKey,
  };
}
