import { describe, expect, it } from "vitest";
import { fromPixelGeometry, safeGeometry, toPixelGeometry } from "./geometry";

describe("waiting widget geometry", () => {
  it("keeps the same pixel spacing between widgets across viewport sizes", () => {
    const left = { offsetX: -175, offsetY: 40, width: 100, height: 80, rotation: 0 };
    const right = { offsetX: 125, offsetY: 40, width: 100, height: 80, rotation: 0 };

    for (const [width, height] of [[1200, 500], [400, 1000]] as const) {
      const leftPixel = toPixelGeometry(left, width, height);
      const rightPixel = toPixelGeometry(right, width, height);
      const leftCenter = leftPixel.left + leftPixel.width / 2;
      const rightCenter = rightPixel.left + rightPixel.width / 2;

      expect(rightCenter - leftCenter).toBe(300);
      expect(leftPixel.top + leftPixel.height / 2).toBe(height / 2 + 40);
    }
  });

  it("round-trips centered pixel geometry", () => {
    const original = { offsetX: 80, offsetY: -60, width: 300, height: 120, rotation: 12 };
    const pixel = toPixelGeometry(original, 1000, 600);
    expect(fromPixelGeometry(pixel, 1000, 600)).toEqual(original);
  });

  it("keeps dimensions fixed and allows widgets to be completely offscreen", () => {
    const original = { offsetX: 600, offsetY: 0, width: 600, height: 300, rotation: 0 };
    const narrow = toPixelGeometry(original, 300, 500);

    expect(narrow).toMatchObject({ width: 600, height: 300 });
    expect(narrow.left).toBeGreaterThanOrEqual(300);
    expect(safeGeometry(original)).toEqual(original);

    const wideAgain = toPixelGeometry(original, 1000, 500);
    expect(wideAgain).toMatchObject({ width: 600, height: 300 });
  });
});
