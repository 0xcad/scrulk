import { useEffect, useState } from "preact/hooks";
import { normalizeDomain } from "../../shared/domain";
import { getSettings, onSettingsChange, setSettings } from "../../shared/storage";
import type { Settings } from "../../shared/settings";

export function TrackedSitesList() {
  const [settings, setLocal] = useState<Settings | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getSettings().then(setLocal);
    return onSettingsChange(setLocal);
  }, []);

  if (!settings) return <p>Loading…</p>;

  const onSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    const normalized = normalizeDomain(input);
    if (!normalized) {
      setError("Enter a valid domain like example.com");
      return;
    }
    if (settings.trackedSites.includes(normalized)) {
      setError(`${normalized} is already tracked`);
      return;
    }
    await setSettings({
      trackedSites: [...settings.trackedSites, normalized].sort(),
    });
    setInput("");
  };

  const onRemove = async (domain: string) => {
    await setSettings({
      trackedSites: settings.trackedSites.filter((d) => d !== domain),
    });
  };

  return (
    <>
      <form onSubmit={onSubmit}>
        <label class="visually-hidden" htmlFor="add-domain">
          Add a domain
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

      <ul class="tracked-sites">
        {settings.trackedSites.length === 0 ? (
          <li class="empty">No tracked sites yet.</li>
        ) : (
          settings.trackedSites.map((d) => (
            <li key={d}>
              <span>{d}</span>
              <button type="button" onClick={() => onRemove(d)}>
                Remove
              </button>
            </li>
          ))
        )}
      </ul>
    </>
  );
}
