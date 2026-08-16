import {
  FillStyle,
  Freehand,
  HorzAlign,
  Rectangle,
  Text,
  VertAlign,
  type FillStyleEnum,
  type HorzAlignEnum,
  type Shape,
  type ShapeProps,
  type VertAlignEnum,
} from "@dgmjs/core";
import { isWaitingQuestionShape, type WaitingToolId } from "./dgm";

export type PaletteKind = "rectangle" | "text" | "freehand";

interface RectangleDefaults {
  fillColor: string;
  fillStyle: FillStyleEnum;
}

interface TextDefaults {
  fontColor: string;
  fontFamily: string;
  horzAlign: HorzAlignEnum;
  vertAlign: VertAlignEnum;
  padding: number[];
}

interface FreehandDefaults {
  strokeColor: string;
  strokeWidth: number;
}

export interface EditorPaletteDefaults {
  rectangle: RectangleDefaults;
  text: TextDefaults;
  rectangleText: TextDefaults;
  freehand: FreehandDefaults;
}

export const DEFAULT_EDITOR_PALETTE: EditorPaletteDefaults = {
  rectangle: {
    fillColor: "#ffffff",
    fillStyle: FillStyle.SOLID,
  },
  text: {
    fontColor: "#000000",
    fontFamily: "sans-serif",
    horzAlign: HorzAlign.LEFT,
    vertAlign: VertAlign.TOP,
    padding: [4, 4, 4, 4],
  },
  rectangleText: {
    fontColor: "#000000",
    fontFamily: "sans-serif",
    horzAlign: HorzAlign.LEFT,
    vertAlign: VertAlign.MIDDLE,
    padding: [4, 4, 4, 4],
  },
  freehand: {
    strokeColor: "#000000",
    strokeWidth: 8,
  },
};

export function paletteKinds(activeTool: WaitingToolId, selections: Shape[]): PaletteKind[] {
  if (selections.length > 0) {
    const kinds = new Set(selections.flatMap(paletteKindsForShape));
    return (["rectangle", "text", "freehand"] as const).filter((kind) => kinds.has(kind));
  }

  if (activeTool === "Rectangle") return ["rectangle", "text"];
  if (activeTool === "Text") return ["text"];
  if (activeTool === "Freehand") return ["freehand"];
  return [];
}

export function paletteTargets(kind: PaletteKind, selections: Shape[]): Shape[] {
  return selections.filter((shape) => paletteKindsForShape(shape).includes(kind));
}

export function initializeWaitingShape(
  shape: Shape,
  defaults: EditorPaletteDefaults,
): void {
  if (shape instanceof Rectangle) {
    Object.assign(shape, defaults.rectangle, defaults.rectangleText);
    return;
  }
  if (shape instanceof Text) {
    Object.assign(shape, defaults.text);
    return;
  }
  if (shape instanceof Freehand) Object.assign(shape, defaults.freehand);
}

export function updatePaletteDefaults(
  defaults: EditorPaletteDefaults,
  kind: PaletteKind,
  props: ShapeProps,
  activeTool: WaitingToolId = "Text",
): EditorPaletteDefaults {
  if (kind === "rectangle") {
    return {
      ...defaults,
      rectangle: {
        fillColor: props.fillColor ?? defaults.rectangle.fillColor,
        fillStyle: props.fillStyle ?? defaults.rectangle.fillStyle,
      },
    };
  }
  if (kind === "text") {
    const key = activeTool === "Rectangle" ? "rectangleText" : "text";
    return {
      ...defaults,
      [key]: {
        ...defaults[key],
        fontColor: props.fontColor ?? defaults[key].fontColor,
        fontFamily: props.fontFamily ?? defaults[key].fontFamily,
        horzAlign: props.horzAlign ?? defaults[key].horzAlign,
        vertAlign: props.vertAlign ?? defaults[key].vertAlign,
        padding: props.padding ?? defaults[key].padding,
      },
    };
  }
  return {
    ...defaults,
    freehand: {
      strokeColor: props.strokeColor ?? defaults.freehand.strokeColor,
      strokeWidth: props.strokeWidth ?? defaults.freehand.strokeWidth,
    },
  };
}

export function textDefaultsForTool(
  defaults: EditorPaletteDefaults,
  activeTool: WaitingToolId,
): TextDefaults {
  return activeTool === "Rectangle" ? defaults.rectangleText : defaults.text;
}

function paletteKindsForShape(shape: Shape): PaletteKind[] {
  if (isWaitingQuestionShape(shape)) return ["text"];
  if (shape instanceof Rectangle) return ["rectangle", "text"];
  if (shape instanceof Text) return ["text"];
  if (shape instanceof Freehand) return ["freehand"];
  return [];
}
