import { describe, expect, it } from "vitest";
import {
  currentWakeDayStart,
  formatDuration,
  formatUptime,
  nextWakeUpAt,
} from "./wakeDay";

function localTs(year: number, month: number, day: number, hour = 0, min = 0): number {
  return new Date(year, month - 1, day, hour, min, 0, 0).getTime();
}

describe("currentWakeDayStart", () => {
  it("returns today at wake-up when after wake-up", () => {
    const now = localTs(2026, 5, 8, 14, 30);
    const start = currentWakeDayStart(now, "07:00");
    expect(new Date(start)).toEqual(new Date(localTs(2026, 5, 8, 7)));
  });

  it("returns yesterday at wake-up when before wake-up", () => {
    const now = localTs(2026, 5, 8, 3, 0);
    const start = currentWakeDayStart(now, "07:00");
    expect(new Date(start)).toEqual(new Date(localTs(2026, 5, 7, 7)));
  });

  it("treats wake-up minute exactly as a fresh day", () => {
    const now = localTs(2026, 5, 8, 7, 0);
    const start = currentWakeDayStart(now, "07:00");
    expect(new Date(start)).toEqual(new Date(localTs(2026, 5, 8, 7)));
  });

  it("honors non-zero minutes", () => {
    const before = localTs(2026, 5, 8, 7, 29);
    expect(new Date(currentWakeDayStart(before, "07:30"))).toEqual(
      new Date(localTs(2026, 5, 7, 7, 30)),
    );
    const after = localTs(2026, 5, 8, 7, 31);
    expect(new Date(currentWakeDayStart(after, "07:30"))).toEqual(
      new Date(localTs(2026, 5, 8, 7, 30)),
    );
  });

  it("falls back to 07:00 on a malformed string", () => {
    const now = localTs(2026, 5, 8, 14, 30);
    expect(new Date(currentWakeDayStart(now, "garbage"))).toEqual(
      new Date(localTs(2026, 5, 8, 7)),
    );
  });
});

describe("nextWakeUpAt", () => {
  it("returns today's wake-up when before it", () => {
    const now = localTs(2026, 5, 8, 3, 0);
    const next = nextWakeUpAt(now, "07:00");
    expect(new Date(next)).toEqual(new Date(localTs(2026, 5, 8, 7)));
  });

  it("returns tomorrow's wake-up when after it", () => {
    const now = localTs(2026, 5, 8, 9, 0);
    const next = nextWakeUpAt(now, "07:00");
    expect(new Date(next)).toEqual(new Date(localTs(2026, 5, 9, 7)));
  });

  it("rolls forward at the boundary minute", () => {
    const now = localTs(2026, 5, 8, 7, 0);
    const next = nextWakeUpAt(now, "07:00");
    expect(new Date(next)).toEqual(new Date(localTs(2026, 5, 9, 7)));
  });

  it("honors non-zero minutes", () => {
    const now = localTs(2026, 5, 8, 7, 15);
    expect(new Date(nextWakeUpAt(now, "07:30"))).toEqual(
      new Date(localTs(2026, 5, 8, 7, 30)),
    );
  });
});

describe("formatDuration", () => {
  it("shows m:ss under an hour", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(5_000)).toBe("0:05");
    expect(formatDuration(65_000)).toBe("1:05");
  });

  it("shows h:mm:ss at and over an hour", () => {
    expect(formatDuration(3_600_000)).toBe("1:00:00");
    expect(formatDuration(3_725_000)).toBe("1:02:05");
  });

  it("clamps negatives to zero", () => {
    expect(formatDuration(-1_000)).toBe("0:00");
  });
});

describe("formatUptime", () => {
  const SEC = 1000;
  const MIN = 60 * SEC;
  const HR = 60 * MIN;
  const DAY = 24 * HR;

  it("returns 'just now' under a minute", () => {
    expect(formatUptime(0)).toBe("just now");
    expect(formatUptime(45 * SEC)).toBe("just now");
  });

  it("shows minutes under an hour, with singular/plural", () => {
    expect(formatUptime(MIN)).toBe("1 minute");
    expect(formatUptime(12 * MIN)).toBe("12 minutes");
  });

  it("shows hours only under a day", () => {
    expect(formatUptime(HR)).toBe("1 hour");
    expect(formatUptime(3 * HR + 30 * MIN)).toBe("3 hours");
  });

  it("shows days + hours, dropping hours when zero", () => {
    expect(formatUptime(DAY)).toBe("1 day");
    expect(formatUptime(2 * DAY)).toBe("2 days");
    expect(formatUptime(5 * DAY + 4 * HR)).toBe("5 days, 4 hours");
    expect(formatUptime(DAY + HR)).toBe("1 day, 1 hour");
  });
});
