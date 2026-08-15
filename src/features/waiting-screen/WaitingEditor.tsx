import Moveable from "moveable";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { getSettings, onSettingsChange, setSettings } from "../../shared/storage";
import { DrawingCanvas } from "./DrawingCanvas";
import { DrawingModal } from "./DrawingModal";
import { fromPixelGeometry, safeGeometry, toPixelGeometry, type PixelGeometry } from "./geometry";
import { MarkdownContent } from "./MarkdownContent";
import { MarkdownEditor } from "./MarkdownEditor";
import {
  cloneWaitingScreen,
  createWaitingWidget,
  DEFAULT_WAITING_SCREEN,
  WAITING_FONT_FAMILIES,
  WAITING_SCREEN_MAX_BYTES,
  waitingScreenBytes,
  WAITING_WIDGET_MINIMUMS,
  type DrawingStroke,
  type WaitingFontFamily,
  type WaitingScreen,
  type WaitingWidget,
} from "./model";

interface Props {
  onDirtyChange: (dirty: boolean) => void;
}

export function WaitingEditor({ onDirtyChange }: Props) {
  const [saved, setSaved] = useState<WaitingScreen | null>(null);
  const [draft, setDraft] = useState<WaitingScreen | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dirty = saved !== null && draft !== null && JSON.stringify(saved) !== JSON.stringify(draft);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    void getSettings().then((settings) => {
      const screen = cloneWaitingScreen(settings.waitingScreen);
      setSaved(screen);
      setDraft(cloneWaitingScreen(screen));
    });
    return onSettingsChange((settings) => {
      if (dirtyRef.current) return;
      const screen = cloneWaitingScreen(settings.waitingScreen);
      setSaved(screen);
      setDraft(cloneWaitingScreen(screen));
    });
  }, []);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  if (!draft || !saved) return <p>Loading…</p>;

  const updateWidget = (id: string, update: (widget: WaitingWidget) => WaitingWidget) => {
    setDraft((current) => current && ({
      widgets: current.widgets.map((widget) => widget.id === id ? update(widget) : widget),
    }));
    setSaveError(null);
  };
  const select = (id: string) => {
    setSelectedId(id);
    setEditingId(null);
    setDraft((current) => {
      if (!current) return current;
      const index = current.widgets.findIndex((widget) => widget.id === id);
      if (index < 0 || index === current.widgets.length - 1) return current;
      return { widgets: [...current.widgets.slice(0, index), ...current.widgets.slice(index + 1), current.widgets[index]!] };
    });
  };
  const selected = draft.widgets.find((widget) => widget.id === selectedId) ?? null;
  const drawing = draft.widgets.find((widget) => widget.id === drawingId && widget.type === "drawing");

  const save = async () => {
    const bytes = waitingScreenBytes(draft);
    if (bytes > WAITING_SCREEN_MAX_BYTES) {
      setSaveError(`This waiting screen is ${(bytes / 1024 / 1024).toFixed(2)} MB. Remove drawing detail until it is under 4 MB.`);
      return;
    }
    const next = cloneWaitingScreen(draft);
    await setSettings({ waitingScreen: next });
    setSaved(next);
    setDraft(cloneWaitingScreen(next));
    setSaveError(null);
  };

  return (
    <section class="waiting-editor-page">
      <div class="waiting-editor-toolbar">
        <span>Add widget:</span>
        {(["text", "question", "drawing"] as const).map((type) => (
          <button type="button" key={type} onClick={() => {
            const widget = createWaitingWidget(type);
            setDraft((current) => current && ({ widgets: [...current.widgets, widget] }));
            setSelectedId(widget.id);
            if (type === "drawing") setDrawingId(widget.id);
          }}>{type}</button>
        ))}
        <button type="button" disabled={!selected} onClick={() => {
          if (!selectedId) return;
          setDraft((current) => current && ({ widgets: current.widgets.filter((widget) => widget.id !== selectedId) }));
          setSelectedId(null);
          setEditingId(null);
        }}>delete</button>
        <button type="button" onClick={() => {
          setDraft(cloneWaitingScreen(DEFAULT_WAITING_SCREEN));
          setSelectedId(null);
          setEditingId(null);
        }}>reset</button>
      </div>

      {selected?.type === "text" && (
        <label class="waiting-font-control">
          Font
          <select value={selected.fontFamily} onChange={(event) => {
            const fontFamily = (event.target as HTMLSelectElement).value as WaitingFontFamily;
            updateWidget(selected.id, (widget) => widget.type === "text" ? { ...widget, fontFamily } : widget);
          }}>
            {WAITING_FONT_FAMILIES.map((font) => <option key={font} value={font}>{font}</option>)}
          </select>
        </label>
      )}
      {selected?.type === "drawing" && (
        <button type="button" onClick={() => setDrawingId(selected.id)}>edit drawing</button>
      )}

      <WaitingDesignCanvas
        screen={draft}
        selectedId={selectedId}
        editingId={editingId}
        onSelect={select}
        onEdit={setEditingId}
        onEditDrawing={setDrawingId}
        onUpdateWidget={updateWidget}
      />

      {saveError && <p class="error" role="alert">{saveError}</p>}
      <div class="waiting-editor-actions">
        <button type="button" class="secondary" disabled={!dirty} onClick={() => {
          setDraft(cloneWaitingScreen(saved));
          setSelectedId(null);
          setEditingId(null);
          setSaveError(null);
        }}>cancel changes</button>
        <button type="button" class="primary" disabled={!dirty} onClick={() => void save()}>save waiting screen</button>
      </div>

      {drawing?.type === "drawing" && (
        <DrawingModal
          initialStrokes={drawing.strokes}
          onCancel={() => setDrawingId(null)}
          onSave={(strokes: DrawingStroke[]) => {
            updateWidget(drawing.id, (widget) => widget.type === "drawing" ? { ...widget, strokes } : widget);
            setDrawingId(null);
          }}
        />
      )}
    </section>
  );
}

function WaitingDesignCanvas({
  screen,
  selectedId,
  editingId,
  onSelect,
  onEdit,
  onEditDrawing,
  onUpdateWidget,
}: {
  screen: WaitingScreen;
  selectedId: string | null;
  editingId: string | null;
  onSelect: (id: string) => void;
  onEdit: (id: string | null) => void;
  onEditDrawing: (id: string) => void;
  onUpdateWidget: (id: string, update: (widget: WaitingWidget) => WaitingWidget) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const selected = useMemo(
    () => screen.widgets.find((widget) => widget.id === selectedId) ?? null,
    [screen, selectedId],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const update = () => setSize({ width: canvas.clientWidth, height: canvas.clientHeight });
    const observer = new ResizeObserver(update);
    observer.observe(canvas);
    update();
    return () => observer.disconnect();
  }, []);

  const commitGeometry = useCallback((pixel: PixelGeometry) => {
    if (!selectedId || size.width <= 0 || size.height <= 0) return;
    const geometry = fromPixelGeometry(pixel, size.width, size.height);
    onUpdateWidget(selectedId, (widget) => ({ ...widget, ...geometry }));
  }, [onUpdateWidget, selectedId, size.height, size.width]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const target = selectedId ? canvas?.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(selectedId)}"]`) : null;
    if (!canvas || !target || !selected || editingId === selectedId || size.width <= 0 || size.height <= 0) return;
    let pending = toPixelGeometry(selected, size.width, size.height);
    const minimum = WAITING_WIDGET_MINIMUMS[selected.type];
    const moveable = new Moveable(canvas, {
      target,
      draggable: true,
      resizable: true,
      rotatable: true,
      origin: false,
      renderDirections: ["nw", "n", "ne", "e", "se", "s", "sw", "w"],
    });
    moveable.on("drag", (event) => {
      pending = { ...pending, left: event.left, top: event.top };
      target.style.left = `${pending.left}px`;
      target.style.top = `${pending.top}px`;
    }).on("dragEnd", () => commitGeometry(pending));
    moveable.on("resize", (event) => {
      pending = {
        ...pending,
        left: event.drag.left,
        top: event.drag.top,
        width: Math.max(event.width, minimum.width * size.width),
        height: Math.max(event.height, minimum.height * size.height),
      };
      Object.assign(target.style, {
        left: `${pending.left}px`,
        top: `${pending.top}px`,
        width: `${pending.width}px`,
        height: `${pending.height}px`,
      });
    }).on("resizeEnd", () => commitGeometry(pending));
    moveable.on("rotateStart", (event) => event.set(pending.rotation));
    moveable.on("rotate", (event) => {
      pending = {
        ...pending,
        left: event.drag.left,
        top: event.drag.top,
        rotation: event.beforeRotation,
      };
      target.style.left = `${pending.left}px`;
      target.style.top = `${pending.top}px`;
      target.style.transform = `rotate(${pending.rotation}deg)`;
    }).on("rotateEnd", () => commitGeometry(pending));
    return () => moveable.destroy();
  }, [commitGeometry, editingId, selected, selectedId, size.height, size.width]);

  return (
    <div
      ref={canvasRef}
      class="waiting-design-canvas"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onSelect("");
          onEdit(null);
        }
      }}
    >
      {screen.widgets.map((widget) => {
        const geometry = safeGeometry(widget, size.width, size.height);
        const pixel = toPixelGeometry(geometry, size.width, size.height);
        const isEditing = editingId === widget.id;
        return (
          <section
            key={widget.id}
            data-widget-id={widget.id}
            class={`waiting-editor-widget waiting-widget--${widget.type}${selectedId === widget.id ? " waiting-editor-widget--selected" : ""}`}
            style={{
              left: `${pixel.left}px`,
              top: `${pixel.top}px`,
              width: `${pixel.width}px`,
              height: `${pixel.height}px`,
              transform: `rotate(${pixel.rotation}deg)`,
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (!isEditing) onSelect(widget.id);
            }}
            onDblClick={(event) => {
              event.stopPropagation();
              if (widget.type === "drawing") onEditDrawing(widget.id);
              else onEdit(widget.id);
            }}
          >
            {widget.type === "text" && (isEditing
              ? <MarkdownEditor value={widget.markdown} onChange={(markdown) => onUpdateWidget(widget.id, (current) => current.type === "text" ? { ...current, markdown } : current)} onDone={() => onEdit(null)} />
              : <div class={`waiting-font--${widget.fontFamily}`}><MarkdownContent markdown={widget.markdown} /></div>)}
            {widget.type === "question" && (isEditing
              ? <textarea class="waiting-question-editor" value={widget.question} autofocus onInput={(event) => onUpdateWidget(widget.id, (current) => current.type === "question" ? { ...current, question: (event.target as HTMLTextAreaElement).value } : current)} onKeyDown={(event) => { if (event.key === "Escape") onEdit(null); }} />
              : <label><span>{widget.question}</span><textarea disabled /></label>)}
            {widget.type === "drawing" && <DrawingCanvas strokes={widget.strokes} />}
          </section>
        );
      })}
    </div>
  );
}
