import { useEffect, useState } from "preact/hooks";
import {
  domainsOverlap,
  normalizeDomain,
  withoutOverlappingDomains,
} from "../../shared/domain";
import { getSettings, onSettingsChange, setSettings } from "../../shared/storage";
import type { Settings } from "../../shared/settings";
import {
  pendingRemovalDeadline,
  removalDeadline,
} from "../../shared/delayedRemovals";
import { RemovalCountdown } from "./RemovalCountdown";

export function TrackedSitesList() {
  const [settings, setLocal] = useState<Settings | null>(null);
  const [list, setList] = useState<"tracked" | "ignored">("tracked");
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
    if (!settings || Object.keys(settings.pendingTrackedSiteRemovals).length === 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [settings]);

  if (!settings) return <p>Loading…</p>;

  const domains = list === "tracked" ? settings.trackedSites : settings.ignoredSites;
  const otherDomains = list === "tracked" ? settings.ignoredSites : settings.trackedSites;
  const label = list === "tracked" ? "tracked" : "ignored";

  const onSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    const normalized = normalizeDomain(input);
    if (!normalized) {
      setError("Enter a valid domain like example.com");
      return;
    }
    if (domains.includes(normalized)) {
      setError(`${normalized} is already ${label}`);
      return;
    }
    if (
      list === "ignored" &&
      otherDomains.some((tracked) => domainsOverlap(tracked, normalized))
    ) {
      setError("Remove the overlapping tracked site first.");
      return;
    }
    await setSettings({
      ...(list === "tracked"
        ? {
            trackedSites: [...domains, normalized].sort(),
            ignoredSites: withoutOverlappingDomains(otherDomains, normalized),
          }
        : {
            ignoredSites: [...domains, normalized].sort(),
          }),
    });
    setInput("");
  };

  const onRemove = async (domain: string) => {
    if (list === "tracked") {
      await setSettings({
        pendingTrackedSiteRemovals: {
          ...settings.pendingTrackedSiteRemovals,
          [domain]: removalDeadline(),
        },
      });
      return;
    }
    await setSettings({ ignoredSites: domains.filter((d) => d !== domain) });
  };

  const onCancelRemoval = async (domain: string) => {
    const pending = { ...settings.pendingTrackedSiteRemovals };
    delete pending[domain];
    await setSettings({ pendingTrackedSiteRemovals: pending });
  };

  return (
    <>
      <div class="site-list-switcher" role="group" aria-label="Website list">
        <button
          type="button"
          aria-pressed={list === "tracked"}
          onClick={() => { setList("tracked"); setError(null); }}
        >
          Tracked websites
        </button>
        <button
          type="button"
          aria-pressed={list === "ignored"}
          onClick={() => { setList("ignored"); setError(null); }}
        >
          Ignored websites
        </button>
      </div>
      <form class="site-list-form" onSubmit={onSubmit}>
        <label class="visually-hidden" htmlFor="add-domain">
          Add a {label} domain
        </label>
        <input
          id="add-domain"
          type="text"
          placeholder="example.com"
          value={input}
          onInput={(e) => setInput((e.target as HTMLInputElement).value)}
          autoComplete="off"
          spellcheck={false}
        />
        <button type="submit">Add</button>
      </form>
      {error && <p class="error">{error}</p>}

      <ul class="settings-entry-list">
        {domains.length === 0 ? (
          <li class="empty">No {label} sites yet.</li>
        ) : (
          domains.map((d) => {
            const deadline = pendingRemovalDeadline(
              settings.pendingTrackedSiteRemovals,
              d,
            );
            return (
              <li key={d}>
                <span>{d}</span>
                <span class="entry-actions">
                  {list === "tracked" && deadline !== undefined && (
                    <RemovalCountdown
                      deadline={deadline}
                      now={now}
                      itemLabel="Tracked site"
                    />
                  )}
                  {list === "tracked" && deadline !== undefined ? (
                    <button
                      type="button"
                      title="Cancel removal"
                      aria-label={`Cancel removal of ${d}`}
                      onClick={() => onCancelRemoval(d)}
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      type="button"
                      title={`Remove ${label} site`}
                      aria-label={`Remove ${d} from ${label} sites`}
                      onClick={() => onRemove(d)}
                    >
                      🗑️
                    </button>
                  )}
                </span>
              </li>
            );
          })
        )}
      </ul>
    </>
  );
}
