import { useEffect, useRef, useState } from "preact/hooks";
import browser from "webextension-polyfill";
import { getSettings, setSettings } from "../shared/storage";
import type { ClockPosition } from "../shared/types";

const DEFAULT_POS: ClockPosition = { x: 16, y: 64 };

type FrameMessage = {
  source: "scrulk-camera";
  type: "ready" | "error";
};

/**
 * The video itself lives in a moz-extension:// iframe. Calling getUserMedia
 * there keeps the browser permission attached to Scroll Unlock rather than to
 * the host page that contains this Shadow-DOM overlay.
 */
export function CameraOverlay() {
  const [pos, setPos] = useState<ClockPosition>(DEFAULT_POS);
  const [failed, setFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dragRef = useRef<{
    dx: number;
    dy: number;
    w: number;
    h: number;
  } | null>(null);

  useEffect(() => {
    void getSettings().then((settings) => {
      setPos(settings.cameraOverlayPosition ?? DEFAULT_POS);
    });
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const message = event.data as Partial<FrameMessage>;
      if (message.source === "scrulk-camera" && message.type === "error") {
        setFailed(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const onPointerDown = (event: PointerEvent) => {
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    dragRef.current = {
      dx: event.clientX - pos.x,
      dy: event.clientY - pos.y,
      w: target.offsetWidth,
      h: target.offsetHeight,
    };
  };
  const onPointerMove = (event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    setPos({
      x: clamp(event.clientX - drag.dx, 0, window.innerWidth - drag.w),
      y: clamp(event.clientY - drag.dy, 0, window.innerHeight - drag.h),
    });
  };
  const onPointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    void setSettings({ cameraOverlayPosition: pos });
  };

  if (failed) return null;

  return (
    <>
      <style>{styles}</style>
      <div
        class="camera"
        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
        title="Scroll Unlock camera preview (drag to move)"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { dragRef.current = null; }}
      >
        <iframe
          ref={iframeRef}
          src={browser.runtime.getURL("src/camera/index.html")}
          allow="camera"
          title="Your camera preview"
        />
        <span class="indicator" aria-label="Camera active" />
      </div>
    </>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

const styles = `
  :host { all: initial; }
  .camera {
    position: fixed;
    width: 160px;
    height: 120px;
    overflow: hidden;
    pointer-events: auto;
    border: 2px solid rgba(255, 255, 255, 0.92);
    border-radius: 12px;
    background: #16161a;
    box-shadow: 0 3px 14px rgba(0, 0, 0, 0.42);
    cursor: grab;
    touch-action: none;
  }
  .camera:active { cursor: grabbing; }
  iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    pointer-events: none;
  }
  .indicator {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #e74c3c;
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.35);
  }
`;
