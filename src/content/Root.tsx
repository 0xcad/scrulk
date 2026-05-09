import { useEffect, useState } from "preact/hooks";
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
 */
export function Root({ matchedDomain }: Props) {
  const [state, setState] = useState<DayState>(DEFAULT_DAY_STATE);

  useEffect(() => {
    void getDayState().then(setState);
    return onDayStateChange(setState);
  }, []);

  return (
    <>
      {matchedDomain !== null && <UsageClock matchedDomain={matchedDomain} />}
      <SleepClock />
      {matchedDomain !== null && state.breaktimeOpen && <BreaktimeOverlay />}
    </>
  );
}
