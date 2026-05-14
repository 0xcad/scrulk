/**
 * Day-boundary math. The "day" runs from one wake-up time to the next.
 * Both functions use local time.
 */

export function currentWakeDayStart(now: number, wakeUpTime: string): number {
  const { hour, minute } = parseWakeUpTime(wakeUpTime);
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() > now) d.setDate(d.getDate() - 1);
  return d.getTime();
}

export function nextWakeUpAt(now: number, wakeUpTime: string): number {
  const { hour, minute } = parseWakeUpTime(wakeUpTime);
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

function parseWakeUpTime(s: string): { hour: number; minute: number } {
  const [h, m] = s.split(":");
  const hour = Number.parseInt(h ?? "", 10);
  const minute = Number.parseInt(m ?? "", 10);
  if (
    !Number.isFinite(hour) || hour < 0 || hour > 23 ||
    !Number.isFinite(minute) || minute < 0 || minute > 59
  ) {
    return { hour: 7, minute: 0 };
  }
  return { hour, minute };
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Coarse-grained "installed for X" string. Always two units max.
 *   < 1 minute → "just now"
 *   < 1 hour   → "12 minutes"
 *   < 1 day    → "3 hours"
 *   ≥ 1 day    → "5 days, 4 hours" (or "1 day" if no hours)
 */
export function formatUptime(ms: number): string {
  if (ms < 60_000) return "just now";
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60);
  const minutes = totalMinutes - days * 60 * 24 - hours * 60;

  if (days > 0) {
    const parts = [`${days} ${days === 1 ? "day" : "days"}`];
    if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
    return parts.join(", ");
  }
  if (hours > 0) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}
