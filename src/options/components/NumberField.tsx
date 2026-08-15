import { useEffect, useState } from "preact/hooks";
import { getSettings, onSettingsChange, setSettings } from "../../shared/storage";
import type { Settings } from "../../shared/settings";

type NumericKeys = {
  [K in keyof Settings]: Settings[K] extends number ? K : never;
}[keyof Settings];

interface Props {
  field: NumericKeys;
  label: string;
  min: number;
  max: number;
  hint?: string;
}

/**
 * Generic numeric setting bound to a Settings field. Edits are written on
 * blur so transient invalid intermediate values (e.g. "" while retyping)
 * don't get persisted.
 */
export function NumberField({ field, label, min, max, hint }: Props) {
  const [settings, setLocal] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<string>("");

  useEffect(() => {
    void getSettings().then((s) => {
      setLocal(s);
      setDraft(String(s[field]));
    });
    return onSettingsChange((s) => {
      setLocal(s);
      setDraft(String(s[field]));
    });
  }, [field]);

  if (!settings) return <p>Loading…</p>;

  const commit = async () => {
    const v = parseInt(draft, 10);
    if (!Number.isFinite(v) || v < min || v > max) {
      setDraft(String(settings[field]));
      return;
    }
    if (v !== settings[field]) {
      await setSettings({ [field]: v } as Partial<Settings>);
    }
  };

  return (
    <label class="row">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={draft}
        onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      {hint && <small>{hint}</small>}
    </label>
  );
}
