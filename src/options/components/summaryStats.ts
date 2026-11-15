import type { DayRecord } from "../../shared/history";
import type { AverageDirection } from "./AverageArrow";
import { percentageDifference } from "./usageTrends";

export type SummaryTimeframe = "1d" | "7d" | "30d" | "all";

export const SUMMARY_TIMEFRAMES: readonly SummaryTimeframe[] = [
  "1d",
  "7d",
  "30d",
  "all",
];

export interface SummaryMetric {
  averageMs: number | null;
  previousAverageMs: number | null;
  direction: AverageDirection | null;
  percentage: number | null;
}

export interface SummaryUsage {
  tracked: SummaryMetric;
  allSites: SummaryMetric;
}

const DAY_MS = 24 * 60 * 60_000;

export function daysWithScrulk(
  days: DayRecord[],
  currentDate: string,
): number {
  const firstDate = earliestDate(days);
  if (!firstDate) return 0;
  return Math.max(0, dayNumber(currentDate) - dayNumber(firstDate) + 1);
}

export function defaultSummaryTimeframe(
  days: DayRecord[],
  currentDate: string,
): SummaryTimeframe {
  const recordedDays = daysWithScrulk(days, currentDate);
  if (recordedDays >= 30) return "30d";
  if (recordedDays >= 7) return "7d";
  return "1d";
}

export function summaryUsage(
  days: DayRecord[],
  currentDate: string,
  timeframe: SummaryTimeframe,
): SummaryUsage {
  const currentDay = dayNumber(currentDate);
  const trackedStart = earliestDate(days);
  const allSitesStart = earliestDate(
    days.filter((day) => day.allSitesMs !== undefined),
  );
  const ranges = periodRanges(currentDate, timeframe);

  return {
    tracked: metricForRanges(
      days,
      currentDay,
      trackedStart,
      ranges,
      (day) => day.totalMs,
    ),
    allSites: metricForRanges(
      days,
      currentDay,
      allSitesStart,
      ranges,
      (day) => day.allSitesMs,
    ),
  };
}

interface DayRange {
  start: number;
  end: number;
}

interface PeriodRanges {
  current: DayRange;
  previous: DayRange | null;
}

function metricForRanges(
  days: DayRecord[],
  currentDay: number,
  dataStartDate: string | undefined,
  ranges: PeriodRanges,
  value: (day: DayRecord) => number | undefined,
): SummaryMetric {
  if (!dataStartDate) return emptyMetric();

  const dataStart = dayNumber(dataStartDate);
  const current = averageForRange(
    days,
    {
      start: Math.max(ranges.current.start, dataStart),
      end: Math.min(ranges.current.end, currentDay),
    },
    value,
  );
  const previous = ranges.previous !== null && dataStart <= ranges.previous.start
    ? averageForRange(days, ranges.previous, value)
    : null;

  if (current === null || previous === null || current === previous) {
    return {
      averageMs: current,
      previousAverageMs: previous,
      direction: null,
      percentage: current === null || previous === null
        ? null
        : percentageDifference(current, previous),
    };
  }

  return {
    averageMs: current,
    previousAverageMs: previous,
    direction: current > previous ? "up" : "down",
    percentage: percentageDifference(current, previous),
  };
}

function averageForRange(
  days: DayRecord[],
  range: DayRange,
  value: (day: DayRecord) => number | undefined,
): number | null {
  if (range.start > range.end) return null;
  const sum = days.reduce((total, day) => {
    const dayValue = value(day);
    const number = dayNumber(day.date);
    return number >= range.start && number <= range.end && dayValue !== undefined
      ? total + dayValue
      : total;
  }, 0);
  return sum / (range.end - range.start + 1);
}

function periodRanges(
  currentDate: string,
  timeframe: SummaryTimeframe,
): PeriodRanges {
  const end = dayNumber(currentDate);
  if (timeframe === "all") {
    return {
      current: { start: Number.NEGATIVE_INFINITY, end },
      previous: null,
    };
  }

  {
    const length = Number.parseInt(timeframe, 10);
    const start = end - length + 1;
    return {
      current: { start, end },
      previous: { start: start - length, end: start - 1 },
    };
  }
}

function emptyMetric(): SummaryMetric {
  return {
    averageMs: null,
    previousAverageMs: null,
    direction: null,
    percentage: null,
  };
}

function earliestDate(days: DayRecord[]): string | undefined {
  return days.reduce<string | undefined>(
    (earliest, day) => !earliest || day.date < earliest ? day.date : earliest,
    undefined,
  );
}

function dayNumber(date: string): number {
  const { year, month, day } = parseDateKey(date);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function parseDateKey(date: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = date.split("-").map(Number);
  return { year: year ?? 0, month: month ?? 1, day: day ?? 1 };
}
