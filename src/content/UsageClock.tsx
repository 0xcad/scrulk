import { useEffect, useRef, useState } from "preact/hooks";
import {
  getDayState,
  getSettings,
  onDayStateChange,
  onSettingsChange,
  setSettings,
} from "../shared/storage";
import type { ClockPosition, DayState } from "../shared/types";
import { DEFAULT_DAY_STATE, effectiveAllSitesMs, effectiveMs } from "../shared/types";
import { formatDuration } from "../shared/wakeDay";

interface Props {
  matchedDomain: string | null;
  alwaysShowTimer: boolean;
}

const DEFAULT_POS: ClockPosition = { x: 16, y: 16 };

export function UsageClock({ matchedDomain, alwaysShowTimer }: Props) {
  const [state, setState] = useState<DayState>(DEFAULT_DAY_STATE);
  const [pos, setPos] = useState<ClockPosition>(DEFAULT_POS);
  const [now, setNow] = useState(Date.now());
  const [expanded, setExpanded] = useState(false);

  // Initial loads + subscriptions.
  useEffect(() => {
    void getDayState().then(setState);
    const positionFor = (s: Awaited<ReturnType<typeof getSettings>>) =>
      matchedDomain === null
        ? s.allSitesClockPosition ?? DEFAULT_POS
        : s.clockPositions[matchedDomain] ?? DEFAULT_POS;
    void getSettings().then((s) => {
      setPos(positionFor(s));
      setExpanded(s.alwaysShowTimerExpanded);
    });
    const offState = onDayStateChange(setState);
    const offSettings = onSettingsChange((s) => {
      setPos(positionFor(s));
      setExpanded(s.alwaysShowTimerExpanded);
    });
    return () => {
      offState();
      offSettings();
    };
  }, [matchedDomain]);

  // Tick once per second while page is visible AND a segment is open.
  // (When `activeSince` is null the displayed value is static.)
  useEffect(() => {
    if (
      state.activeSince === null &&
      state.allSitesActiveSince === null
    ) return;
    if (document.visibilityState !== "visible") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [
    state.activeSince,
    state.totalMs,
    state.allSitesActiveSince,
    state.allSitesMs,
  ]);

  // Drag handling.
  const dragRef = useRef<{
    dx: number;
    dy: number;
    w: number;
    h: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const onPointerDown = (e: PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    dragRef.current = {
      dx: e.clientX - pos.x,
      dy: e.clientY - pos.y,
      w: target.offsetWidth,
      h: target.offsetHeight,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const drag = dragRef.current;
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 3) {
      drag.moved = true;
    }
    const x = clamp(e.clientX - drag.dx, 0, window.innerWidth - drag.w);
    const y = clamp(e.clientY - drag.dy, 0, window.innerHeight - drag.h);
    setPos({ x, y });
  };
  const onPointerUp = async () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (!drag.moved) {
      if (alwaysShowTimer) {
        const settings = await getSettings();
        await setSettings({ alwaysShowTimerExpanded: !settings.alwaysShowTimerExpanded });
      }
      return;
    }
    const settings = await getSettings();
    if (matchedDomain === null) {
      await setSettings({ allSitesClockPosition: pos });
      return;
    }
    await setSettings({
      clockPositions: { ...settings.clockPositions, [matchedDomain]: pos },
    });
  };

  const trackedDisplay = formatDuration(effectiveMs(state, now));
  const allSitesDisplay = formatDuration(effectiveAllSitesMs(state, now));
  const showRows = alwaysShowTimer && expanded;
  const display = alwaysShowTimer ? allSitesDisplay : trackedDisplay;

  return (
    <>
      <style>{styles}</style>
      <div
        class="clock"
        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { dragRef.current = null; }}
        title="Scroll Unlock — usage today (drag to move)"
      >
        <span class="dot" aria-hidden="true" />
        {showRows ? (
          <span class="times">
            {alwaysShowTimer && (
              <span class="timer-row">
                <span class="time">{allSitesDisplay}</span>
                <span class="label">total</span>
              </span>
            )}
            <span class="timer-row">
              <span class="time">{trackedDisplay}</span>
              <span class="label">tracked</span>
            </span>
          </span>
        ) : <span class="time">{display}</span>}
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
    align-items: flex-start;
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
    margin-top: 2px;
  }
  .time { font-variant-numeric: tabular-nums; text-align: left; }
  .times { display: grid; gap: 2px; min-width: 92px; }
  .timer-row {
    display: grid;
    grid-template-columns: max-content 1fr;
    column-gap: 8px;
  }
  .label { text-align: right; opacity: 0.72; font-weight: 500; }
`;
