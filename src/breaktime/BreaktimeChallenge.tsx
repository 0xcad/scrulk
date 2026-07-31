import { useEffect, useRef, useState } from "preact/hooks";
import browser from "webextension-polyfill";
import type { Message } from "../shared/messages";
import { Challenge } from "../content/Challenge";

type CameraState = "loading" | "ready" | "unavailable";

function send(msg: Message): Promise<unknown> {
  return browser.runtime.sendMessage(msg);
}

export function BreaktimeChallenge() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraState, setCameraState] = useState<CameraState>("loading");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let disposed = false;

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState("unavailable");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => null);
        }
        setCameraState("ready");
      } catch {
        setCameraState("unavailable");
      }
    };

    void startCamera();
    return () => {
      disposed = true;
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  const onComplete = () => {
    void send({ type: "breaktime:resume" });
  };

  return (
    <main class="breaktime-page">
      <div class="card camera-card">
        {cameraState === "unavailable" && (
          <p class="camera-status" role="status">
            Camera unavailable. You can still complete the hold challenge.
          </p>
        )}
        <video
          ref={videoRef}
          class={cameraState === "ready" ? "camera" : "camera camera-loading"}
          autoplay
          muted
          playsinline
          aria-label="Live camera reflection"
        />
        {cameraState === "loading" && <p class="camera-status">Starting camera…</p>}
      </div>
      <div class="card">
        <Challenge onComplete={onComplete} />
      </div>
    </main>
  );
}
