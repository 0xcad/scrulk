import { resolveLegacyErasers } from "./drawing";

export const WAITING_SCREEN_MAX_BYTES = 4 * 1024 * 1024;

export const WAITING_FONT_FAMILIES = [
  "sans",
  "serif",
  "monospace",
] as const;

export type WaitingFontFamily = (typeof WAITING_FONT_FAMILIES)[number];

export interface WidgetGeometry {
  /** Pixel offset from the viewport center; dimensions are also CSS pixels. */
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  rotation: number;
}

interface WaitingWidgetBase extends WidgetGeometry {
  id: string;
}

export interface WaitingTextWidget extends WaitingWidgetBase {
  type: "text";
  markdown: string;
  fontFamily: WaitingFontFamily;
}

export interface WaitingQuestionWidget extends WaitingWidgetBase {
  type: "question";
  question: string;
}

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingStroke {
  tool: "brush" | "eraser";
  color: string;
  /** Width normalized against the shorter drawing-canvas edge. */
  size: number;
  points: DrawingPoint[];
}

export interface WaitingDrawingWidget extends WaitingWidgetBase {
  type: "drawing";
  strokes: DrawingStroke[];
}

export type WaitingWidget =
  | WaitingTextWidget
  | WaitingQuestionWidget
  | WaitingDrawingWidget;

export interface WaitingScreen {
  widgets: WaitingWidget[];
}

export const WAITING_WIDGET_MINIMUMS = {
  text: { width: 100, height: 40 },
  question: { width: 250, height: 120 },
  drawing: { width: 20, height: 20 },
} as const;

/** Reference viewport used only to migrate the previously normalized sizes. */
export const WAITING_LEGACY_VIEWPORT = { width: 1000, height: 650 } as const;

export const DEFAULT_WAITING_SCREEN: WaitingScreen = {
  widgets: [
    {
      id: "default-title",
      type: "text",
      markdown: "# waiting",
      fontFamily: "monospace",
      offsetX: 0,
      offsetY: -208,
      width: 500,
      height: 91,
      rotation: 0,
    },
    {
      id: "default-question-intent",
      type: "question",
      question: "what do you want out of this?",
      offsetX: 0,
      offsetY: -13,
      width: 560,
      height: 130,
      rotation: 0,
    },
    {
      id: "default-question-possibility",
      type: "question",
      question: "if you could do anything, what would it be?",
      offsetX: 0,
      offsetY: 149.5,
      width: 560,
      height: 130,
      rotation: 0,
    },
  ],
};

const DEFAULT_GEOMETRY: Record<WaitingWidget["type"], WidgetGeometry> = {
  text: { offsetX: 0, offsetY: -97.5, width: 400, height: 104, rotation: 0 },
  question: { offsetX: 0, offsetY: 0, width: 560, height: 130, rotation: 0 },
  drawing: { offsetX: 0, offsetY: 0, width: 350, height: 228, rotation: 0 },
};

export function createWaitingWidget(type: WaitingWidget["type"]): WaitingWidget {
  const base = { id: crypto.randomUUID(), ...DEFAULT_GEOMETRY[type] };
  if (type === "text") {
    return { ...base, type, markdown: "double-click to edit", fontFamily: "sans" };
  }
  if (type === "question") {
    return { ...base, type, question: "your question" };
  }
  return { ...base, type, strokes: [] };
}

export function cloneWaitingScreen(screen: WaitingScreen): WaitingScreen {
  return structuredClone(screen);
}

export function waitingScreenBytes(screen: WaitingScreen): number {
  return new TextEncoder().encode(JSON.stringify(screen)).byteLength;
}

export function waitingQuestionsComplete(
  screen: WaitingScreen,
  answers: Record<string, string | undefined>,
): boolean {
  return screen.widgets.every((widget) =>
    widget.type !== "question" || (answers[widget.id]?.length ?? 0) >= 20
  );
}

export function normalizeWaitingScreen(raw: unknown): WaitingScreen {
  if (!isRecord(raw) || !Array.isArray(raw.widgets)) {
    return cloneWaitingScreen(DEFAULT_WAITING_SCREEN);
  }

  const ids = new Set<string>();
  const widgets: WaitingWidget[] = [];
  for (const candidate of raw.widgets) {
    const widget = normalizeWidget(candidate);
    if (!widget || ids.has(widget.id)) continue;
    ids.add(widget.id);
    widgets.push(widget);
  }
  const screen = { widgets };
  return waitingScreenBytes(screen) <= WAITING_SCREEN_MAX_BYTES
    ? screen
    : cloneWaitingScreen(DEFAULT_WAITING_SCREEN);
}

function normalizeWidget(raw: unknown): WaitingWidget | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || raw.id.length === 0) return null;
  const geometry = normalizeGeometry(raw);
  if (!geometry) return null;

  if (raw.type === "text" && typeof raw.markdown === "string") {
    const fontFamily = WAITING_FONT_FAMILIES.includes(raw.fontFamily as WaitingFontFamily)
      ? raw.fontFamily as WaitingFontFamily
      : "sans";
    return { id: raw.id, type: "text", markdown: raw.markdown, fontFamily, ...withMinimum("text", geometry) };
  }
  if (raw.type === "question" && typeof raw.question === "string") {
    return { id: raw.id, type: "question", question: raw.question, ...withMinimum("question", geometry) };
  }
  if (raw.type === "drawing" && Array.isArray(raw.strokes)) {
    return {
      id: raw.id,
      type: "drawing",
      strokes: resolveLegacyErasers(
        raw.strokes.map(normalizeStroke).filter((stroke): stroke is DrawingStroke => stroke !== null),
      ),
      ...withMinimum("drawing", geometry),
    };
  }
  return null;
}

function withMinimum(type: WaitingWidget["type"], geometry: WidgetGeometry): WidgetGeometry {
  const minimum = WAITING_WIDGET_MINIMUMS[type];
  return {
    ...geometry,
    width: Math.max(minimum.width, geometry.width),
    height: Math.max(minimum.height, geometry.height),
  };
}

function normalizeGeometry(raw: Record<string, unknown>): WidgetGeometry | null {
  const hasCenteredOffsets = isFiniteNumber(raw.offsetX) && isFiniteNumber(raw.offsetY);
  const hasLegacyPosition = isFiniteNumber(raw.x) && isFiniteNumber(raw.y);
  if ((!hasCenteredOffsets && !hasLegacyPosition) ||
    !isFiniteNumber(raw.width) || !isFiniteNumber(raw.height) || !isFiniteNumber(raw.rotation)) return null;
  const rawWidth = raw.width as number;
  const rawHeight = raw.height as number;
  const legacyNormalizedSize = rawWidth > 0 && rawWidth <= 1 && rawHeight > 0 && rawHeight <= 1;
  return {
    offsetX: clamp(
      hasCenteredOffsets
        ? raw.offsetX as number
        : (clamp(raw.x as number, 0, 1) - 0.5) * WAITING_LEGACY_VIEWPORT.width,
      -10_000,
      10_000,
    ),
    offsetY: clamp(
      hasCenteredOffsets
        ? raw.offsetY as number
        : (clamp(raw.y as number, 0, 1) - 0.5) * WAITING_LEGACY_VIEWPORT.height,
      -10_000,
      10_000,
    ),
    width: clamp(
      legacyNormalizedSize ? rawWidth * WAITING_LEGACY_VIEWPORT.width : rawWidth,
      1,
      10_000,
    ),
    height: clamp(
      legacyNormalizedSize ? rawHeight * WAITING_LEGACY_VIEWPORT.height : rawHeight,
      1,
      10_000,
    ),
    rotation: normalizeRotation(raw.rotation as number),
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeStroke(raw: unknown): DrawingStroke | null {
  if (!isRecord(raw) || (raw.tool !== "brush" && raw.tool !== "eraser")) return null;
  if (typeof raw.color !== "string" || typeof raw.size !== "number" || !Number.isFinite(raw.size)) return null;
  if (!Array.isArray(raw.points)) return null;
  const points = raw.points.flatMap((point) => {
    if (!isRecord(point) || typeof point.x !== "number" || typeof point.y !== "number") return [];
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return [];
    return [{ x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1) }];
  });
  if (points.length === 0) return null;
  return {
    tool: raw.tool,
    color: /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : "#111111",
    size: clamp(raw.size, 0.001, 1),
    points,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeRotation(value: number): number {
  return ((value % 360) + 360) % 360;
}
