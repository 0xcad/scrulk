export const WAITING_SCREEN_MAX_BYTES = 4 * 1024 * 1024;

export const WAITING_FONT_FAMILIES = [
  "sans",
  "serif",
  "monospace",
] as const;

export type WaitingFontFamily = (typeof WAITING_FONT_FAMILIES)[number];

export interface WidgetGeometry {
  /** Normalized center point and dimensions relative to the viewport. */
  x: number;
  y: number;
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
  text: { width: 0.1, height: 0.06 },
  question: { width: 0.25, height: 0.18 },
  drawing: { width: 0.1, height: 0.1 },
} as const;

export const DEFAULT_WAITING_SCREEN: WaitingScreen = {
  widgets: [
    {
      id: "default-title",
      type: "text",
      markdown: "# waiting",
      fontFamily: "monospace",
      x: 0.5,
      y: 0.18,
      width: 0.5,
      height: 0.14,
      rotation: 0,
    },
    {
      id: "default-question-intent",
      type: "question",
      question: "what do you want out of this?",
      x: 0.5,
      y: 0.48,
      width: 0.56,
      height: 0.2,
      rotation: 0,
    },
    {
      id: "default-question-possibility",
      type: "question",
      question: "if you could do anything, what would it be?",
      x: 0.5,
      y: 0.73,
      width: 0.56,
      height: 0.2,
      rotation: 0,
    },
  ],
};

const DEFAULT_GEOMETRY: Record<WaitingWidget["type"], WidgetGeometry> = {
  text: { x: 0.5, y: 0.35, width: 0.4, height: 0.16, rotation: 0 },
  question: { x: 0.5, y: 0.5, width: 0.56, height: 0.2, rotation: 0 },
  drawing: { x: 0.5, y: 0.5, width: 0.35, height: 0.35, rotation: 0 },
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
      strokes: raw.strokes.map(normalizeStroke).filter((stroke): stroke is DrawingStroke => stroke !== null),
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
  const values = [raw.x, raw.y, raw.width, raw.height, raw.rotation];
  if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) return null;
  return {
    x: clamp(raw.x as number, 0, 1),
    y: clamp(raw.y as number, 0, 1),
    width: clamp(raw.width as number, 0.02, 1),
    height: clamp(raw.height as number, 0.02, 1),
    rotation: normalizeRotation(raw.rotation as number),
  };
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
    size: clamp(raw.size, 0.001, 0.2),
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
