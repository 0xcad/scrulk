import { useEffect, useState } from "preact/hooks";
import {
  DEFAULT_FOCUS_SESSIONS,
  type FocusSession,
  type FocusSessionsState,
  type FocusTabSnapshot,
} from "../../shared/focusSessions";
import {
  getFocusSessions,
  onFocusSessionsChange,
} from "../../shared/storage";
import { sendCommand } from "../../shared/messages";

export function Focus() {
  const [state, setState] = useState<FocusSessionsState>(DEFAULT_FOCUS_SESSIONS);

  useEffect(() => {
    void getFocusSessions().then(setState);
    return onFocusSessionsChange(setState);
  }, []);

  return (
    <section>
      <h2 class="scrulk-section-title dashboard-section-title">Focus windows</h2>
      <p>
        Focus windows block tracked sites and can be closed, saved, and resumed later.
      </p>
      {state.sessions.length === 0 ? (
        <p class="focus-empty">Start focus mode from the extension popup to create a focus window.</p>
      ) : (
        <div class="focus-session-list">
          {state.sessions.map((session, index) => (
            <FocusSessionDetails session={session} fallbackIndex={index + 1} />
          ))}
        </div>
      )}
    </section>
  );
}

function FocusSessionDetails({
  session,
  fallbackIndex,
}: {
  session: FocusSession;
  fallbackIndex: number;
}) {
  const action = (event: Event, operation: () => void) => {
    event.preventDefault();
    event.stopPropagation();
    operation();
  };
  const rename = () => {
    const next = window.prompt("Name this focus window", session.name ?? "");
    if (next === null) return;
    void sendCommand({ type: "focus:rename", sessionId: session.id, name: next });
  };
  const remove = () => {
    if (!window.confirm("Delete this focus window and all of its saved and stashed tabs?")) return;
    void sendCommand({ type: "focus:delete", sessionId: session.id });
  };

  return (
    <details class="focus-session">
      <summary>
        <button
          type="button"
          class="focus-session-name"
          title="Rename focus window"
          onClick={(event) => action(event, rename)}
        >
          {session.name ?? `Focus window ${fallbackIndex}`}
        </button>
        <span class={`focus-session-status ${session.status}`}>{session.status === "active" ? "open" : "saved"}</span>
        <span class="focus-session-counts">
          {session.tabs.length} {session.tabs.length === 1 ? "tab" : "tabs"}
          {session.stashedTabs.length > 0 && ` · ${session.stashedTabs.length} stashed`}
        </span>
        <span class="focus-session-actions">
          {session.status === "active" ? (
            <button
              type="button"
              onClick={(event) => action(event, () => {
                void sendCommand({ type: "focus:end", sessionId: session.id });
              })}
            >end</button>
          ) : (
            <button
              type="button"
              onClick={(event) => action(event, () => {
                void sendCommand({ type: "focus:resume", sessionId: session.id });
              })}
            >resume</button>
          )}
          <button
            type="button"
            aria-label="Delete focus window"
            title="Delete focus window"
            onClick={(event) => action(event, remove)}
          >🗑️</button>
        </span>
      </summary>
      <FocusTabList label="Tabs" tabs={session.tabs} sessionId={session.id} />
      {session.stashedTabs.length > 0 && (
        <FocusTabList label="Stashed tabs" tabs={session.stashedTabs} sessionId={session.id} />
      )}
    </details>
  );
}

function FocusTabList({
  label,
  tabs,
  sessionId,
}: {
  label: string;
  tabs: FocusTabSnapshot[];
  sessionId: string;
}) {
  return (
    <div class="focus-tabs">
      <h3>{label}</h3>
      <ul>
        {tabs.map((tab) => (
          <li>
            <a
              href={tab.url}
              title={tab.url}
              onClick={(event) => {
                event.preventDefault();
                void sendCommand({ type: "focus:openTabOutside", sessionId, tabId: tab.id });
              }}
            >
              {tab.title || tab.url}
            </a>
            {tab.pinned && <small>pinned</small>}
          </li>
        ))}
      </ul>
    </div>
  );
}
