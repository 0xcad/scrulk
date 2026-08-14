import { useEffect, useRef } from "preact/hooks";
import { remainingAllowanceMs, type DayState } from "../shared/types";

const DIM_WINDOW_MS = 15_000;
const MAX_OPACITY = 0.7;

interface Props {
  state: DayState;
  matchedDomain: string | null;
}

export function DimOverlay({ state, matchedDomain }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const div = divRef.current;
    if (!div) return;

    const interruptActive =
      state.accessFlowPhase !== "browsing";

    if (interruptActive) {
      div.style.transition = "none";
      div.style.opacity = "0";
      return;
    }

    const now = Date.now();
    let minMs = Infinity;

    if (
      matchedDomain !== null &&
      state.activeSince !== null &&
      state.breaktimeExtensionExpiresAt === null
    ) {
      const t = remainingAllowanceMs(state, now);
      if (t > 0) minMs = Math.min(minMs, t);
    }

    if (minMs === Infinity || minMs > DIM_WINDOW_MS) {
      div.style.transition = "none";
      div.style.opacity = "0";
      if (minMs !== Infinity) {
        timeoutRef.current = window.setTimeout(() => {
          div.style.transition = `opacity ${DIM_WINDOW_MS / 1000}s linear`;
          div.style.opacity = String(MAX_OPACITY);
        }, minMs - DIM_WINDOW_MS);
      }
      return;
    }

    // Already inside the 15s window — partial/mid-tab-switch case.
    // Set the correct starting opacity immediately, then transition to MAX_OPACITY
    // over the remaining time.
    const startOpacity = (1 - minMs / DIM_WINDOW_MS) * MAX_OPACITY;
    div.style.transition = "none";
    div.style.opacity = String(startOpacity);
    rafRef.current = requestAnimationFrame(() => {
      div.style.transition = `opacity ${minMs / 1000}s linear`;
      div.style.opacity = String(MAX_OPACITY);
    });
  }, [state, matchedDomain]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={divRef}
      style={{
        position: "fixed",
        inset: 0,
        background: "black",
        opacity: 0,
        pointerEvents: "none",
        zIndex: 2147483646,
      }}
    />
  );
}
