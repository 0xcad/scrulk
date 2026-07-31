const video = document.querySelector("video");
let stream: MediaStream | null = null;

function notify(type: "ready" | "error"): void {
  window.parent.postMessage({ source: "scrulk-camera", type }, "*");
}

function stop(): void {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
}

async function start(): Promise<void> {
  if (document.visibilityState !== "visible" || stream !== null) return;
  if (!video || !navigator.mediaDevices?.getUserMedia) {
    notify("error");
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = stream;
    await video.play();
    notify("ready");
  } catch {
    stop();
    notify("error");
  }
}

window.addEventListener("pagehide", stop);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    void start();
  } else {
    stop();
  }
});
void start();
