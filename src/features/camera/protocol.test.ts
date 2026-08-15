import { describe, expect, it } from "vitest";
import { isCameraHubMessage, isCameraViewerMessage } from "./protocol";

describe("camera protocol guards", () => {
  it("accepts each valid direction-specific message", () => {
    expect(isCameraViewerMessage({ type: "viewer-ready" })).toBe(true);
    expect(isCameraViewerMessage({ type: "answer", sdp: "answer" })).toBe(true);
    expect(isCameraHubMessage({ type: "offer", sdp: "offer" })).toBe(true);
    expect(isCameraHubMessage({ type: "candidate", candidate: {} })).toBe(true);
  });

  it("rejects unknown, cross-direction, and malformed messages", () => {
    expect(isCameraViewerMessage({ type: "offer", sdp: "offer" })).toBe(false);
    expect(isCameraHubMessage({ type: "viewer-ready" })).toBe(false);
    expect(isCameraHubMessage({ type: "offer" })).toBe(false);
    expect(isCameraViewerMessage(null)).toBe(false);
  });
});
