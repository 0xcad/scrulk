export const SETTINGS_REMOVAL_DELAY_MS = 12 * 60 * 60 * 1000;

export function removalDeadline(now = Date.now()): number {
  return now + SETTINGS_REMOVAL_DELAY_MS;
}

export function pendingRemovalDeadline(
  pending: Record<string, number>,
  entry: string,
): number | undefined {
  if (!Object.prototype.hasOwnProperty.call(pending, entry)) return undefined;
  const deadline = pending[entry];
  return typeof deadline === "number" ? deadline : undefined;
}

export function formatRemovalCountdown(deadline: number, now: number): string {
  const remainingMs = Math.max(1, deadline - now);
  const remainingHours = remainingMs / (60 * 60 * 1000);
  if (remainingHours >= 1) {
    const hours = Math.ceil(remainingHours);
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  const minutes = Math.ceil(remainingMs / (60 * 1000));
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}
