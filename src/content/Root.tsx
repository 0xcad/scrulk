import { useEffect, useState } from "preact/hooks";
import { getDayState, onDayStateChange } from "../shared/storage";
import { DEFAULT_DAY_STATE, type DayState } from "../shared/types";
import { BreaktimeOverlay } from "./BreaktimeOverlay";
import { UsageClock } from "./UsageClock";

interface Props {
  matchedDomain: string;
}

/**
 * Top-level renderer inside the Shadow DOM root. Listens to dayState so the
 * breaktime overlay can appear/dismiss reactively even on tabs the user
 * isn't actively focused on.
 */
export function Root({ matchedDomain }: Props) {
  const [state, setState] = useState<DayState>(DEFAULT_DAY_STATE);

  useEffect(() => {
    void getDayState().then(setState);
    return onDayStateChange(setState);
  }, []);

  return (
    <>
      <UsageClock matchedDomain={matchedDomain} />
      {state.breaktimeOpen && <BreaktimeOverlay />}
    </>
  );
}
