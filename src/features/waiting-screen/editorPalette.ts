import {
  FillStyle,
  Freehand,
  HorzAlign,
  Rectangle,
  Text,
  type FillStyleEnum,
  type HorzAlignEnum,
  type Shape,
  type ShapeProps,
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
}

interface FreehandDefaults {
  strokeColor: string;
  strokeWidth: number;
}

export interface EditorPaletteDefaults {
  rectangle: RectangleDefaults;
  text: TextDefaults;
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
  },
  freehand: {
    strokeColor: "#000000",
    strokeWidth: 8,
  },
};

export function paletteKinds(activeTool: WaitingToolId, selections: Shape[]): PaletteKind[] {
  if (selections.length > 0) {
    const kinds = new Set(selections.flatMap((shape) => {
      const kind = paletteKindForShape(shape);
      return kind ? [kind] : [];
    }));
    return (["rectangle", "text", "freehand"] as const).filter((kind) => kinds.has(kind));
  }

  if (activeTool === "Rectangle") return ["rectangle"];
  if (activeTool === "Text") return ["text"];
  if (activeTool === "Freehand") return ["freehand"];
  return [];
}

export function paletteTargets(kind: PaletteKind, selections: Shape[]): Shape[] {
  return selections.filter((shape) => paletteKindForShape(shape) === kind);
}

export function initializeWaitingShape(
  shape: Shape,
  defaults: EditorPaletteDefaults,
): void {
  const kind = paletteKindForShape(shape);
  if (!kind) return;
  Object.assign(shape, defaults[kind]);
}

export function updatePaletteDefaults(
  defaults: EditorPaletteDefaults,
  kind: PaletteKind,
  props: ShapeProps,
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
    return {
      ...defaults,
      text: {
        fontColor: props.fontColor ?? defaults.text.fontColor,
        fontFamily: props.fontFamily ?? defaults.text.fontFamily,
        horzAlign: props.horzAlign ?? defaults.text.horzAlign,
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

function paletteKindForShape(shape: Shape): PaletteKind | null {
  if (isWaitingQuestionShape(shape)) return "text";
  if (shape instanceof Text) return "text";
  if (shape instanceof Rectangle) return "rectangle";
  if (shape instanceof Freehand) return "freehand";
  return null;
}
