import { useEffect, useRef, useState } from "preact/hooks";
import browser from "webextension-polyfill";
import type { Message } from "../../../shared/messages";
import {
  getDayState,
  onDayStateChange,
  setDayState,
} from "../../../shared/storage";
import type { DayState } from "../../../shared/types";
import {
  ACCESS_FLOW_PHASES,
  parseExtensionTabs,
  parseInteger,
  parseNullableString,
} from "./validation";

type FieldConfig = {
  label: string;
  hint: string;
} & (
  | { kind: "boolean" }
  | { kind: "number"; nullable: boolean }
  | { kind: "string"; nullable: true }
  | { kind: "phase" }
  | { kind: "extensionTabs" }
);

const FIELD_CONFIGS = {
  wakeDayStart: {
    kind: "number",
    nullable: false,
    label: "wakeDayStart",
    hint: "Epoch milliseconds for the current wake-day boundary.",
  },
  totalMs: {
    kind: "number",
    nullable: false,
    label: "totalMs",
    hint: "Closed tracked-usage segments, in milliseconds.",
  },
  activeSince: {
    kind: "number",
    nullable: true,
    label: "activeSince",
    hint: "Epoch milliseconds for the open tracked segment, or blank for null.",
  },
  allSitesMs: {
    kind: "number",
    nullable: false,
    label: "allSitesMs",
    hint: "Closed all-sites usage segments, in milliseconds.",
  },
  allSitesActiveSince: {
    kind: "number",
    nullable: true,
    label: "allSitesActiveSince",
    hint: "Epoch milliseconds for the open all-sites segment, or blank for null.",
  },
  activityCheckpointAt: {
    kind: "number",
    nullable: true,
    label: "activityCheckpointAt",
    hint: "Latest activity checkpoint in epoch milliseconds, or blank for null.",
  },
  accessFlowPhase: {
    kind: "phase",
    label: "accessFlowPhase",
    hint: "Global tracked-site access phase.",
  },
  waitingMs: {
    kind: "number",
    nullable: false,
    label: "waitingMs",
    hint: "Closed focused-wait segments, in milliseconds.",
  },
  waitingActiveSince: {
    kind: "number",
    nullable: true,
    label: "waitingActiveSince",
    hint: "Epoch milliseconds for the open waiting segment, or blank for null.",
  },
  waitingCheckpointAt: {
    kind: "number",
    nullable: true,
    label: "waitingCheckpointAt",
    hint: "Latest waiting checkpoint in epoch milliseconds, or blank for null.",
  },
  waitingPageFocused: {
    kind: "boolean",
    label: "waitingPageFocused",
    hint: "Whether the waiting extension page last reported focus.",
  },
  allowanceMs: {
    kind: "number",
    nullable: true,
    label: "allowanceMs",
    hint: "Chosen tracked-usage allowance in milliseconds, or blank for null.",
  },
  allowanceStartTotalMs: {
    kind: "number",
    nullable: true,
    label: "allowanceStartTotalMs",
    hint: "Tracked-total allowance baseline, or blank for null.",
  },
  breakOpenedAt: {
    kind: "number",
    nullable: true,
    label: "breakOpenedAt",
    hint: "Break prompt start in epoch milliseconds, or blank for null.",
  },
  breaktimeExtensionExpiresAt: {
    kind: "number",
    nullable: true,
    label: "breaktimeExtensionExpiresAt",
    hint: "Extension deadline in epoch milliseconds, or blank for null.",
  },
  breaktimeExtensionUsed: {
    kind: "boolean",
    label: "breaktimeExtensionUsed",
    hint: "Whether the current break cycle used its extension.",
  },
  breaktimeExtensionTabs: {
    kind: "extensionTabs",
    label: "breaktimeExtensionTabs",
    hint: "JSON object mapping eligible tab IDs to their original URLs.",
  },
  tabLimitWarning: {
    kind: "boolean",
    label: "tabLimitWarning",
    hint: "Whether a tab-limit rejection is waiting for the popup.",
  },
  surveyFilledFor: {
    kind: "string",
    nullable: true,
    label: "surveyFilledFor",
    hint: "Submitted wake-day key, or blank for null.",
  },
  breaktimeShownToday: {
    kind: "boolean",
    label: "breaktimeShownToday",
    hint: "Whether a break alert has appeared this wake-day.",
  },
  popupDoneToday: {
    kind: "boolean",
    label: "popupDoneToday",
    hint: "Whether the popup-originated lock was used this wake-day.",
  },
  surveyContinueAllowed: {
    kind: "boolean",
    label: "surveyContinueAllowed",
    hint: "Whether the popup-originated lock was overridden.",
  },
} satisfies Record<keyof DayState, FieldConfig>;

type DayStateField = keyof DayState;
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
        await setDayState(next);
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
        const message: Message = { type: "debug:resetDay" };
        await browser.runtime.sendMessage(message);
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
      <h2>Current DayState</h2>
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
          {(Object.entries(FIELD_CONFIGS) as Array<[DayStateField, FieldConfig]>).map(
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
  config: FieldConfig;
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
        <code>{config.label}</code>
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
