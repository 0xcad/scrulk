import { useEffect, useState } from "preact/hooks";
import browser from "webextension-polyfill";
import { dateKey, getDay, type Regret } from "../shared/history";
import type { Message } from "../shared/messages";
import { getDayState, getSettings, onDayStateChange } from "../shared/storage";
import { DEFAULT_DAY_STATE, type DayState, effectiveMs } from "../shared/types";
import { currentWakeDayStart, formatDuration } from "../shared/wakeDay";

const REGRETS: Regret[] = [1, 2, 3, 4, 5];

function readDateFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const d = params.get("date");
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function formatDateLong(date: string): string {
  // 'YYYY-MM-DD' in local time. Avoid Date('YYYY-MM-DD') UTC parsing trap.
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const local = new Date(y, m - 1, d);
  return local.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function Survey() {
  const [date, setDate] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<string | null>(null);
  const [regret, setRegret] = useState<Regret | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  /** Was the survey already filled for this date when the page opened? */
  const [alreadyFilled, setAlreadyFilled] = useState(false);
  /** Recorded totalMs from history (used when viewing a past day). */
  const [recordTotalMs, setRecordTotalMs] = useState<number | null>(null);
  const [dayState, setDayState] = useState<DayState>(DEFAULT_DAY_STATE);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    void (async () => {
      const fromUrl = readDateFromUrl();
      const settings = await getSettings();
      const today = dateKey(currentWakeDayStart(Date.now(), settings.wakeUpTime));
      const resolved = fromUrl ?? today;
      setDate(resolved);
      setCurrentDate(today);
      const existing = await getDay(resolved);
      if (existing) {
        if (existing.regret !== null) {
          setRegret(existing.regret);
          setAlreadyFilled(true);
        }
        if (existing.notes !== null) setNotes(existing.notes);
        setRecordTotalMs(existing.totalMs);
      }
      setDayState(await getDayState());
    })();
    return onDayStateChange(setDayState);
  }, []);

  // Tick once per second so the live usage clock advances when this date is
  // the current wake-day and a tracking segment is open.
  useEffect(() => {
    if (date === null || date !== currentDate) return;
    if (dayState.activeSince === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [date, currentDate, dayState.activeSince]);

  const onSubmit = async (e: Event) => {
    e.preventDefault();
    if (date === null || regret === null || submitting) return;
    setSubmitting(true);
    const msg: Message = { type: "survey:submit", date, regret, notes };
    await browser.runtime.sendMessage(msg).catch(() => null);
    // Background closes the tab; this fallback covers manual page testing.
    window.close();
  };

  const onContinue = async () => {
    const msg: Message = { type: "survey:continue" };
    await browser.runtime.sendMessage(msg).catch(() => null);
    window.close();
  };

  if (date === null) return null;

  const isToday = date === currentDate;
  const usageMs = isToday
    ? effectiveMs(dayState, now)
    : recordTotalMs;

  return (
    <main>
      <header>
        <h1>How was {formatDateLong(date)}?</h1>
        <p class="subtitle">A quick reflection on time spent on tracked sites.</p>
      </header>

      {usageMs !== null && (
        <div class="usage">
          <span class="usage-label">Time on tracked sites</span>
          <span class="usage-value">{formatDuration(usageMs)}</span>
        </div>
      )}

      <form onSubmit={onSubmit}>
        <label>Regret level</label>
        <div class="regret" role="radiogroup" aria-label="Regret level">
          {REGRETS.map((r) => (
            <button
              type="button"
              class={r === regret ? "selected" : ""}
              aria-checked={r === regret}
              role="radio"
              onClick={() => setRegret(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <div class="regret-hint">
          <span>1 — no regret</span>
          <span>5 — strong regret</span>
        </div>

        <label for="notes" style="margin-top: 8px;">Notes (optional)</label>
        <textarea
          id="notes"
          value={notes}
          onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
          placeholder="What were you doing? What pulled you in?"
        />

        <div class="actions">
          <button
            type="submit"
            class="primary"
            disabled={regret === null || submitting}
          >
            Save
          </button>
        </div>
      </form>

      {alreadyFilled && isToday && (
        <button type="button" class="continue-link" onClick={onContinue}>
          Continue to tracked sites
        </button>
      )}
    </main>
  );
}
