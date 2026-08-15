import { describe, expect, it } from "vitest";
import {
  DEFAULT_WAITING_SCREEN,
  normalizeWaitingScreen,
  waitingQuestionsComplete,
  waitingScreenBytes,
  WAITING_SCREEN_MAX_BYTES,
} from "./model";
import type { WaitingTextWidget } from "./model";

describe("waiting-screen model", () => {
  it("provides the title and two default questions", () => {
    expect(DEFAULT_WAITING_SCREEN.widgets.map((widget) => widget.type))
      .toEqual(["text", "question", "question"]);
    expect(DEFAULT_WAITING_SCREEN.widgets[0]).toMatchObject({ markdown: "# waiting" });
  });

  it("normalizes supported widgets and drops duplicate or malformed entries", () => {
    const screen = normalizeWaitingScreen({ widgets: [
      { ...DEFAULT_WAITING_SCREEN.widgets[0], fontFamily: "unknown", offsetX: 40 },
      DEFAULT_WAITING_SCREEN.widgets[0],
      { id: "bad", type: "question" },
    ] });
    expect(screen.widgets).toHaveLength(1);
    expect(screen.widgets[0]).toMatchObject({ fontFamily: "sans", offsetX: 40 });
  });

  it("migrates legacy normalized geometry without changing centered pixel geometry", () => {
    const widget = DEFAULT_WAITING_SCREEN.widgets[0] as WaitingTextWidget;
    const legacy = normalizeWaitingScreen({
      widgets: [{
        id: widget.id,
        type: widget.type,
        markdown: widget.markdown,
        fontFamily: widget.fontFamily,
        x: 0.25,
        y: 0.75,
        width: 0.5,
        height: 0.2,
        rotation: 0,
      }],
    });
    const pixels = normalizeWaitingScreen({
      widgets: [{ ...widget, width: 640, height: 160 }],
    });

    expect(legacy.widgets[0]).toMatchObject({
      offsetX: -250,
      offsetY: 162.5,
      width: 500,
      height: 130,
    });
    expect(pixels.widgets[0]).toMatchObject({
      offsetX: widget.offsetX,
      offsetY: widget.offsetY,
      width: 640,
      height: 160,
    });
  });

  it("converts legacy eraser paths into whole-stroke deletion", () => {
    const base = {
      id: "legacy-drawing",
      type: "drawing",
      x: 0.5,
      y: 0.5,
      width: 0.5,
      height: 0.5,
      rotation: 0,
    };
    const brush = {
      tool: "brush",
      color: "#111111",
      size: 0.02,
      points: [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }],
    };
    const eraser = {
      tool: "eraser",
      color: "#111111",
      size: 0.02,
      points: [{ x: 0.5, y: 0.4 }, { x: 0.5, y: 0.6 }],
    };
    const laterBrush = { ...brush, points: [{ x: 0.2, y: 0.5 }, { x: 0.3, y: 0.5 }] };
    const screen = normalizeWaitingScreen({
      widgets: [{ ...base, strokes: [brush, eraser, laterBrush] }],
    });
    expect(screen.widgets[0]).toMatchObject({ strokes: [laterBrush] });
  });

  it("counts raw answer characters and treats an empty question list as complete", () => {
    const question = DEFAULT_WAITING_SCREEN.widgets[1]!;
    expect(waitingQuestionsComplete(DEFAULT_WAITING_SCREEN, {
      [question.id]: "                    ",
      [DEFAULT_WAITING_SCREEN.widgets[2]!.id]: "12345678901234567890",
    })).toBe(true);
    expect(waitingQuestionsComplete({ widgets: [] }, {})).toBe(true);
    expect(waitingQuestionsComplete(DEFAULT_WAITING_SCREEN, {})).toBe(false);
  });

  it("measures serialized UTF-8 bytes against the screen cap", () => {
    expect(waitingScreenBytes(DEFAULT_WAITING_SCREEN)).toBeLessThan(WAITING_SCREEN_MAX_BYTES);
    expect(waitingScreenBytes({ widgets: [{
      ...DEFAULT_WAITING_SCREEN.widgets[0]!,
      type: "text",
      markdown: "🙂".repeat(WAITING_SCREEN_MAX_BYTES / 2),
      fontFamily: "sans",
    }] })).toBeGreaterThan(WAITING_SCREEN_MAX_BYTES);
  });
});
