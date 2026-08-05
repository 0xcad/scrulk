import { useEffect, useRef, useState } from "preact/hooks";
import browser from "webextension-polyfill";
import type { Message } from "../shared/messages";
import {
  CAMERA_ASPECT_RATIO,
  CAMERA_MIN_SIZE,
  cameraSizeForWidth,
  resizedCameraSize,
} from "../shared/camera";
import { getSettings, setSettings } from "../shared/storage";
import type {
  CameraOverlayPermission,
  CameraOverlaySize,
  ClockPosition,
} from "../shared/types";

const DEFAULT_POS: ClockPosition = { x: 16, y: 64 };
const CAMERA_PORT = "scrulk-camera-viewer";
const WATCHDOG_INTERVAL_MS = 2_000;
const STALLED_AFTER_MS = 6_000;
const CAMERA_BORDER_PX = 4;

type HubMessage =
  | { type: "offer"; sdp: string }
  | { type: "candidate"; candidate: RTCIceCandidateInit };

type ViewerMessage =
  | { type: "viewer-ready" }
  | { type: "answer"; sdp: string }
  | { type: "candidate"; candidate: RTCIceCandidateInit };

type InboundVideoStats = {
  type?: string;
  kind?: string;
  mediaType?: string;
  framesDecoded?: number;
  framesReceived?: number;
};

/**
 * Receives a WebRTC track from the extension-owned camera helper tab.
 * This context never calls getUserMedia, so the tracked site is never granted
 * camera permission or direct access to the capture device.
 */
interface Props {
  permission: CameraOverlayPermission;
}

export function CameraOverlay({ permission }: Props) {
  const [pos, setPos] = useState<ClockPosition>(DEFAULT_POS);
  const [size, setSize] = useState<CameraOverlaySize>(CAMERA_MIN_SIZE);
  const [ready, setReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragRef = useRef<{
    dx: number;
    dy: number;
    w: number;
    h: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    size: CameraOverlaySize;
  } | null>(null);

  useEffect(() => {
    void getSettings().then((settings) => {
      const savedPos = settings.cameraOverlayPosition ?? DEFAULT_POS;
      setPos(savedPos);
      setSize(
        cameraSizeForWidth(
          settings.cameraOverlaySize?.width ?? CAMERA_MIN_SIZE.width,
          maxCameraWidth(savedPos),
        ),
      );
    });
  }, []);

  const openCameraHub = () => {
    const message: Message = { type: "camera:enable" };
    void browser.runtime.sendMessage(message).catch(() => null);
  };

  useEffect(() => {
    if (permission === "denied") {
      setReady(false);
      if (videoRef.current) videoRef.current.srcObject = null;
      return;
    }

    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let watchdogTimer: ReturnType<typeof setInterval> | null = null;
    let currentPort: browser.Runtime.Port | null = null;
    let currentPeer: RTCPeerConnection | null = null;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      reconnectTimer = null;
    };

    const clearWatchdog = () => {
      if (watchdogTimer !== null) clearInterval(watchdogTimer);
      watchdogTimer = null;
    };

    const clearConnection = (disconnectPort: boolean) => {
      const port = currentPort;
      const peer = currentPeer;
      currentPort = null;
      currentPeer = null;
      clearWatchdog();
      if (disconnectPort) port?.disconnect();
      peer?.close();
      if (!disposed) setReady(false);
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const scheduleReconnect = () => {
      if (
        disposed ||
        document.visibilityState !== "visible" ||
        reconnectTimer !== null
      ) {
        return;
      }
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, 750);
    };

    const startWatchdog = (peer: RTCPeerConnection) => {
      clearWatchdog();
      let lastFrameCount = 0;
      let lastAdvanceAt = Date.now();

      watchdogTimer = setInterval(() => {
        if (
          disposed ||
          currentPeer !== peer ||
          document.visibilityState !== "visible"
        ) {
          return;
        }
        void peer.getStats().then((report) => {
          if (currentPeer !== peer) return;
          let frameCount: number | null = null;
          report.forEach((raw) => {
            const stats = raw as InboundVideoStats;
            if (
              stats.type === "inbound-rtp" &&
              (stats.kind === "video" || stats.mediaType === "video")
            ) {
              frameCount =
                stats.framesDecoded ??
                stats.framesReceived ??
                frameCount;
            }
          });
          if (frameCount === null) return;
          if (frameCount > lastFrameCount) {
            lastFrameCount = frameCount;
            lastAdvanceAt = Date.now();
            return;
          }
          if (
            lastFrameCount > 0 &&
            Date.now() - lastAdvanceAt >= STALLED_AFTER_MS
          ) {
            clearConnection(true);
            scheduleReconnect();
          }
        }).catch(() => null);
      }, WATCHDOG_INTERVAL_MS);
    };

    const connect = () => {
      if (disposed || document.visibilityState !== "visible") return;
      clearConnection(true);

      const port = browser.runtime.connect({ name: CAMERA_PORT });
      const peer = new RTCPeerConnection({ iceServers: [] });
      const pendingCandidates: RTCIceCandidateInit[] = [];
      currentPort = port;
      currentPeer = peer;
      peer.addTransceiver("video", { direction: "recvonly" });

      peer.onicecandidate = (event) => {
        if (!event.candidate || currentPort !== port) return;
        const message: ViewerMessage = {
          type: "candidate",
          candidate: event.candidate.toJSON(),
        };
        port.postMessage(message);
      };

      peer.ontrack = (event) => {
        if (currentPeer !== peer) return;
        const incoming = event.streams[0] ?? new MediaStream([event.track]);
        const video = videoRef.current;
        if (video) {
          video.srcObject = incoming;
          void video.play().catch(() => null);
        }
      };

      peer.onconnectionstatechange = () => {
        if (currentPeer !== peer) return;
        if (peer.connectionState === "connected") {
          startWatchdog(peer);
          return;
        }
        if (
          peer.connectionState === "disconnected" ||
          peer.connectionState === "failed" ||
          peer.connectionState === "closed"
        ) {
          clearConnection(true);
          scheduleReconnect();
        }
      };

      const handleMessage = async (raw: unknown) => {
        const message = raw as HubMessage;
        try {
          if (message.type === "offer") {
            await peer.setRemoteDescription({
              type: "offer",
              sdp: message.sdp,
            });
            for (const candidate of pendingCandidates.splice(0)) {
              await peer.addIceCandidate(candidate);
            }
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            if (answer.sdp) {
              const response: ViewerMessage = {
                type: "answer",
                sdp: answer.sdp,
              };
              port.postMessage(response);
            }
          } else if (message.type === "candidate") {
            if (peer.remoteDescription) {
              await peer.addIceCandidate(message.candidate);
            } else {
              pendingCandidates.push(message.candidate);
            }
          }
        } catch {
          if (currentPeer === peer) {
            clearConnection(true);
            scheduleReconnect();
          }
        }
      };

      port.onMessage.addListener((message: unknown) => {
        void handleMessage(message);
      });
      port.onDisconnect.addListener(() => {
        if (currentPort !== port) return;
        // A closed helper tab is respected until the tracked page is next
        // mounted or activated. Do not immediately recreate it here.
        currentPort = null;
        currentPeer = null;
        clearReconnectTimer();
        clearWatchdog();
        peer.close();
        if (!disposed) setReady(false);
        if (videoRef.current) videoRef.current.srcObject = null;
      });

      const message: ViewerMessage = { type: "viewer-ready" };
      port.postMessage(message);
    };

    const ensureAndConnect = async () => {
      if (disposed || document.visibilityState !== "visible") return;
      const message: Message = { type: "camera:ensure" };
      try {
        await browser.runtime.sendMessage(message);
        if (!disposed && document.visibilityState === "visible") connect();
      } catch {
        if (!disposed) setReady(false);
      }
    };

    const onVisibilityChange = () => {
      clearReconnectTimer();
      if (document.visibilityState === "visible") {
        void ensureAndConnect();
      } else {
        clearConnection(true);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    if (document.visibilityState === "visible") void ensureAndConnect();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearReconnectTimer();
      clearConnection(true);
    };
  }, [permission]);

  const onPointerDown = (event: PointerEvent) => {
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    dragRef.current = {
      dx: event.clientX - pos.x,
      dy: event.clientY - pos.y,
      w: target.offsetWidth,
      h: target.offsetHeight,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  };
  const onPointerMove = (event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (
      Math.abs(event.clientX - drag.startX) > 4 ||
      Math.abs(event.clientY - drag.startY) > 4
    ) {
      drag.moved = true;
    }
    setPos({
      x: clamp(event.clientX - drag.dx, 0, window.innerWidth - drag.w),
      y: clamp(event.clientY - drag.dy, 0, window.innerHeight - drag.h),
    });
  };
  const onPointerUp = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    void setSettings({ cameraOverlayPosition: pos });
    if (!drag.moved && !ready) openCameraHub();
  };

  const onResizePointerDown = (event: PointerEvent) => {
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startWidth: size.width,
      size,
    };
  };

  const onResizePointerMove = (event: PointerEvent) => {
    event.stopPropagation();
    const resize = resizeRef.current;
    if (!resize) return;
    const next = resizedCameraSize(
      resize.startWidth,
      event.clientX - resize.startX,
      event.clientY - resize.startY,
      maxCameraWidth(pos),
    );
    resize.size = next;
    setSize(next);
  };

  const onResizePointerUp = (event: PointerEvent) => {
    event.stopPropagation();
    const resize = resizeRef.current;
    if (!resize) return;
    resizeRef.current = null;
    void setSettings({ cameraOverlaySize: resize.size });
  };

  const resizeByKeyboard = (delta: number) => {
    const next = cameraSizeForWidth(
      size.width + delta,
      maxCameraWidth(pos),
    );
    setSize(next);
    void setSettings({ cameraOverlaySize: next });
  };

  const unavailable = permission === "denied";

  return (
    <>
      <style>{styles}</style>
      <div
        class={`camera${ready ? " ready" : ""}`}
        style={{
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
        }}
        title={
          unavailable
            ? "Camera access unavailable (click to retry)"
            : ready
              ? "Scroll Unlock camera preview (drag to move)"
              : "Camera connecting (click to reopen helper tab)"
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { dragRef.current = null; }}
      >
        <video
          ref={videoRef}
          autoplay
          muted
          playsInline
          aria-label="Your camera preview"
          onPlaying={() => setReady(true)}
          onWaiting={() => setReady(false)}
          onStalled={() => setReady(false)}
        />
        {!ready && (
          <span class={unavailable ? "connecting error" : "connecting"}>
            {unavailable
              ? "camera access unavailable — click to retry"
              : "connecting…"}
          </span>
        )}
        <span class="indicator" aria-label="Camera active" />
        <button
          type="button"
          class="resize-handle"
          aria-label="Resize camera preview"
          title="Resize camera preview"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={(event) => {
            event.stopPropagation();
            resizeRef.current = null;
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              event.preventDefault();
              resizeByKeyboard(16);
            } else if (
              event.key === "ArrowLeft" ||
              event.key === "ArrowUp"
            ) {
              event.preventDefault();
              resizeByKeyboard(-16);
            }
          }}
        />
      </div>
    </>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function maxCameraWidth(pos: ClockPosition): number {
  const horizontalRoom = window.innerWidth - pos.x - CAMERA_BORDER_PX;
  const verticalRoom =
    (window.innerHeight - pos.y - CAMERA_BORDER_PX) * CAMERA_ASPECT_RATIO;
  return Math.max(
    CAMERA_MIN_SIZE.width,
    Math.min(horizontalRoom, verticalRoom),
  );
}

const styles = `
  :host { all: initial; }
  .camera {
    position: fixed;
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
  video {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scaleX(-1);
    pointer-events: none;
  }
  .connecting {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(22, 22, 26, 0.82);
    color: white;
    font: 600 12px/1 system-ui, sans-serif;
  }
  .connecting.error {
    padding: 12px;
    box-sizing: border-box;
    color: #ffd4cf;
    text-align: center;
    line-height: 1.35;
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
  .camera:not(.ready) .indicator { opacity: 0.35; }
  .resize-handle {
    position: absolute;
    right: 0;
    bottom: 0;
    z-index: 2;
    width: 24px;
    height: 24px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background:
      linear-gradient(
        135deg,
        transparent 0 48%,
        rgba(255, 255, 255, 0.9) 49% 56%,
        transparent 57% 64%,
        rgba(255, 255, 255, 0.9) 65% 72%,
        transparent 73%
      );
    color: white;
    cursor: nwse-resize;
    touch-action: none;
  }
  .resize-handle:focus-visible {
    outline: 2px solid white;
    outline-offset: -4px;
  }
`;
