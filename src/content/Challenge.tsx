import { useEffect, useRef, useState } from "preact/hooks";

const DEFAULT_WAIT_MS = 30_000;
const DEFAULT_HOLD_MS = 30_000;

type Phase = "wait" | "hold";

interface Props {
  /** Called once the user successfully completes the wait + hold sequence. */
  onComplete: () => void;
  waitMs?: number;
  holdMs?: number;
}

/**
 * Wait-then-hold challenge gate. Used by the breaktime overlay (after the
 * "Continue" button) and by the re-entry overlay's Continue path. Releasing
 * during hold *pauses* the hold timer; pressing again resumes from where it
 * left off. The wait phase is one-shot.
 */
export function Challenge({ onComplete, waitMs = DEFAULT_WAIT_MS, holdMs = DEFAULT_HOLD_MS }: Props) {
  const [phase, setPhase] = useState<Phase>("wait");
  const [remaining, setRemaining] = useState(waitMs);

  // Wait phase: countdown to hold phase.
  useEffect(() => {
    if (phase !== "wait") return;
    const startedAt = Date.now();
    setRemaining(waitMs);
    const id = setInterval(() => {
      const left = waitMs - (Date.now() - startedAt);
      if (left <= 0) {
        clearInterval(id);
        setPhase("hold");
      } else {
        setRemaining(left);
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase, waitMs]);

  const heldMs = useRef(0);
  const heldSince = useRef<number | null>(null);
  const holdTimer = useRef<number | null>(null);

  const onHoldStart = (e: PointerEvent) => {
    if (phase !== "hold") return;
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
    if (phase !== "hold") return;
    const since = heldSince.current;
    if (since === null) return;
    heldMs.current = Math.min(holdMs, heldMs.current + (Date.now() - since));
    heldSince.current = null;
    if (holdTimer.current !== null) clearInterval(holdTimer.current);
    holdTimer.current = null;
    setRemaining(holdMs - heldMs.current);
  };

  if (phase === "wait") {
    return (
      <>
        <h2>Wait a moment</h2>
        <p class="big">{Math.ceil(remaining / 1000)}s</p>
        <p>
          <small>Then you'll need to hold a button for {Math.round(holdMs / 1000)} seconds.</small>
        </p>
      </>
    );
  }

  return (
    <>
      <h2>Hold to continue</h2>
      <button
        type="button"
        class="hold"
        onPointerDown={onHoldStart}
        onPointerUp={onHoldEnd}
        onPointerCancel={onHoldEnd}
        onPointerLeave={onHoldEnd}
      >
        {Math.ceil(remaining / 1000)}s
      </button>
      <p>
        <small>Release to pause; press again to keep going.</small>
      </p>
    </>
  );
}
