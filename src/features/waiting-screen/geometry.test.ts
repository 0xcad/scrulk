import { describe, expect, it } from "vitest";
import { fromPixelGeometry, safeGeometry, toPixelGeometry } from "./geometry";

describe("waiting widget geometry", () => {
  it("keeps rotated widgets completely inside wide and tall viewports", () => {
    for (const [width, height] of [[1200, 500], [400, 1000]] as const) {
      const safe = safeGeometry({ x: -1, y: 2, width: 0.8, height: 0.7, rotation: 45 }, width, height);
      const radians = safe.rotation * Math.PI / 180;
      const extentX = (Math.abs(Math.cos(radians)) * safe.width * width + Math.abs(Math.sin(radians)) * safe.height * height) / 2;
      const extentY = (Math.abs(Math.sin(radians)) * safe.width * width + Math.abs(Math.cos(radians)) * safe.height * height) / 2;
      expect(safe.x * width - extentX).toBeGreaterThanOrEqual(-0.0001);
      expect(safe.x * width + extentX).toBeLessThanOrEqual(width + 0.0001);
      expect(safe.y * height - extentY).toBeGreaterThanOrEqual(-0.0001);
      expect(safe.y * height + extentY).toBeLessThanOrEqual(height + 0.0001);
    }
  });

  it("round-trips safe pixel geometry", () => {
    const original = { x: 0.5, y: 0.4, width: 0.3, height: 0.2, rotation: 12 };
    const pixel = toPixelGeometry(original, 1000, 600);
    expect(fromPixelGeometry(pixel, 1000, 600)).toEqual(original);
  });
});
