import {
  FillStyle,
  Freehand,
  Highlighter,
  HorzAlign,
  Rectangle,
  Text,
} from "@dgmjs/core";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_EDITOR_PALETTE,
  initializeWaitingShape,
  paletteKinds,
  paletteTargets,
  updatePaletteDefaults,
} from "./editorPalette";

describe("waiting editor palette", () => {
  it("shows controls for supported tools when nothing is selected", () => {
    expect(paletteKinds("Rectangle", [])).toEqual(["rectangle"]);
    expect(paletteKinds("Text", [])).toEqual(["text"]);
    expect(paletteKinds("Freehand", [])).toEqual(["freehand"]);
    expect(paletteKinds("Highlighter", [])).toEqual([]);
    expect(paletteKinds("Select", [])).toEqual([]);
  });

  it("uses supported selections instead of the active tool", () => {
    const rectangle = new Rectangle();
    const text = new Text();
    const freehand = new Freehand();
    const highlighter = new Highlighter();

    expect(paletteKinds("Text", [rectangle, text, freehand, highlighter])).toEqual([
      "rectangle",
      "text",
      "freehand",
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
    expect(text).toMatchObject({
      fontColor: "#0000ff",
      fontFamily: "serif",
      horzAlign: HorzAlign.RIGHT,
    });
    expect(freehand).toMatchObject(DEFAULT_EDITOR_PALETTE.freehand);
    expect(highlighter.strokeColor).not.toBe(DEFAULT_EDITOR_PALETTE.freehand.strokeColor);
  });
});
