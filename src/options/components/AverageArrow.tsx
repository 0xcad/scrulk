export type AverageDirection = "up" | "down";

interface Props {
  direction: AverageDirection;
  percentage: number;
  title?: string;
  ariaLabel?: string;
}

export function shouldShowAveragePercentage(
  direction: AverageDirection,
  percentage: number,
): boolean {
  return direction === "up" || percentage < 90;
}

export function AverageArrow({ direction, percentage, title, ariaLabel }: Props) {
  const percentageLabel = `${percentage.toFixed(1)}%`;
  const showPercentage = shouldShowAveragePercentage(direction, percentage);
  const defaultAriaLabel = showPercentage
    ? `${percentageLabel} ${direction === "up" ? "higher" : "lower"}`
    : "lower";
  return (
    <span
      class={`avg-arrow ${direction}`}
      title={title}
      aria-label={ariaLabel ?? defaultAriaLabel}
    >
      {direction === "up" ? "↗" : "↘"}
      {showPercentage && (
        <small class="avg-arrow-percentage">{percentageLabel}</small>
      )}
    </span>
  );
}
