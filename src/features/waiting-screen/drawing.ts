import type { DrawingPoint, DrawingStroke } from "./model";

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
