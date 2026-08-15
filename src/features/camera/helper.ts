import browser from "webextension-polyfill";
import { setSettings } from "../../shared/storage";
import {
  CAMERA_PORT,
  isCameraViewerMessage,
  type CameraHubMessage,
  type CameraViewerMessage,
} from "./protocol";

interface ViewerPeer {
  peer: RTCPeerConnection;
  pendingCandidates: RTCIceCandidateInit[];
}

const video = document.querySelector("video");
const status = document.querySelector<HTMLElement>("[data-status]");
const retry = document.querySelector<HTMLButtonElement>("[data-retry]");
const viewers = new Set<browser.Runtime.Port>();
const peers = new Map<browser.Runtime.Port, ViewerPeer>();
let stream: MediaStream | null = null;
let starting = false;

// Register synchronously so tracked-site viewers can connect as soon as this
// top-level extension page exists.
browser.runtime.onConnect.addListener((port) => {
  if (port.name !== CAMERA_PORT) return;
  viewers.add(port);

  port.onMessage.addListener((raw: unknown) => {
    if (isCameraViewerMessage(raw)) void handleViewerMessage(port, raw);
  });
  port.onDisconnect.addListener(() => {
    viewers.delete(port);
    closePeer(port);
  });
});

async function handleViewerMessage(
  port: browser.Runtime.Port,
  message: CameraViewerMessage,
): Promise<void> {
  if (message.type === "viewer-ready") {
    if (stream) await openPeer(port);
    return;
  }

  const state = peers.get(port);
  if (!state) return;
  if (message.type === "answer") {
    await state.peer.setRemoteDescription({
      type: "answer",
      sdp: message.sdp,
    });
    for (const candidate of state.pendingCandidates.splice(0)) {
      await state.peer.addIceCandidate(candidate);
    }
  } else if (message.type === "candidate") {
    if (state.peer.remoteDescription) {
      await state.peer.addIceCandidate(message.candidate);
    } else {
      state.pendingCandidates.push(message.candidate);
    }
  }
}

async function openPeer(port: browser.Runtime.Port): Promise<void> {
  if (!stream || peers.has(port)) return;
  const peer = new RTCPeerConnection({ iceServers: [] });
  peers.set(port, { peer, pendingCandidates: [] });
  for (const track of stream.getTracks()) {
    peer.addTrack(track, stream);
  }
  peer.onicecandidate = (event) => {
    if (!event.candidate) return;
    const message: CameraHubMessage = {
      type: "candidate",
      candidate: event.candidate.toJSON(),
    };
    port.postMessage(message);
  };
  peer.onconnectionstatechange = () => {
    if (peer.connectionState === "failed" || peer.connectionState === "closed") {
      closePeer(port);
    }
  };

  try {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    if (offer.sdp) {
      const message: CameraHubMessage = { type: "offer", sdp: offer.sdp };
      port.postMessage(message);
    }
  } catch {
    closePeer(port);
  }
}

function closePeer(port: browser.Runtime.Port): void {
  peers.get(port)?.peer.close();
  peers.delete(port);
}

async function startCamera(): Promise<void> {
  if (stream || starting) return;
  starting = true;
  retry?.setAttribute("hidden", "");
  if (status) status.textContent = "Waiting for Firefox camera permission…";

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    if (video) {
      video.srcObject = stream;
      await video.play();
    }
    if (status) {
      status.textContent =
        "Camera connected. Keep this helper tab open while using the overlay.";
    }
    await setSettings({ cameraOverlayPermission: "granted" });
    for (const port of viewers) {
      await openPeer(port);
    }
    await returnToOpener();
  } catch {
    stopCamera();
    if (status) {
      status.textContent =
        "Scroll Unlock could not access the camera. Update Firefox’s permission for this extension, then retry.";
    }
    retry?.removeAttribute("hidden");
    await setSettings({ cameraOverlayPermission: "denied" });
  } finally {
    starting = false;
  }
}

function stopCamera(): void {
  for (const port of peers.keys()) closePeer(port);
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  if (video) video.srcObject = null;
}

async function returnToOpener(): Promise<void> {
  const current = await browser.tabs.getCurrent();
  if (
    current?.active &&
    current.openerTabId !== undefined &&
    current.openerTabId !== current.id
  ) {
    await browser.tabs
      .update(current.openerTabId, { active: true })
      .catch(() => null);
  }
}

retry?.addEventListener("click", () => {
  void startCamera();
});
window.addEventListener("pagehide", stopCamera);
void startCamera();
