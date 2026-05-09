import { useEffect, useState } from "preact/hooks";
import browser from "webextension-polyfill";
import { dateKey, getDay, type Regret } from "../shared/history";
import type { Message } from "../shared/messages";
import { getSettings } from "../shared/storage";
import { currentWakeDayStart } from "../shared/wakeDay";

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
  const [regret, setRegret] = useState<Regret | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      const fromUrl = readDateFromUrl();
      const resolved =
        fromUrl ??
        dateKey(
          currentWakeDayStart(Date.now(), (await getSettings()).wakeUpTime),
        );
      setDate(resolved);
      const existing = await getDay(resolved);
      if (existing) {
        if (existing.regret !== null) setRegret(existing.regret);
        if (existing.notes !== null) setNotes(existing.notes);
      }
    })();
  }, []);

  const onSubmit = async (e: Event) => {
    e.preventDefault();
    if (date === null || regret === null || submitting) return;
    setSubmitting(true);
    const msg: Message = { type: "survey:submit", date, regret, notes };
    await browser.runtime.sendMessage(msg).catch(() => null);
    // Background closes the tab; this fallback covers manual page testing.
    window.close();
  };

  if (date === null) return null;

  return (
    <main>
      <header>
        <h1>How was {formatDateLong(date)}?</h1>
        <p class="subtitle">A quick reflection on time spent on tracked sites.</p>
      </header>

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
    </main>
  );
}
