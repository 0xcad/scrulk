import { useEffect, useState } from "preact/hooks";
import browser from "webextension-polyfill";
import { type DayRecord, getDay } from "../shared/history";
import type { Message } from "../shared/messages";
import { formatDuration } from "../shared/wakeDay";
import { Challenge } from "./Challenge";

interface Props {
  /** 'YYYY-MM-DD' wake-day key the survey was filled for. */
  surveyDate: string;
  onContinueComplete: () => void;
}

type Phase = "summary" | "challenge";

function send(msg: Message): Promise<unknown> {
  return browser.runtime.sendMessage(msg);
}

/**
 * Shown on tracked sites when the user has already filled out the survey for
 * the current wake-day. Summarizes the response. Continue runs the same
 * wait+hold challenge as breaktime; "Edit survey" reopens the survey page
 * and closes tracked tabs (mirroring the breaktime "I'm done" flow).
 *
 * Dismissal is local to the mount — reload or fresh navigation re-shows.
 */
export function ReentryOverlay({ surveyDate, onContinueComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("summary");
  const [record, setRecord] = useState<DayRecord | null | undefined>(undefined);

  useEffect(() => {
    void getDay(surveyDate).then(setRecord);
  }, [surveyDate]);

  const onEdit = () => {
    void send({
      type: "survey:open",
      date: surveyDate,
      closeTrackedTabs: true,
    });
  };

  return (
    <>
      <style>{styles}</style>
      <div class="re-backdrop" role="dialog" aria-modal="true" aria-labelledby="re-title">
        <div class="re-card">
          {phase === "summary" && (
            <>
              <h2 id="re-title">You already reflected on this day</h2>
              {record === undefined ? (
                <p><small>Loading…</small></p>
              ) : record === null ? (
                <p>No survey record found.</p>
              ) : (
                <dl class="re-summary">
                  <div>
                    <dt>Time on tracked sites</dt>
                    <dd>{formatDuration(record.totalMs)}</dd>
                  </div>
                  <div>
                    <dt>Regret</dt>
                    <dd>{record.regret !== null ? `${record.regret} / 5` : "—"}</dd>
                  </div>
                  {record.notes && (
                    <div>
                      <dt>Notes</dt>
                      <dd class="re-notes">{record.notes}</dd>
                    </div>
                  )}
                </dl>
              )}
              <div class="row">
                <button type="button" class="primary" onClick={onEdit}>
                  I'm done!
                </button>
                <button type="button" onClick={() => setPhase("challenge")}>
                  Continue
                </button>
              </div>
            </>
          )}

          {phase === "challenge" && <Challenge onComplete={onContinueComplete} />}
        </div>
      </div>
    </>
  );
}

const styles = `
  .re-backdrop {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    background: rgba(0, 0, 0, 0.78);
    display: grid;
    place-items: center;
    font: 14px/1.4 system-ui, sans-serif;
    color: #111;
    z-index: 2147483646;
  }
  .re-card {
    background: white;
    padding: 28px 32px;
    border-radius: 12px;
    max-width: 420px;
    width: calc(100% - 64px);
    text-align: center;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  }
  .re-card h2 { margin: 0 0 12px; font-size: 18px; }
  .re-summary {
    text-align: left;
    margin: 12px 0 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .re-summary div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
    border-bottom: 1px solid #eee;
  }
  .re-summary dt {
    font-weight: 600;
    opacity: 0.7;
    margin: 0;
  }
  .re-summary dd {
    margin: 0;
    text-align: right;
  }
  .re-summary .re-notes {
    text-align: left;
    flex: 1;
    white-space: pre-wrap;
  }
`;
