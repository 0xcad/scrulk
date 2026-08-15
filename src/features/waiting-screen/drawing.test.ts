import { describe, expect, it } from "vitest";
import { appendDownsampledPoint } from "./drawing";

describe("drawing strokes", () => {
  it("downsamples nearby pointer events while preserving meaningful movement", () => {
    const points = [{ x: 0.1, y: 0.1 }];
    expect(appendDownsampledPoint(points, { x: 0.1001, y: 0.1001 }, 1000, 1000)).toBe(points);
    expect(appendDownsampledPoint(points, { x: 0.2, y: 0.2 }, 1000, 1000))
      .toEqual([...points, { x: 0.2, y: 0.2 }]);
  });
});
