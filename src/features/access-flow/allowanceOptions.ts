import { dateKey, type DayRecord } from "../../shared/history";

const MIN_DYNAMIC_MINUTES = 2;
const FIXED_ALLOWANCE_MINUTES = [15, 30] as const;

export interface AllowanceOption {
  minutes: number;
  showDownArrow: boolean;
}

/** Average tracked usage across recorded wake-days before the current one. */
export function completedTrackedAverageMs(
  days: DayRecord[],
  currentWakeDayStart: number,
): number | null {
  const currentDate = dateKey(currentWakeDayStart);
  const completedDays = days.filter((day) => day.date < currentDate);
  if (completedDays.length === 0) return null;
  return completedDays.reduce((sum, day) => sum + day.totalMs, 0) /
    completedDays.length;
}

/** Build the sorted picker choices, merging a dynamic/fixed duplicate. */
export function allowanceOptions(
  averageMs: number | null,
  currentTrackedMs: number,
): AllowanceOption[] {
  const options = new Map<number, AllowanceOption>(
    FIXED_ALLOWANCE_MINUTES.map((minutes) => [
      minutes,
      { minutes, showDownArrow: false },
    ]),
  );

  if (averageMs !== null) {
    const averageMinutes = averageMs / 60_000;
    const dynamicMinutes = Math.max(
      MIN_DYNAMIC_MINUTES,
      Math.round((averageMs * 0.9 - currentTrackedMs) / 60_000),
    );
    options.set(dynamicMinutes, {
      minutes: dynamicMinutes,
      showDownArrow: dynamicMinutes < averageMinutes,
    });
  }

  return [...options.values()].sort((a, b) => a.minutes - b.minutes);
}

export function isAllowanceMinutesAllowed(
  minutes: number,
  averageMs: number | null,
  currentTrackedMs: number,
): boolean {
  return allowanceOptions(averageMs, currentTrackedMs).some(
    (option) => option.minutes === minutes,
  );
}
