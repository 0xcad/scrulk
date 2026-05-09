import { useEffect, useRef, useState } from "preact/hooks";
import browser from "webextension-polyfill";
import type { Message } from "../shared/messages";
import { getDayState, onDayStateChange } from "../shared/storage";
import { DEFAULT_DAY_STATE, type DayState } from "../shared/types";
import { BreaktimeOverlay } from "./BreaktimeOverlay";
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
 *
 * Post-survey redirect: when the survey has already been submitted for the
 * current wake-day and the user has not yet clicked "Continue" on the
 * survey page, any tracked-tab visit fires a one-shot `survey:redirect`
 * which closes this tab and opens the survey.
 */
export function Root({ matchedDomain }: Props) {
  const [state, setState] = useState<DayState>(DEFAULT_DAY_STATE);
  const redirectSent = useRef(false);

  useEffect(() => {
    void getDayState().then(setState);
    return onDayStateChange(setState);
  }, []);

  useEffect(() => {
    if (
      matchedDomain === null ||
      state.surveyFilledFor === null ||
      state.surveyContinueAllowed ||
      state.breaktimeOpen ||
      redirectSent.current
    ) {
      return;
    }
    redirectSent.current = true;
    const msg: Message = {
      type: "survey:redirect",
      date: state.surveyFilledFor,
    };
    void browser.runtime.sendMessage(msg).catch(() => null);
  }, [
    matchedDomain,
    state.surveyFilledFor,
    state.surveyContinueAllowed,
    state.breaktimeOpen,
  ]);

  return (
    <>
      {matchedDomain !== null && <UsageClock matchedDomain={matchedDomain} />}
      <SleepClock />
      {matchedDomain !== null && state.breaktimeOpen && <BreaktimeOverlay />}
    </>
  );
}
