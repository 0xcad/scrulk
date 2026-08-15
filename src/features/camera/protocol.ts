export const CAMERA_PORT = "scrulk-camera-viewer";

export type CameraViewerMessage =
  | { type: "viewer-ready" }
  | { type: "answer"; sdp: string }
  | { type: "candidate"; candidate: RTCIceCandidateInit };

export type CameraHubMessage =
  | { type: "offer"; sdp: string }
  | { type: "candidate"; candidate: RTCIceCandidateInit };

function isCandidate(value: unknown): value is RTCIceCandidateInit {
  return value !== null && typeof value === "object";
}

export function isCameraViewerMessage(value: unknown): value is CameraViewerMessage {
  if (value === null || typeof value !== "object" || !("type" in value)) return false;
  const message = value as Record<string, unknown>;
  if (message["type"] === "viewer-ready") return true;
  if (message["type"] === "answer") return typeof message["sdp"] === "string";
  return message["type"] === "candidate" && isCandidate(message["candidate"]);
}

export function isCameraHubMessage(value: unknown): value is CameraHubMessage {
  if (value === null || typeof value !== "object" || !("type" in value)) return false;
  const message = value as Record<string, unknown>;
  if (message["type"] === "offer") return typeof message["sdp"] === "string";
  return message["type"] === "candidate" && isCandidate(message["candidate"]);
}
