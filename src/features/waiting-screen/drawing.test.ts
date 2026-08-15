import { describe, expect, it } from "vitest";
import {
  appendDownsampledPoint,
  commitDrawingGesture,
  createDrawingHistory,
  cropDrawingWidget,
  eraseBrushStrokes,
  redoDrawing,
  undoDrawing,
} from "./drawing";
import type { DrawingStroke, WaitingDrawingWidget } from "./model";

const horizontal: DrawingStroke = {
  tool: "brush",
  color: "#111111",
  size: 0.02,
  points: [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }],
};

describe("drawing strokes", () => {
  it("downsamples nearby pointer events while preserving meaningful movement", () => {
    const points = [{ x: 0.1, y: 0.1 }];
    expect(appendDownsampledPoint(points, { x: 0.1001, y: 0.1001 }, 1000, 1000)).toBe(points);
    expect(appendDownsampledPoint(points, { x: 0.2, y: 0.2 }, 1000, 1000))
      .toEqual([...points, { x: 0.2, y: 0.2 }]);
  });

  it("deletes complete brush strokes touched between eraser samples", () => {
    const untouched = {
      ...horizontal,
      points: horizontal.points.map((point) => ({ ...point, y: 0.8 })),
    };
    const next = eraseBrushStrokes(
      [horizontal, untouched],
      [{ x: 0.5, y: 0.4 }, { x: 0.5, y: 0.6 }],
      0.02,
      1000,
      1000,
    );
    expect(next).toEqual([untouched]);
  });

  it("undoes and redoes a whole gesture snapshot", () => {
    const before = [horizontal];
    const after: DrawingStroke[] = [];
    const committed = commitDrawingGesture(
      { ...createDrawingHistory(before), present: after },
      before,
    );
    expect(undoDrawing(committed).present).toEqual(before);
    expect(redoDrawing(undoDrawing(committed)).present).toEqual(after);
  });

  it("crops to stroke bounds plus padding while preserving rendered size", () => {
    const widget: WaitingDrawingWidget = {
      id: "drawing",
      type: "drawing",
      strokes: [horizontal],
      offsetX: 0,
      offsetY: 0,
      width: 500,
      height: 500,
      rotation: 0,
    };
    const cropped = cropDrawingWidget(widget, [horizontal], 1000, 1000);
    expect(cropped).not.toBeNull();
    expect(cropped?.offsetX).toBeCloseTo(0);
    expect(cropped?.offsetY).toBeCloseTo(0);
    expect(cropped?.width).toBeCloseTo(434);
    expect(cropped?.height).toBeCloseTo(34);
    const stroke = cropped?.strokes[0];
    expect(stroke?.points[0]?.x).toBeCloseTo(17 / 434);
    expect(stroke?.points[1]?.x).toBeCloseTo(417 / 434);
    expect((stroke?.size ?? 0) * 34).toBeCloseTo(10);
  });

  it("moves a rotated crop center in the rotated local direction", () => {
    const rightSide = {
      ...horizontal,
      points: [{ x: 0.75, y: 0.5 }, { x: 0.85, y: 0.5 }],
    };
    const widget: WaitingDrawingWidget = {
      id: "drawing",
      type: "drawing",
      strokes: [rightSide],
      offsetX: 0,
      offsetY: 0,
      width: 500,
      height: 500,
      rotation: 90,
    };
    const cropped = cropDrawingWidget(widget, [rightSide], 1000, 1000);
    expect(cropped?.offsetX).toBeCloseTo(0);
    expect(cropped?.offsetY).toBeGreaterThan(0);
  });

  it("does not pull an offscreen cropped drawing back into the viewport", () => {
    const edgeStroke = {
      ...horizontal,
      points: [{ x: 0.05, y: 0.05 }, { x: 0.2, y: 0.2 }],
    };
    const widget: WaitingDrawingWidget = {
      id: "edge-drawing",
      type: "drawing",
      strokes: [edgeStroke],
      offsetX: -600,
      offsetY: -600,
      width: 200,
      height: 200,
      rotation: 45,
    };
    const cropped = cropDrawingWidget(widget, [edgeStroke], 1000, 1000);
    expect(cropped).not.toBeNull();
    expect(cropped?.offsetX).toBeLessThan(-500);
    expect(cropped?.offsetY).toBeLessThan(-500);
  });

  it("returns null for an empty saved drawing", () => {
    const widget: WaitingDrawingWidget = {
      id: "drawing",
      type: "drawing",
      strokes: [],
      offsetX: 0,
      offsetY: 0,
      width: 500,
      height: 500,
      rotation: 0,
    };
    expect(cropDrawingWidget(widget, [], 1000, 1000)).toBeNull();
  });
});
