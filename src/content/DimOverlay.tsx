import { useEffect, useRef } from "preact/hooks";
import { effectiveMs, type DayState, type GatewayState, type Settings } from "../shared/types";

const DIM_WINDOW_MS = 15_000;
const MAX_OPACITY = 0.8;

interface Props {
  state: DayState;
  settings: Settings;
  gateway: GatewayState;
  matchedDomain: string | null;
}

export function DimOverlay({ state, settings, gateway, matchedDomain }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const div = divRef.current;
    if (!div) return;

    const interruptActive =
      state.breaktimeOpen ||
      (matchedDomain !== null && gateway[matchedDomain]?.expiredAlertActive === true);

    if (interruptActive) {
      div.style.transition = "none";
      div.style.opacity = "0";
      return;
    }

    const now = Date.now();
    let minMs = Infinity;

    if (matchedDomain !== null && state.activeSince !== null) {
      const t =
        state.lastBreaktimeAt +
        settings.breaktimeMinutes * 60_000 -
        effectiveMs(state, now);
      if (t > 0) minMs = Math.min(minMs, t);
    }

    if (matchedDomain !== null) {
      const exp = gateway[matchedDomain]?.timerExpiresAt;
      if (exp !== undefined && exp > now) minMs = Math.min(minMs, exp - now);
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
  }, [state, settings, gateway, matchedDomain]);

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
