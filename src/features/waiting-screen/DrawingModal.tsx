import { useEffect, useRef, useState } from "preact/hooks";
import {
  appendDownsampledPoint,
  commitDrawingGesture,
  createDrawingHistory,
  eraseBrushStrokes,
  redoDrawing,
  undoDrawing,
} from "./drawing";
import { DrawingCanvas } from "./DrawingCanvas";
import type { DrawingPoint, DrawingStroke } from "./model";

interface Props {
  initialStrokes: DrawingStroke[];
  onSave: (strokes: DrawingStroke[]) => void;
  onCancel: () => void;
}

export function DrawingModal({ initialStrokes, onSave, onCancel }: Props) {
  const [history, setHistory] = useState(() => createDrawingHistory(
    initialStrokes.filter((stroke) => stroke.tool === "brush"),
  ));
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const [color, setColor] = useState("#111111");
  const [size, setSize] = useState(12);
  const activePointer = useRef<number | null>(null);
  const gestureStart = useRef<DrawingStroke[] | null>(null);
  const eraserPoints = useRef<DrawingPoint[]>([]);
  const activeTool = useRef<"brush" | "eraser">("brush");
  const strokes = history.present;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const pointFrom = (event: PointerEvent): DrawingPoint => {
    const rect = (event.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const startStroke = (event: PointerEvent) => {
    const canvas = event.currentTarget as HTMLCanvasElement;
    canvas.setPointerCapture(event.pointerId);
    activePointer.current = event.pointerId;
    activeTool.current = tool;
    gestureStart.current = history.present;
    const point = pointFrom(event);
    if (tool === "brush") {
      setHistory((current) => ({ ...current, present: [...current.present, {
        tool: "brush",
        color,
        size: size / 750,
        points: [point],
      }] }));
    } else {
      eraserPoints.current = [point];
      setHistory((current) => ({
        ...current,
        present: eraseBrushStrokes(
          current.present,
          eraserPoints.current,
          size / 750,
          canvas.clientWidth,
          canvas.clientHeight,
        ),
      }));
    }
  };

  const continueStroke = (event: PointerEvent) => {
    if (activePointer.current !== event.pointerId) return;
    const canvas = event.currentTarget as HTMLCanvasElement;
    if (activeTool.current === "brush") {
      setHistory((current) => {
        const last = current.present.at(-1);
        if (!last) return current;
        const points = appendDownsampledPoint(
          last.points,
          pointFrom(event),
          canvas.clientWidth,
          canvas.clientHeight,
        );
        if (points === last.points) return current;
        return {
          ...current,
          present: [...current.present.slice(0, -1), { ...last, points }],
        };
      });
    } else {
      const points = appendDownsampledPoint(
        eraserPoints.current,
        pointFrom(event),
        canvas.clientWidth,
        canvas.clientHeight,
      );
      if (points === eraserPoints.current) return;
      eraserPoints.current = points;
      setHistory((current) => ({
        ...current,
        present: eraseBrushStrokes(
          current.present,
          points,
          size / 750,
          canvas.clientWidth,
          canvas.clientHeight,
        ),
      }));
    }
  };

  const endStroke = (event: PointerEvent) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    const canvas = event.currentTarget as HTMLCanvasElement;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    const start = gestureStart.current;
    gestureStart.current = null;
    eraserPoints.current = [];
    if (start) {
      setHistory((current) => commitDrawingGesture(current, start));
    }
  };

  const undo = () => setHistory(undoDrawing);
  const redoStroke = () => setHistory(redoDrawing);

  return (
    <div class="waiting-modal-backdrop" role="presentation">
      <section class="waiting-drawing-modal" role="dialog" aria-modal="true" aria-labelledby="drawing-title">
        <header>
          <h2 id="drawing-title" class="scrulk-section-title">Edit drawing</h2>
          <div class="waiting-drawing-tools">
            <button type="button" aria-pressed={tool === "brush"} onClick={() => setTool("brush")}>brush</button>
            <button type="button" aria-pressed={tool === "eraser"} onClick={() => setTool("eraser")}>eraser</button>
            <label>size <input type="range" min="1" max="60" value={size} onInput={(event) => setSize(Number((event.target as HTMLInputElement).value))} /></label>
            <label>color <input type="color" value={color} disabled={tool === "eraser"} onInput={(event) => setColor((event.target as HTMLInputElement).value)} /></label>
            <button type="button" disabled={history.past.length === 0} onClick={undo}>undo</button>
            <button type="button" disabled={history.future.length === 0} onClick={redoStroke}>redo</button>
          </div>
        </header>
        <DrawingCanvas
          class="waiting-drawing-surface"
          strokes={strokes}
          onPointerDown={startStroke}
          onPointerMove={continueStroke}
          onPointerUp={endStroke}
        />
        <footer>
          <button type="button" class="secondary" onClick={onCancel}>cancel</button>
          <button type="button" class="primary" onClick={() => onSave(history.present)}>save drawing</button>
        </footer>
      </section>
    </div>
  );
}
