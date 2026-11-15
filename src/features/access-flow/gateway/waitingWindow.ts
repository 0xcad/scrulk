export const MIN_WAITING_WINDOW_WIDTH_RATIO = 0.95;
export const MIN_WAITING_WINDOW_HEIGHT_RATIO = 0.8;

export interface WaitingWindowMetrics {
  outerWidth: number;
  outerHeight: number;
  availWidth: number;
  availHeight: number;
}

export function isWaitingWindowLargeEnough({
  outerWidth,
  outerHeight,
  availWidth,
  availHeight,
}: WaitingWindowMetrics): boolean {
  return availWidth > 0 &&
    availHeight > 0 &&
    outerWidth >= availWidth * MIN_WAITING_WINDOW_WIDTH_RATIO &&
    outerHeight >= availHeight * MIN_WAITING_WINDOW_HEIGHT_RATIO;
}

export function isWaitingPageEligible(
  focused: boolean,
  largeEnough: boolean,
): boolean {
  return focused && largeEnough;
}
