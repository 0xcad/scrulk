import { useEffect, useRef, useState } from "preact/hooks";
import browser from "webextension-polyfill";
import { sendCommand } from "../../shared/messages";
import {
  CAMERA_PORT,
  isCameraHubMessage,
  type CameraViewerMessage,
} from "./protocol";
import {
  CAMERA_ASPECT_RATIO,
  CAMERA_MIN_SIZE,
  cameraSizeForWidth,
} from "./camera";
import { getSettings, setSettings } from "../../shared/storage";
import type {
  CameraOverlayPermission,
} from "../../shared/settings";
import type { CameraOverlaySize, ClockPosition } from "../../shared/uiTypes";
import { cameraStyles } from "./styles";

const DEFAULT_POS: ClockPosition = { x: 16, y: 64 };
const WATCHDOG_INTERVAL_MS = 2_000;
const STALLED_AFTER_MS = 6_000;
const CAMERA_BORDER_PX = 4;
const CAMERA_SIZE_SAVE_DELAY_MS = 250;

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
  const [sizeLoaded, setSizeLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const cameraRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const persistedSizeRef = useRef<CameraOverlaySize>(CAMERA_MIN_SIZE);
  const dragRef = useRef<{
    dx: number;
    dy: number;
    w: number;
    h: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  useEffect(() => {
    void getSettings().then((settings) => {
      const savedPos = settings.cameraOverlayPosition ?? DEFAULT_POS;
      const savedSize = cameraSizeForWidth(
        settings.cameraOverlaySize?.width ?? CAMERA_MIN_SIZE.width,
        maxCameraWidth(savedPos),
      );
      setPos(savedPos);
      setSize(savedSize);
      persistedSizeRef.current = savedSize;
      setSizeLoaded(true);
    });
  }, []);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera || !sizeLoaded) return;

    let pendingSize: CameraOverlaySize | null = null;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    const savePendingSize = () => {
      if (pendingSize === null) return;
      const next = pendingSize;
      pendingSize = null;
      persistedSizeRef.current = next;
      void setSettings({ cameraOverlaySize: next });
    };
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const next = cameraSizeForWidth(entry.contentRect.width);
      if (cameraSizesEqual(next, persistedSizeRef.current)) {
        pendingSize = null;
        if (saveTimer !== null) clearTimeout(saveTimer);
        saveTimer = null;
        return;
      }
      pendingSize = next;
      if (saveTimer !== null) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveTimer = null;
        savePendingSize();
      }, CAMERA_SIZE_SAVE_DELAY_MS);
    });
    observer.observe(camera);

    return () => {
      observer.disconnect();
      if (saveTimer !== null) clearTimeout(saveTimer);
      savePendingSize();
    };
  }, [sizeLoaded]);

  const openCameraHub = () => {
    void sendCommand({ type: "camera:enable" }).catch(() => null);
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
        const message: CameraViewerMessage = {
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
        if (!isCameraHubMessage(raw)) return;
        const message = raw;
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
              const response: CameraViewerMessage = {
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

      const message: CameraViewerMessage = { type: "viewer-ready" };
      port.postMessage(message);
    };

    const ensureAndConnect = async () => {
      if (disposed || document.visibilityState !== "visible") return;
      try {
        await sendCommand({ type: "camera:ensure" });
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
    const camera = cameraRef.current;
    dragRef.current = {
      dx: event.clientX - pos.x,
      dy: event.clientY - pos.y,
      w: camera?.offsetWidth ?? target.offsetWidth,
      h: camera?.offsetHeight ?? target.offsetHeight,
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

  const unavailable = permission === "denied";

  return (
    <>
      <style>{cameraStyles}</style>
      <div
        ref={cameraRef}
        class={`camera${ready ? " ready" : ""}`}
        style={{
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          width: `${size.width}px`,
          maxWidth: `${maxCameraWidth(pos)}px`,
        }}
        title={
          unavailable
            ? "Camera access unavailable (click to retry)"
            : ready
              ? "Scroll Unlock camera preview (drag to move)"
              : "Camera connecting (click to reopen helper tab)"
        }
      >
        <div
          class="camera-content"
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
        </div>
      </div>
    </>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function cameraSizesEqual(
  left: CameraOverlaySize,
  right: CameraOverlaySize,
): boolean {
  return left.width === right.width && left.height === right.height;
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
