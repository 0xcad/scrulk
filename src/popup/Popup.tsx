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
import { DEFAULT_DAY_STATE, effectiveMs } from "../shared/types";
import { formatDuration } from "../shared/wakeDay";
import { MissedSurveyBanner } from "../options/components/MissedSurveyBanner";

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
  const display = formatDuration(effectiveMs(state, now));

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

      <MissedSurveyBanner missedDate={state.missedSurveyDate} />


      <section class="usage">
        <span class="usage-label">Today</span>
        <span class="usage-time">{display}</span>
        <small>{state.activeSince !== null ? "tracking…" : "paused"}</small>
      </section>

      {displayHost ? (
        <>
          <p>
            <span class="host">{displayHost}</span>{" "}
            <span class={`status ${tracked ? "tracked" : "untracked"}`}>
              {tracked ? "tracked" : "not tracked"}
            </span>
          </p>
          {tracked ? (
            <button type="button" onClick={onRemove}>
              Remove from tracked sites
            </button>
          ) : (
            <button type="button" onClick={onAdd}>
              Add to tracked sites
            </button>
          )}
        </>
      ) : (
        <p>This page can't be tracked.</p>
      )}

      <nav>
        <button
          type="button"
          onClick={() => browser.runtime.openOptionsPage()}
        >
          Open dashboard
        </button>
      </nav>
    </main>
  );
}
