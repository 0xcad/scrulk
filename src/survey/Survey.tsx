import { useEffect, useState } from "preact/hooks";
import { dateKey, getDay } from "../shared/history";
import { sendCommand } from "../shared/messages";
import { getDayState, getSettings, onDayStateChange, onSettingsChange } from "../shared/storage";
import { DEFAULT_DAY_STATE, type DayState, effectiveAllSitesMs, effectiveMs } from "../shared/dayState";
import { currentWakeDayStart, formatDuration } from "../shared/wakeDay";

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
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  /** Recorded totalMs from history (used when viewing a past day). */
  const [recordTotalMs, setRecordTotalMs] = useState<number | null>(null);
  const [recordAllSitesMs, setRecordAllSitesMs] = useState<number | null>(null);
  const [alwaysShowTimer, setAlwaysShowTimer] = useState(false);
  const [dayState, setDayState] = useState<DayState>(DEFAULT_DAY_STATE);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    void (async () => {
      const fromUrl = readDateFromUrl();
      const settings = await getSettings();
      setAlwaysShowTimer(settings.alwaysShowTimer);
      const today = dateKey(currentWakeDayStart(Date.now(), settings.wakeUpTime));
      const resolved = fromUrl ?? today;
      setDate(resolved);
      setCurrentDate(today);
      const existing = await getDay(resolved);
      if (existing) {
        if (existing.notes !== null) {
          setNotes(existing.notes);
        }
        setRecordTotalMs(existing.totalMs);
        setRecordAllSitesMs(existing.allSitesMs ?? null);
      }
      setDayState(await getDayState());
    })();
    const offDayState = onDayStateChange(setDayState);
    const offSettings = onSettingsChange((s) => setAlwaysShowTimer(s.alwaysShowTimer));
    return () => {
      offDayState();
      offSettings();
    };
  }, []);

  // Tick once per second so the live usage clock advances when this date is
  // the current wake-day and a tracking segment is open.
  useEffect(() => {
    if (date === null || date !== currentDate) return;
    if (dayState.activeSince === null && dayState.allSitesActiveSince === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [date, currentDate, dayState.activeSince, dayState.allSitesActiveSince]);

  const onSubmit = async (e: Event) => {
    e.preventDefault();
    if (date === null || submitting) return;
    setSubmitting(true);
    await sendCommand({ type: "survey:submit", date, notes }).catch(() => null);
    // Background closes the tab; this fallback covers manual page testing.
    window.close();
  };

  const onContinue = async () => {
    await sendCommand({ type: "survey:continue" }).catch(() => null);
    window.close();
  };

  if (date === null) return null;

  const isToday = date === currentDate;
  const usageMs = isToday
    ? effectiveMs(dayState, now)
    : recordTotalMs;
  const allSitesUsageMs = isToday
    ? effectiveAllSitesMs(dayState, now)
    : recordAllSitesMs;

  return (
    <main class="scrulk-card survey-card">
      <header>
        <h1 class="scrulk-page-title">How was {formatDateLong(date)}?</h1>
        <p class="scrulk-page-subtitle survey-subtitle">A quick reflection on time spent.</p>
      </header>

      {alwaysShowTimer && allSitesUsageMs !== null && (
        <div class="usage">
          <span class="scrulk-label usage-label">Time on all sites</span>
          <span class="usage-value">{formatDuration(allSitesUsageMs)}</span>
        </div>
      )}

      {usageMs !== null && (
        <div class="usage">
          <span class="scrulk-label usage-label">Time on tracked sites</span>
          <span class="usage-value">{formatDuration(usageMs)}</span>
        </div>
      )}

      <form onSubmit={onSubmit}>
        <label class="scrulk-label survey-label" for="notes">Notes (optional)</label>
        <textarea
          id="notes"
          value={notes}
          onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
          placeholder="Thoughts?"
        />

        <div class="actions">
          <button
            type="submit"
            class="primary"
            disabled={submitting}
          >
            save
          </button>
        </div>
      </form>

      {isToday && dayState.popupDoneToday && !dayState.surveyContinueAllowed && (
        <button type="button" class="secondary continue-link" onClick={onContinue}>
          Continue to tracked sites
        </button>
      )}
    </main>
  );
}
