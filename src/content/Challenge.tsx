import { useRef, useState } from "preact/hooks";

const DEFAULT_HOLD_MS = 30_000;

interface Props {
  /** Called once the user successfully completes the press-and-hold. */
  onComplete: () => void;
  holdMs?: number;
}

/**
 * Press-and-hold challenge gate. Releasing during hold *pauses* the timer;
 * pressing again resumes from where it left off. The pre-challenge wait is
 * handled upstream by the BreaktimeOverlay alert phase.
 */
export function Challenge({ onComplete, holdMs = DEFAULT_HOLD_MS }: Props) {
  const [remaining, setRemaining] = useState(holdMs);

  const heldMs = useRef(0);
  const heldSince = useRef<number | null>(null);
  const holdTimer = useRef<number | null>(null);

  const onHoldStart = (e: PointerEvent) => {
    if (heldSince.current !== null) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    heldSince.current = Date.now();
    setRemaining(holdMs - heldMs.current);
    holdTimer.current = window.setInterval(() => {
      const since = heldSince.current;
      if (since === null) return;
      const left = holdMs - heldMs.current - (Date.now() - since);
      if (left <= 0) {
        if (holdTimer.current !== null) clearInterval(holdTimer.current);
        holdTimer.current = null;
        heldSince.current = null;
        heldMs.current = 0;
        onComplete();
      } else {
        setRemaining(left);
      }
    }, 100);
  };

  const onHoldEnd = () => {
    const since = heldSince.current;
    if (since === null) return;
    heldMs.current = Math.min(holdMs, heldMs.current + (Date.now() - since));
    heldSince.current = null;
    if (holdTimer.current !== null) clearInterval(holdTimer.current);
    holdTimer.current = null;
    setRemaining(holdMs - heldMs.current);
  };

  void remaining;

  return (
    <>
      <h2>Hold to continue...</h2>
      <button
        type="button"
        class="hold"
        onPointerDown={onHoldStart}
        onPointerUp={onHoldEnd}
        onPointerCancel={onHoldEnd}
        onPointerLeave={onHoldEnd}
      >
       hold to continue
      </button>
      <p>
        <small>Press and hold to continue. Just stop and think some more.</small>
      </p>
    </>
  );
}
