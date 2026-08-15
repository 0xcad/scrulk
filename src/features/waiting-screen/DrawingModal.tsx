import { useEffect, useRef, useState } from "preact/hooks";
import { appendDownsampledPoint } from "./drawing";
import { DrawingCanvas } from "./DrawingCanvas";
import type { DrawingPoint, DrawingStroke } from "./model";

interface Props {
  initialStrokes: DrawingStroke[];
  onSave: (strokes: DrawingStroke[]) => void;
  onCancel: () => void;
}

export function DrawingModal({ initialStrokes, onSave, onCancel }: Props) {
  const [strokes, setStrokes] = useState(() => structuredClone(initialStrokes));
  const [redo, setRedo] = useState<DrawingStroke[]>([]);
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const [color, setColor] = useState("#111111");
  const [size, setSize] = useState(12);
  const activePointer = useRef<number | null>(null);

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
    setRedo([]);
    setStrokes((current) => [...current, {
      tool,
      color,
      size: size / 750,
      points: [pointFrom(event)],
    }]);
  };

  const continueStroke = (event: PointerEvent) => {
    if (activePointer.current !== event.pointerId) return;
    const canvas = event.currentTarget as HTMLCanvasElement;
    setStrokes((current) => {
      const last = current.at(-1);
      if (!last) return current;
      const points = appendDownsampledPoint(
        last.points,
        pointFrom(event),
        canvas.clientWidth,
        canvas.clientHeight,
      );
      if (points === last.points) return current;
      return [...current.slice(0, -1), { ...last, points }];
    });
  };

  const endStroke = (event: PointerEvent) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    const canvas = event.currentTarget as HTMLCanvasElement;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  };

  const undo = () => setStrokes((current) => {
    const last = current.at(-1);
    if (!last) return current;
    setRedo((future) => [...future, last]);
    return current.slice(0, -1);
  });
  const redoStroke = () => setRedo((future) => {
    const next = future.at(-1);
    if (!next) return future;
    setStrokes((current) => [...current, next]);
    return future.slice(0, -1);
  });

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
            <button type="button" disabled={strokes.length === 0} onClick={undo}>undo</button>
            <button type="button" disabled={redo.length === 0} onClick={redoStroke}>redo</button>
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
          <button type="button" class="primary" onClick={() => onSave(strokes)}>save drawing</button>
        </footer>
      </section>
    </div>
  );
}
