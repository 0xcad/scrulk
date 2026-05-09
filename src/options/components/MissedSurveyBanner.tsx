import browser from "webextension-polyfill";
import type { Message } from "../../shared/messages";

interface Props {
  /** 'YYYY-MM-DD' of the missed wake-day, or null if none. */
  missedDate: string | null;
  /** Optional className to scope styling per host (popup vs. options). */
  className?: string;
}

function send(msg: Message): Promise<unknown> {
  return browser.runtime.sendMessage(msg);
}

function formatShort(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Surfaces an unfilled-survey reminder for the most-recent missed wake-day.
 * Click → opens survey page for that date. Dismiss → clears
 * `dayState.missedSurveyDate` without recording anything.
 */
export function MissedSurveyBanner({ missedDate, className }: Props) {
  if (missedDate === null) return null;

  const onReflect = () => {
    void send({ type: "survey:open", date: missedDate });
  };
  const onDismiss = () => {
    void send({ type: "missed:dismiss" });
  };

  return (
    <div class={`missed-survey ${className ?? ""}`} role="alert">
      <span>
        You didn't reflect on <strong>{formatShort(missedDate)}</strong>.
      </span>
      <span class="missed-actions">
        <button type="button" onClick={onReflect}>Reflect now</button>
        <button type="button" class="dismiss" aria-label="Dismiss" onClick={onDismiss}>×</button>
      </span>
    </div>
  );
}
