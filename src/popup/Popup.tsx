import { useEffect, useState } from "preact/hooks";
import browser from "webextension-polyfill";
import { hostnameOf, isTracked } from "../shared/domain";
import {
  getDayState,
  getSettings,
  onDayStateChange,
  onSettingsChange,
  setDayState,
  setSettings,
} from "../shared/storage";
import type { DayState, Settings } from "../shared/types";
import { DEFAULT_DAY_STATE, effectiveMs, STREAK_THRESHOLD_MS } from "../shared/types";
import { formatDuration } from "../shared/wakeDay";

function formatWakeTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  if (h === undefined || m === undefined || isNaN(h) || isNaN(m)) return t;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function WakeUpRow({ value }: { value: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const save = (v: string) => {
    if (/^\d{2}:\d{2}$/.test(v)) {
      void setSettings({ wakeUpTime: v });
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <p class="setting-row">
        <span class="setting-label">Wake up</span>
        <input
          type="time"
          class="wake-time-input"
          value={draft}
          autoFocus
          onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
          onBlur={(e) => save((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save((e.target as HTMLInputElement).value);
            if (e.key === "Escape") setEditing(false);
          }}
        />
      </p>
    );
  }

  return (
    <p class="setting-row">
      <span class="setting-label">Wake up</span>
      <time
        class="wake-time"
        dateTime={value}
        title="Click to edit"
        onClick={() => { setDraft(value); setEditing(true); }}
      >
        {formatWakeTime(value)}
      </time>
    </p>
  );
}

async function getActiveTabHost(): Promise<string | null> {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  return hostnameOf(tab?.url);
}

export function Popup() {
  const [settings, setLocal] = useState<Settings | null>(null);
  const [host, setHost] = useState<string | null>(null);
  const [state, setState] = useState<DayState>(DEFAULT_DAY_STATE);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    void getSettings().then(setLocal);
    void getActiveTabHost().then(setHost);
    void getDayState().then((s) => {
      setState(s);
      // Acknowledge the warning the moment the user opens the popup; we
      // keep showing it for this popup-mount via local React state.
      if (s.tabLimitWarning) {
        void setDayState({ ...s, tabLimitWarning: false });
      }
    });
    const offSettings = onSettingsChange(setLocal);
    const offState = onDayStateChange(setState);
    return () => {
      offSettings();
      offState();
    };
  }, []);

  const [warnSeen, setWarnSeen] = useState(false);
  useEffect(() => {
    if (state.tabLimitWarning) setWarnSeen(true);
  }, [state.tabLimitWarning]);

  useEffect(() => {
    if (state.activeSince === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.activeSince, state.totalMs]);

  if (!settings) {
    return (
      <main>
        <h1>Scroll Unlock</h1>
        <p>Loading…</p>
      </main>
    );
  }

  const tracked = host ? isTracked(host, settings.trackedSites) : false;
  const displayHost = host ? host.replace(/^www\./, "") : null;
  const todayMs = effectiveMs(state, now);
  const display = formatDuration(todayMs);
  const liveStreak = settings.currentStreak + (todayMs < STREAK_THRESHOLD_MS ? 1 : 0);

  const onAdd = async () => {
    if (!displayHost) return;
    if (settings.trackedSites.includes(displayHost)) return;
    await setSettings({
      trackedSites: [...settings.trackedSites, displayHost].sort(),
    });
  };

  const onRemove = async () => {
    if (!displayHost) return;
    await setSettings({
      trackedSites: settings.trackedSites.filter(
        (d) => d !== displayHost && !displayHost.endsWith("." + d),
      ),
    });
  };

  return (
    <main>
      <h1>Scroll Unlock</h1>

      {warnSeen && (
        <p class="warning" role="alert">
          You can't open more than {settings.tabLimit} tracked tabs at once.
        </p>
      )}

      <section class="usage">
        <span class="usage-label">Today</span>
        <span class="usage-time">{display}</span>
        <small>
          {state.activeSince !== null
            ? "tracking…"
            : liveStreak > 0 && todayMs < STREAK_THRESHOLD_MS
              ? `${liveStreak} 🔥`
              : "paused"}
        </small>
      </section>

      {displayHost ? (
        <>
          <p class="flex">
            <span class="host">{displayHost}</span>{" "}
            <span class={`status ${tracked ? "tracked" : "untracked"}`}>
              {tracked ? "tracked" : "not tracked"}
            </span>
            <button 
              type="button"
              class="float-right"
              onClick={tracked ? onRemove : onAdd}
              title={tracked ? "remove from tracked sites" : "add to tracked sites"}
            >
            {tracked ? "x" : "+" }
            </button>
          </p>
        </>
      ) : (
        <p>This page can't be tracked.</p>
      )}

      <section class="settings-section">
        <h2 class="settings-heading">Settings</h2>
        <WakeUpRow value={settings.wakeUpTime} />
      </section>

      <nav>
        <button
          type="button"
          onClick={() => browser.runtime.openOptionsPage()}
        >
          open dashboard ↗
        </button>
      </nav>
    </main>
  );
}
