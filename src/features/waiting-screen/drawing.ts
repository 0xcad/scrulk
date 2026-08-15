import { safeGeometry, toPixelGeometry } from "./geometry";
import type {
  DrawingPoint,
  DrawingStroke,
  WaitingDrawingWidget,
} from "./model";

export interface DrawingHistory {
  past: DrawingStroke[][];
  present: DrawingStroke[];
  future: DrawingStroke[][];
}

export function createDrawingHistory(strokes: DrawingStroke[]): DrawingHistory {
  return { past: [], present: structuredClone(strokes), future: [] };
}

export function commitDrawingGesture(
  history: DrawingHistory,
  before: DrawingStroke[],
): DrawingHistory {
  return history.present === before ? history : {
    past: [...history.past, before],
    present: history.present,
    future: [],
  };
}

export function undoDrawing(history: DrawingHistory): DrawingHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoDrawing(history: DrawingHistory): DrawingHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}

export function appendDownsampledPoint(
  points: DrawingPoint[],
  point: DrawingPoint,
  canvasWidth: number,
  canvasHeight: number,
  minimumPixels = 1.5,
): DrawingPoint[] {
  const last = points.at(-1);
  if (last) {
    const dx = (point.x - last.x) * canvasWidth;
    const dy = (point.y - last.y) * canvasHeight;
    if (Math.hypot(dx, dy) < minimumPixels) return points;
  }
  return [...points, point];
}

export function renderDrawing(
  context: CanvasRenderingContext2D,
  strokes: DrawingStroke[],
  width: number,
  height: number,
): void {
  context.clearRect(0, 0, width, height);
  const shortEdge = Math.min(width, height);
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    context.save();
    context.globalCompositeOperation = stroke.tool === "eraser"
      ? "destination-out"
      : "source-over";
    context.strokeStyle = stroke.color;
    context.fillStyle = stroke.color;
    context.lineWidth = Math.max(1, stroke.size * shortEdge);
    context.lineCap = "round";
    context.lineJoin = "round";
    const first = stroke.points[0];
    if (!first) {
      context.restore();
      continue;
    }
    context.beginPath();
    context.moveTo(first.x * width, first.y * height);
    for (const point of stroke.points.slice(1)) {
      context.lineTo(point.x * width, point.y * height);
    }
    if (stroke.points.length === 1) {
      context.arc(first.x * width, first.y * height, context.lineWidth / 2, 0, Math.PI * 2);
      context.fill();
    } else {
      context.stroke();
    }
    context.restore();
  }
}

/** Remove complete brush strokes touched by the swept eraser path. */
export function eraseBrushStrokes(
  strokes: DrawingStroke[],
  eraserPoints: DrawingPoint[],
  eraserSize: number,
  width: number,
  height: number,
): DrawingStroke[] {
  if (eraserPoints.length === 0) return strokes;
  const kept = strokes.filter((stroke) =>
    stroke.tool !== "brush" || !strokesTouch(
      stroke.points,
      stroke.size,
      eraserPoints,
      eraserSize,
      width,
      height,
    )
  );
  return kept.length === strokes.length ? strokes : kept;
}

/** Convert legacy compositing erasers into whole-stroke deletions. */
export function resolveLegacyErasers(strokes: DrawingStroke[]): DrawingStroke[] {
  let brushes: DrawingStroke[] = [];
  for (const stroke of strokes) {
    if (stroke.tool === "brush") {
      brushes.push(stroke);
    } else {
      brushes = eraseBrushStrokes(brushes, stroke.points, stroke.size, 1, 1);
    }
  }
  return brushes;
}

/** Crop a drawing while preserving its rendered position, scale, and rotation. */
export function cropDrawingWidget(
  widget: WaitingDrawingWidget,
  nextStrokes: DrawingStroke[],
  viewportWidth: number,
  viewportHeight: number,
  paddingPixels = 12,
): WaitingDrawingWidget | null {
  const strokes = nextStrokes.filter((stroke) => stroke.tool === "brush");
  if (strokes.length === 0) return null;
  if (viewportWidth <= 0 || viewportHeight <= 0) return { ...widget, strokes };
  const pixel = toPixelGeometry(widget, viewportWidth, viewportHeight);
  const shortEdge = Math.min(pixel.width, pixel.height);
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const stroke of strokes) {
    const radius = stroke.size * shortEdge / 2;
    for (const point of stroke.points) {
      const x = point.x * pixel.width;
      const y = point.y * pixel.height;
      left = Math.min(left, x - radius);
      right = Math.max(right, x + radius);
      top = Math.min(top, y - radius);
      bottom = Math.max(bottom, y + radius);
    }
  }
  left -= paddingPixels;
  top -= paddingPixels;
  right += paddingPixels;
  bottom += paddingPixels;
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  const nextShortEdge = Math.min(width, height);
  const remapped = strokes.map((stroke) => ({
    ...stroke,
    size: stroke.size * shortEdge / nextShortEdge,
    points: stroke.points.map((point) => ({
      x: (point.x * pixel.width - left) / width,
      y: (point.y * pixel.height - top) / height,
    })),
  }));

  const localX = left + width / 2 - pixel.width / 2;
  const localY = top + height / 2 - pixel.height / 2;
  const radians = pixel.rotation * Math.PI / 180;
  const rotatedX = localX * Math.cos(radians) - localY * Math.sin(radians);
  const rotatedY = localX * Math.sin(radians) + localY * Math.cos(radians);
  const centerX = pixel.left + pixel.width / 2 + rotatedX;
  const centerY = pixel.top + pixel.height / 2 + rotatedY;
  const geometry = safeGeometry({
    offsetX: centerX - viewportWidth / 2,
    offsetY: centerY - viewportHeight / 2,
    width,
    height,
    rotation: pixel.rotation,
  });
  return { ...widget, ...geometry, strokes: remapped };
}

function strokesTouch(
  leftPoints: DrawingPoint[],
  leftSize: number,
  rightPoints: DrawingPoint[],
  rightSize: number,
  width: number,
  height: number,
): boolean {
  if (leftPoints.length === 0 || rightPoints.length === 0) return false;
  const shortEdge = Math.min(width, height);
  const threshold = (leftSize + rightSize) * shortEdge / 2;
  const leftSegments = segments(leftPoints, width, height);
  const rightSegments = segments(rightPoints, width, height);
  return leftSegments.some(([a, b]) => rightSegments.some(([c, d]) =>
    segmentDistance(a, b, c, d) <= threshold
  ));
}

type PixelPoint = { x: number; y: number };
type Segment = [PixelPoint, PixelPoint];

function segments(points: DrawingPoint[], width: number, height: number): Segment[] {
  const pixels = points.map((point) => ({ x: point.x * width, y: point.y * height }));
  if (pixels.length === 1) return [[pixels[0]!, pixels[0]!]];
  return pixels.slice(1).map((point, index) => [pixels[index]!, point]);
}

function segmentDistance(a: PixelPoint, b: PixelPoint, c: PixelPoint, d: PixelPoint): number {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b),
  );
}

function segmentsIntersect(a: PixelPoint, b: PixelPoint, c: PixelPoint, d: PixelPoint): boolean {
  const cross = (p: PixelPoint, q: PixelPoint, r: PixelPoint) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const onSegment = (p: PixelPoint, q: PixelPoint, r: PixelPoint) =>
    q.x >= Math.min(p.x, r.x) && q.x <= Math.max(p.x, r.x) &&
    q.y >= Math.min(p.y, r.y) && q.y <= Math.max(p.y, r.y);
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  if (abC * abD < 0 && cdA * cdB < 0) return true;
  const epsilon = 1e-9;
  return (
    (Math.abs(abC) <= epsilon && onSegment(a, c, b)) ||
    (Math.abs(abD) <= epsilon && onSegment(a, d, b)) ||
    (Math.abs(cdA) <= epsilon && onSegment(c, a, d)) ||
    (Math.abs(cdB) <= epsilon && onSegment(c, b, d))
  );
}

function pointSegmentDistance(point: PixelPoint, start: PixelPoint, end: PixelPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const position = Math.min(1, Math.max(0,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy),
  ));
  return Math.hypot(
    point.x - (start.x + position * dx),
    point.y - (start.y + position * dy),
  );
}
