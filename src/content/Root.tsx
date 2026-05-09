import { useEffect, useState } from "preact/hooks";
import { getDayState, onDayStateChange } from "../shared/storage";
import { DEFAULT_DAY_STATE, type DayState } from "../shared/types";
import { BreaktimeOverlay } from "./BreaktimeOverlay";
import { ReentryOverlay } from "./ReentryOverlay";
import { SleepClock } from "./SleepClock";
import { UsageClock } from "./UsageClock";

interface Props {
  matchedDomain: string | null;
}

/**
 * Top-level renderer inside the Shadow DOM root. The shadow root is mounted
 * on every page (universal content script); this component decides which
 * overlays to show:
 *   - `UsageClock`: only on tracked sites.
 *   - `SleepClock`: every site, but only inside the 10h-before-wakeup window.
 *   - `BreaktimeOverlay`: only on tracked sites, only while the global
 *     `breaktimeOpen` flag is set.
 *   - `ReentryOverlay`: only on tracked sites, when the survey has already
 *     been submitted for the current wake-day. Dismissal is per-mount
 *     (reload re-shows) and gated by a hold challenge.
 */
export function Root({ matchedDomain }: Props) {
  const [state, setState] = useState<DayState>(DEFAULT_DAY_STATE);
  const [reentryDismissed, setReentryDismissed] = useState(false);

  useEffect(() => {
    void getDayState().then(setState);
    return onDayStateChange(setState);
  }, []);

  // Reset local dismissal whenever the surveyFilledFor key changes (e.g.
  // wake-day rolls over, or the user re-edits the survey).
  useEffect(() => {
    setReentryDismissed(false);
  }, [state.surveyFilledFor]);

  const showReentry =
    matchedDomain !== null &&
    !state.breaktimeOpen &&
    state.surveyFilledFor !== null &&
    !reentryDismissed;

  return (
    <>
      {matchedDomain !== null && <UsageClock matchedDomain={matchedDomain} />}
      <SleepClock />
      {matchedDomain !== null && state.breaktimeOpen && <BreaktimeOverlay />}
      {showReentry && state.surveyFilledFor !== null && (
        <ReentryOverlay
          surveyDate={state.surveyFilledFor}
          onContinueComplete={() => setReentryDismissed(true)}
        />
      )}
    </>
  );
}
