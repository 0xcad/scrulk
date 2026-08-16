import {
  FillStyle,
  Freehand,
  Highlighter,
  HorzAlign,
  Rectangle,
  Text,
  VertAlign,
} from "@dgmjs/core";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_EDITOR_PALETTE,
  initializeWaitingShape,
  paletteKinds,
  paletteTargets,
  textDefaultsForTool,
  updatePaletteDefaults,
} from "./editorPalette";
import { WAITING_QUESTION_TAG } from "./model";

describe("waiting editor palette", () => {
  it("shows controls for supported tools when nothing is selected", () => {
    expect(paletteKinds("Rectangle", [])).toEqual(["rectangle", "text"]);
    expect(paletteKinds("Text", [])).toEqual(["text"]);
    expect(paletteKinds("Freehand", [])).toEqual(["freehand"]);
    expect(paletteKinds("Highlighter", [])).toEqual([]);
    expect(paletteKinds("Select", [])).toEqual([]);
  });

  it("uses supported selections instead of the active tool", () => {
    const rectangle = new Rectangle();
    const question = new Rectangle();
    question.tags = [WAITING_QUESTION_TAG];
    const text = new Text();
    const freehand = new Freehand();
    const highlighter = new Highlighter();

    expect(paletteKinds("Text", [rectangle, question, text, freehand, highlighter])).toEqual([
      "rectangle",
      "text",
      "freehand",
    ]);
    expect(paletteKinds("Select", [question])).toEqual(["text"]);
    expect(paletteTargets("text", [rectangle, question, text])).toEqual([
      rectangle,
      question,
      text,
    ]);
    expect(paletteTargets("freehand", [rectangle, freehand, highlighter])).toEqual([freehand]);
    expect(paletteKinds("Rectangle", [highlighter])).toEqual([]);
  });

  it("initializes supported shapes from the current tool defaults", () => {
    const defaults = updatePaletteDefaults(
      updatePaletteDefaults(DEFAULT_EDITOR_PALETTE, "rectangle", {
        fillColor: "#ff0000",
        fillStyle: FillStyle.NONE,
      }),
      "text",
      {
        fontColor: "#0000ff",
        fontFamily: "serif",
        horzAlign: HorzAlign.RIGHT,
      },
    );
    const rectangle = new Rectangle();
    const text = new Text();
    const freehand = new Freehand();
    const highlighter = new Highlighter();

    initializeWaitingShape(rectangle, defaults);
    initializeWaitingShape(text, defaults);
    initializeWaitingShape(freehand, defaults);
    initializeWaitingShape(highlighter, defaults);

    expect(rectangle).toMatchObject({ fillColor: "#ff0000", fillStyle: FillStyle.NONE });
    expect(rectangle).toMatchObject({
      horzAlign: HorzAlign.LEFT,
      vertAlign: VertAlign.MIDDLE,
      padding: [4, 4, 4, 4],
    });
    expect(text).toMatchObject({
      fontColor: "#0000ff",
      fontFamily: "serif",
      horzAlign: HorzAlign.RIGHT,
    });
    expect(freehand).toMatchObject(DEFAULT_EDITOR_PALETTE.freehand);
    expect(highlighter.strokeColor).not.toBe(DEFAULT_EDITOR_PALETTE.freehand.strokeColor);
  });

  it("keeps per-tool vertical defaults and updates uniform text padding", () => {
    const rectangleDefaults = updatePaletteDefaults(
      DEFAULT_EDITOR_PALETTE,
      "text",
      { vertAlign: VertAlign.BOTTOM, padding: [7, 7, 7, 7] },
      "Rectangle",
    );

    expect(textDefaultsForTool(DEFAULT_EDITOR_PALETTE, "Text").vertAlign).toBe(VertAlign.TOP);
    expect(textDefaultsForTool(DEFAULT_EDITOR_PALETTE, "Rectangle").vertAlign)
      .toBe(VertAlign.MIDDLE);
    expect(rectangleDefaults.rectangleText).toMatchObject({
      vertAlign: VertAlign.BOTTOM,
      padding: [7, 7, 7, 7],
    });
    expect(rectangleDefaults.text).toEqual(DEFAULT_EDITOR_PALETTE.text);
  });
});
