import type { DayRecord } from "../../shared/history";
import { formatDuration } from "../../shared/wakeDay";

export interface UsageBreakdown {
  totalMs: number;
  focusMs: number;
  trackedMs: number;
  nonFocusMs: number;
}

export function usageBreakdown(record: DayRecord): UsageBreakdown {
  const totalMs = Math.max(0, record.allSitesMs ?? record.totalMs);
  const focusMs = Math.min(totalMs, Math.max(0, record.focusMs ?? 0));
  const trackedMs = Math.min(
    Math.max(0, totalMs - focusMs),
    Math.max(0, record.totalMs),
  );
  return {
    totalMs,
    focusMs,
    trackedMs,
    nonFocusMs: Math.max(0, totalMs - focusMs - trackedMs),
  };
}

export function UsagePie({ record, large = false }: { record: DayRecord; large?: boolean }) {
  const breakdown = usageBreakdown(record);
  const total = Math.max(1, breakdown.totalMs);
  const focusEnd = breakdown.focusMs / total * 360;
  const trackedEnd = focusEnd + breakdown.trackedMs / total * 360;
  const style = breakdown.totalMs === 0
    ? { background: "color-mix(in srgb, currentColor 10%, transparent)" }
    : {
        background: `conic-gradient(
          var(--scrulk-focus) 0deg ${focusEnd}deg,
          var(--scrulk-tracked) ${focusEnd}deg ${trackedEnd}deg,
          var(--scrulk-untracked) ${trackedEnd}deg 360deg
        )`,
      };
  const label = `Total ${formatDuration(breakdown.totalMs)}: focus ${formatDuration(breakdown.focusMs)}, tracked ${formatDuration(breakdown.trackedMs)}, non-focus ${formatDuration(breakdown.nonFocusMs)}`;
  return <span class={`usage-pie${large ? " large" : ""}`} style={style} role="img" aria-label={label} title={label} />;
}

export function UsageLegend({ record }: { record: DayRecord }) {
  const breakdown = usageBreakdown(record);
  return (
    <dl class="usage-legend">
      <dt><span class="legend-dot focus" />Focus</dt>
      <dd>{formatDuration(breakdown.focusMs)}</dd>
      <dt><span class="legend-dot tracked" />Tracked</dt>
      <dd>{formatDuration(breakdown.trackedMs)}</dd>
      <dt><span class="legend-dot untracked" />Non-focus</dt>
      <dd>{formatDuration(breakdown.nonFocusMs)}</dd>
    </dl>
  );
}

