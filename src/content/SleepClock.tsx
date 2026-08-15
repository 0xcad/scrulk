import { useEffect, useRef, useState } from "preact/hooks";
import { getSettings, onSettingsChange, setSettings } from "../shared/storage";
import type { ClockPosition } from "../shared/uiTypes";
import { formatDuration, nextWakeUpAt } from "../shared/wakeDay";

const VISIBILITY_WINDOW_MS = 10 * 60 * 60 * 1000;
const HIDE_BEFORE_MS = 2 * 60 * 60 * 1000;

function defaultPos(): ClockPosition {
  return { x: Math.max(16, window.innerWidth - 220), y: 16 };
}

/**
 * Universal countdown to the next wake-up time. Visible only during
 * `[wakeUp - 10h, wakeUp]`; outside that window the component returns null
 * and renders nothing. Lives in the same Shadow-DOM root as `UsageClock`
 * and `BreaktimeOverlay`, so all CSS selectors here are scoped under
 * `.sleep` to avoid clobbering sibling styles.
 *
 * Position is stored as a single global `settings.sleepClockPosition` (the
 * sleep clock isn't per-domain; it's the same on every site).
 */
export function SleepClock() {
  const [wakeUpTime, setWakeUpTime] = useState<string | null>(null);
  const [pos, setPos] = useState<ClockPosition>(defaultPos);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    void getSettings().then((s) => {
      setWakeUpTime(s.wakeUpTime);
      if (s.sleepClockPosition) setPos(s.sleepClockPosition);
    });
    return onSettingsChange((s) => {
      setWakeUpTime(s.wakeUpTime);
      if (s.sleepClockPosition) setPos(s.sleepClockPosition);
    });
  }, []);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 1000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const dragRef = useRef<{ dx: number; dy: number; w: number; h: number } | null>(null);
  const onPointerDown = (e: PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    dragRef.current = {
      dx: e.clientX - pos.x,
      dy: e.clientY - pos.y,
      w: target.offsetWidth,
      h: target.offsetHeight,
    };
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const x = clamp(e.clientX - d.dx, 0, window.innerWidth - d.w);
    const y = clamp(e.clientY - d.dy, 0, window.innerHeight - d.h);
    setPos({ x, y });
  };
  const onPointerUp = async () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    await setSettings({ sleepClockPosition: pos });
  };

  if (wakeUpTime === null) return null;
  const remaining = nextWakeUpAt(now, wakeUpTime) - now;
  if (remaining <= HIDE_BEFORE_MS || remaining > VISIBILITY_WINDOW_MS) return null;

  return (
    <>
      <style>{styles}</style>
      <div
        class="sleep"
        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        title={`Wake-up at ${wakeUpTime} (drag to move)`}
      >
        <span class="sleep-dot" aria-hidden="true" />
        <span class="sleep-time">{formatDuration(remaining)}</span>
        <span class="sleep-label">until wake-up</span>
      </div>
    </>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

const styles = `
  .sleep {
    position: fixed;
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: rgba(20, 20, 40, 0.85);
    color: #e6e6ff;
    font: 600 12px/1 system-ui, sans-serif;
    border-radius: 999px;
    cursor: grab;
    user-select: none;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  }
  .sleep:active { cursor: grabbing; }
  .sleep-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #6c8cff;
    box-shadow: inset -2px -2px 0 rgba(255, 255, 255, 0.3);
  }
  .sleep-time { font-variant-numeric: tabular-nums; }
  .sleep-label { opacity: 0.65; font-weight: 500; }
`;
