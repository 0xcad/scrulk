import { useEffect, useRef, useState } from "preact/hooks";
import {
  getDayState,
  getSettings,
  onDayStateChange,
  onSettingsChange,
  setSettings,
} from "../shared/storage";
import type { ClockPosition, DayState } from "../shared/types";
import { DEFAULT_DAY_STATE, effectiveMs } from "../shared/types";
import { formatDuration } from "../shared/wakeDay";

interface Props {
  matchedDomain: string;
}

const DEFAULT_POS: ClockPosition = { x: 16, y: 16 };

export function UsageClock({ matchedDomain }: Props) {
  const [state, setState] = useState<DayState>(DEFAULT_DAY_STATE);
  const [pos, setPos] = useState<ClockPosition>(DEFAULT_POS);
  const [now, setNow] = useState(Date.now());

  // Initial loads + subscriptions.
  useEffect(() => {
    void getDayState().then(setState);
    void getSettings().then((s) =>
      setPos(s.clockPositions[matchedDomain] ?? DEFAULT_POS),
    );
    const offState = onDayStateChange(setState);
    const offSettings = onSettingsChange((s) =>
      setPos(s.clockPositions[matchedDomain] ?? DEFAULT_POS),
    );
    return () => {
      offState();
      offSettings();
    };
  }, [matchedDomain]);

  // Tick once per second while page is visible AND a segment is open.
  // (When `activeSince` is null the displayed value is static.)
  useEffect(() => {
    if (state.activeSince === null) return;
    if (document.visibilityState !== "visible") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.activeSince, state.totalMs]);

  // Drag handling.
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const onPointerDown = (e: PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const x = clamp(e.clientX - dragRef.current.dx, 0, window.innerWidth - 80);
    const y = clamp(e.clientY - dragRef.current.dy, 0, window.innerHeight - 30);
    setPos({ x, y });
  };
  const onPointerUp = async () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    const settings = await getSettings();
    await setSettings({
      clockPositions: { ...settings.clockPositions, [matchedDomain]: pos },
    });
  };

  const display = formatDuration(effectiveMs(state, now));

  return (
    <>
      <style>{styles}</style>
      <div
        class="clock"
        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        title="Scroll Unlock — usage today (drag to move)"
      >
        <span class="dot" aria-hidden="true" />
        <span class="time">{display}</span>
      </div>
    </>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

const styles = `
  :host { all: initial; }
  .clock {
    position: fixed;
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: rgba(20, 20, 24, 0.85);
    color: white;
    font: 600 12px/1 system-ui, sans-serif;
    border-radius: 999px;
    cursor: grab;
    user-select: none;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  }
  .clock:active { cursor: grabbing; }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #c0392b;
  }
  .time { font-variant-numeric: tabular-nums; }
`;
