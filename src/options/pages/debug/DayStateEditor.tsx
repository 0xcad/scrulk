import { useEffect, useRef, useState } from "preact/hooks";
import {
  sendCommand,
  sendDayStateFieldCommand,
} from "../../../shared/messages";
import {
  getDayState,
  onDayStateChange,
} from "../../../shared/storage";
import {
  DAY_STATE_FIELDS,
  type DayState,
  type DayStateField,
  type DayStateFieldDefinition,
} from "../../../shared/dayState";
import {
  ACCESS_FLOW_PHASES,
  parseExtensionTabs,
  parseInteger,
  parseNullableString,
} from "./validation";

type FieldErrors = Partial<Record<DayStateField, string>>;

export function DayStateEditor() {
  const [state, setState] = useState<DayState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [resetting, setResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const commitQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let mounted = true;
    const unsubscribe = onDayStateChange((next) => {
      if (mounted) setState(next);
    });
    void getDayState().then(
      (next) => {
        if (mounted) setState(next);
      },
      (error: unknown) => {
        if (mounted) setLoadError(errorMessage(error));
      },
    );
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const showValidationError = (field: DayStateField, error: string) => {
    setErrors((current) => ({ ...current, [field]: error }));
  };

  const commit = <K extends DayStateField>(field: K, value: DayState[K]) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    commitQueue.current = commitQueue.current.then(async () => {
      try {
        const latest = await getDayState();
        const next = { ...latest, [field]: value };
        await sendDayStateFieldCommand(field, value);
        setState(next);
      } catch (error: unknown) {
        setErrors((current) => ({
          ...current,
          [field]: `Could not save: ${errorMessage(error)}`,
        }));
      }
    });
    return commitQueue.current;
  };

  const resetDay = () => {
    const confirmed = window.confirm(
      "Reset the current DayState? Today's usage and access-flow data will be discarded.",
    );
    if (!confirmed) return;

    setResetting(true);
    setResetStatus(null);
    setResetError(null);
    commitQueue.current = commitQueue.current.then(async () => {
      try {
        await sendCommand({ type: "debug:resetDay" });
        setErrors({});
        setResetStatus("DayState reset.");
      } catch (error: unknown) {
        setResetError(`Could not reset DayState: ${errorMessage(error)}`);
      } finally {
        setResetting(false);
      }
    });
  };

  return (
    <section>
      <h2 class="scrulk-section-title dashboard-section-title">Current DayState</h2>
      <p>
        Values update live. Radios and the phase selector save immediately;
        other fields save on blur or Enter.
      </p>
      <div class="debug-reset-row">
        <button type="button" disabled={resetting || state === null} onClick={resetDay}>
          {resetting ? "resetting…" : "reset day"}
        </button>
        <span aria-live="polite">
          {resetStatus && <small>{resetStatus}</small>}
          {resetError && <small class="error">{resetError}</small>}
        </span>
      </div>
      {loadError && <p class="error">Could not load DayState: {loadError}</p>}
      {!state && !loadError && <p>Loading…</p>}
      {state && (
        <div class="debug-state-editor">
          {(Object.entries(DAY_STATE_FIELDS) as Array<[
            DayStateField,
            DayStateFieldDefinition,
          ]>).map(
            ([field, config]) => (
              <FieldEditor
                key={field}
                field={field}
                config={config}
                value={state[field]}
                error={errors[field]}
                onCommit={commit}
                onValidationError={showValidationError}
              />
            ),
          )}
        </div>
      )}
    </section>
  );
}

interface FieldEditorProps {
  field: DayStateField;
  config: DayStateFieldDefinition;
  value: DayState[DayStateField];
  error: string | undefined;
  onCommit: <K extends DayStateField>(field: K, value: DayState[K]) => Promise<void>;
  onValidationError: (field: DayStateField, error: string) => void;
}

function FieldEditor({
  field,
  config,
  value,
  error,
  onCommit,
  onValidationError,
}: FieldEditorProps) {
  let control;
  switch (config.kind) {
    case "boolean":
      control = (
        <BooleanEditor
          field={field}
          value={value as boolean}
          onCommit={(next) => onCommit(field, next)}
        />
      );
      break;
    case "number":
      control = (
        <NumberEditor
          field={field}
          value={value as number | null}
          nullable={config.nullable}
          onCommit={(next) => onCommit(field, next)}
          onError={(message) => onValidationError(field, message)}
        />
      );
      break;
    case "string":
      control = (
        <StringEditor
          field={field}
          value={value as string | null}
          onCommit={(next) => onCommit(field, next)}
        />
      );
      break;
    case "phase":
      control = (
        <select
          id={`day-state-${field}`}
          value={value as string}
          onChange={(event) => {
            const next = (event.target as HTMLSelectElement).value;
            void onCommit(field, next);
          }}
        >
          {ACCESS_FLOW_PHASES.map((phase) => <option key={phase}>{phase}</option>)}
        </select>
      );
      break;
    case "extensionTabs":
      control = (
        <ExtensionTabsEditor
          field={field}
          value={value as Record<string, string>}
          onCommit={(next) => onCommit(field, next)}
          onError={(message) => onValidationError(field, message)}
        />
      );
      break;
  }

  return (
    <div class="debug-state-field">
      <label class="debug-state-label" for={`day-state-${field}`}>
        <code>{field}</code>
      </label>
      <div class="debug-state-control">{control}</div>
      <small>{config.hint}</small>
      {error && <small class="error">{error}</small>}
    </div>
  );
}

interface BooleanEditorProps {
  field: DayStateField;
  value: boolean;
  onCommit: (value: boolean) => Promise<void>;
}

function BooleanEditor({ field, value, onCommit }: BooleanEditorProps) {
  return (
    <fieldset id={`day-state-${field}`} class="debug-boolean-field">
      <legend class="visually-hidden">{field}</legend>
      {[true, false].map((option) => (
        <label key={String(option)}>
          <input
            type="radio"
            name={`day-state-${field}`}
            checked={value === option}
            onChange={() => void onCommit(option)}
          />
          {String(option)}
        </label>
      ))}
    </fieldset>
  );
}

interface NumberEditorProps {
  field: DayStateField;
  value: number | null;
  nullable: boolean;
  onCommit: (value: number | null) => Promise<void>;
  onError: (error: string) => void;
}

function NumberEditor({
  field,
  value,
  nullable,
  onCommit,
  onError,
}: NumberEditorProps) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value === null ? "" : String(value));
  }, [value]);

  const save = () => {
    focused.current = false;
    const parsed = parseInteger(draft, nullable);
    if (!parsed.ok) {
      onError(parsed.error);
      return;
    }
    void onCommit(parsed.value);
  };

  return (
    <input
      id={`day-state-${field}`}
      type="number"
      step="1"
      value={draft}
      onFocus={() => { focused.current = true; }}
      onInput={(event) => setDraft((event.target as HTMLInputElement).value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
      }}
    />
  );
}

interface StringEditorProps {
  field: DayStateField;
  value: string | null;
  onCommit: (value: string | null) => Promise<void>;
}

function StringEditor({ field, value, onCommit }: StringEditorProps) {
  const [draft, setDraft] = useState(value ?? "");
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value ?? "");
  }, [value]);

  const save = () => {
    focused.current = false;
    void onCommit(parseNullableString(draft));
  };

  return (
    <input
      id={`day-state-${field}`}
      type="text"
      value={draft}
      onFocus={() => { focused.current = true; }}
      onInput={(event) => setDraft((event.target as HTMLInputElement).value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
      }}
    />
  );
}

interface ExtensionTabsEditorProps {
  field: DayStateField;
  value: Record<string, string>;
  onCommit: (value: Record<string, string>) => Promise<void>;
  onError: (error: string) => void;
}

function ExtensionTabsEditor({
  field,
  value,
  onCommit,
  onError,
}: ExtensionTabsEditorProps) {
  const [draft, setDraft] = useState(formatJson(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(formatJson(value));
  }, [value]);

  const save = () => {
    focused.current = false;
    const parsed = parseExtensionTabs(draft);
    if (!parsed.ok) {
      onError(parsed.error);
      return;
    }
    setDraft(formatJson(parsed.value));
    void onCommit(parsed.value);
  };

  return (
    <textarea
      id={`day-state-${field}`}
      rows={5}
      spellcheck={false}
      value={draft}
      onFocus={() => { focused.current = true; }}
      onInput={(event) => setDraft((event.target as HTMLTextAreaElement).value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          (event.target as HTMLTextAreaElement).blur();
        }
      }}
    />
  );
}

function formatJson(value: Record<string, string>): string {
  return JSON.stringify(value, null, 2);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
