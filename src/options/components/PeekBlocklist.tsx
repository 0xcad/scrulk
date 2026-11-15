import { useEffect, useState } from "preact/hooks";
import { isValidPeekBlocklistPattern } from "../../features/peek/model";
import {
  pendingRemovalDeadline,
  removalDeadline,
} from "../../shared/delayedRemovals";
import type { Settings } from "../../shared/settings";
import { getSettings, onSettingsChange, setSettings } from "../../shared/storage";
import { RemovalCountdown } from "./RemovalCountdown";

export function PeekBlocklist() {
  const [settings, setLocal] = useState<Settings | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const sync = (next: Settings) => {
      setLocal(next);
      setNow(Date.now());
    };
    void getSettings().then(sync);
    return onSettingsChange(sync);
  }, []);

  useEffect(() => {
    if (!settings || Object.keys(settings.pendingPeekBlocklistRemovals).length === 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [settings]);

  if (!settings) return <p>Loading…</p>;

  const addPattern = async (event: Event) => {
    event.preventDefault();
    setError(null);
    if (input.length === 0) {
      setError("Enter a regular expression");
      return;
    }
    if (!isValidPeekBlocklistPattern(input)) {
      setError("Enter a valid JavaScript regular expression");
      return;
    }
    if (settings.peekBlocklistPatterns.includes(input)) {
      setError("That filter is already in the blocklist");
      return;
    }
    await setSettings({
      peekBlocklistPatterns: [...settings.peekBlocklistPatterns, input].sort(),
    });
    setInput("");
  };

  const scheduleRemoval = async (pattern: string) => {
    await setSettings({
      pendingPeekBlocklistRemovals: {
        ...settings.pendingPeekBlocklistRemovals,
        [pattern]: removalDeadline(),
      },
    });
  };

  const cancelRemoval = async (pattern: string) => {
    const pending = { ...settings.pendingPeekBlocklistRemovals };
    delete pending[pattern];
    await setSettings({ pendingPeekBlocklistRemovals: pending });
  };

  return (
    <details class="peek-blocklist-details">
      <summary>⚙️ peek preview blocklist</summary>
      <p>
        Tracked URLs matching one of these JavaScript regular expressions open
        normally instead of in a Peek preview. Filters are case-sensitive and
        test the complete URL. Enter the pattern without slash delimiters.
      </p>
      <form class="site-list-form" onSubmit={addPattern}>
        <label class="visually-hidden" htmlFor="add-peek-filter">
          Add a Peek blocklist regular expression
        </label>
        <input
          id="add-peek-filter"
          type="text"
          placeholder={String.raw`example\.com/private`}
          value={input}
          onInput={(event) => setInput((event.target as HTMLInputElement).value)}
          autoComplete="off"
          spellcheck={false}
        />
        <button type="submit">Add</button>
      </form>
      {error && <p class="error">{error}</p>}

      <ul class="settings-entry-list peek-blocklist-list">
        {settings.peekBlocklistPatterns.length === 0 ? (
          <li class="empty">No Peek blocklist filters yet.</li>
        ) : settings.peekBlocklistPatterns.map((pattern) => {
          const deadline = pendingRemovalDeadline(
            settings.pendingPeekBlocklistRemovals,
            pattern,
          );
          return (
            <li key={pattern}>
              <code class="peek-filter-pattern">{pattern}</code>
              <span class="entry-actions">
                {deadline !== undefined && (
                  <RemovalCountdown
                    deadline={deadline}
                    now={now}
                    itemLabel="Peek filter"
                  />
                )}
                {deadline === undefined ? (
                  <button
                    type="button"
                    title="Remove filter"
                    aria-label={`Remove filter ${pattern}`}
                    onClick={() => scheduleRemoval(pattern)}
                  >
                    🗑️
                  </button>
                ) : (
                  <button
                    type="button"
                    title="Cancel removal"
                    aria-label={`Cancel removal of filter ${pattern}`}
                    onClick={() => cancelRemoval(pattern)}
                  >
                    Cancel
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
