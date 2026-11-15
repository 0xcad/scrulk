import type { DayRecord } from "../../shared/history";
import type { AverageDirection } from "./AverageArrow";

export type TrendDirection = AverageDirection | "same";

export interface MonthlyUsage {
  trackedAverageMs: number | null;
  allSitesAverageMs: number | null;
  dayCount: number;
}

export function trendDirection(
  value: number,
  reference: number,
  toleranceMs = 0,
): TrendDirection {
  const difference = value - reference;
  if (difference > toleranceMs) return "up";
  if (difference < -toleranceMs) return "down";
  return "same";
}

export function percentageDifference(
  value: number,
  reference: number,
): number | null {
  if (reference <= 0) return null;
  return Math.abs((value - reference) / reference) * 100;
}

export function monthlyUsage(
  days: DayRecord[],
  year: number,
  month: number,
): MonthlyUsage {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthDays = days.filter((day) => day.date.startsWith(prefix));
  if (monthDays.length === 0) {
    return { trackedAverageMs: null, allSitesAverageMs: null, dayCount: 0 };
  }

  const trackedSum = monthDays.reduce((sum, day) => sum + day.totalMs, 0);
  const allSitesDays = monthDays.filter((day) => day.allSitesMs !== undefined);
  const allSitesSum = allSitesDays.reduce(
    (sum, day) => sum + (day.allSitesMs ?? 0),
    0,
  );

  return {
    trackedAverageMs: trackedSum / monthDays.length,
    allSitesAverageMs: allSitesDays.length > 0
      ? allSitesSum / allSitesDays.length
      : null,
    dayCount: monthDays.length,
  };
}
