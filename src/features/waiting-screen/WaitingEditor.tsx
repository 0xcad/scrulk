import Moveable from "moveable";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { getSettings, onSettingsChange, setSettings } from "../../shared/storage";
import { cropDrawingWidget } from "./drawing";
import { DrawingCanvas } from "./DrawingCanvas";
import { DrawingModal } from "./DrawingModal";
import { shouldDeleteSelectedWidget } from "./editor";
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
  type WaitingTextWidget,
  type WaitingWidget,
} from "./model";
import { WaitingScreenView } from "./WaitingScreenView";

interface Props {
  onDirtyChange: (dirty: boolean) => void;
}

const noop = () => undefined;

export function WaitingEditor({ onDirtyChange }: Props) {
  const [saved, setSaved] = useState<WaitingScreen | null>(null);
  const [draft, setDraft] = useState<WaitingScreen | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contentId, setContentId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
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

  const deleteWidget = useCallback((id: string) => {
    setDraft((current) => current && ({
      widgets: current.widgets.filter((widget) => widget.id !== id),
    }));
    setSelectedId((current) => current === id ? null : current);
    setContentId((current) => current === id ? null : current);
    setEditingQuestionId((current) => current === id ? null : current);
    setDrawingId((current) => current === id ? null : current);
    setSaveError(null);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!shouldDeleteSelectedWidget({
        key: event.key,
        hasSelection: selectedId !== null,
        modalOpen: contentId !== null || drawingId !== null || previewing,
        editableTarget: isEditableTarget(event.target),
      }) || !selectedId) return;
      event.preventDefault();
      deleteWidget(selectedId);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [contentId, deleteWidget, drawingId, previewing, selectedId]);

  if (!draft || !saved) return <p>Loading…</p>;

  const updateWidget = (id: string, update: (widget: WaitingWidget) => WaitingWidget) => {
    setDraft((current) => current && ({
      widgets: current.widgets.map((widget) => widget.id === id ? update(widget) : widget),
    }));
    setSaveError(null);
  };
  const select = (id: string | null) => {
    setSelectedId(id);
    setEditingQuestionId((current) => current === id ? current : null);
    setDraft((current) => {
      if (!current || id === null) return current;
      const index = current.widgets.findIndex((widget) => widget.id === id);
      if (index < 0 || index === current.widgets.length - 1) return current;
      return {
        widgets: [
          ...current.widgets.slice(0, index),
          ...current.widgets.slice(index + 1),
          current.widgets[index]!,
        ],
      };
    });
  };
  const selected = draft.widgets.find((widget) => widget.id === selectedId) ?? null;
  const content = draft.widgets.find((widget): widget is WaitingTextWidget =>
    widget.id === contentId && widget.type === "text"
  );
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
            setEditingQuestionId(null);
            if (type === "drawing") setDrawingId(widget.id);
          }}>{type}</button>
        ))}
        <button type="button" disabled={!selected} onClick={() => {
          if (selectedId) deleteWidget(selectedId);
        }}>delete</button>
        <button type="button" onClick={() => {
          setDraft(cloneWaitingScreen(DEFAULT_WAITING_SCREEN));
          setSelectedId(null);
          setContentId(null);
          setEditingQuestionId(null);
        }}>reset</button>
        <button type="button" class="waiting-preview-button" onClick={() => {
          setSelectedId(null);
          setEditingQuestionId(null);
          setPreviewing(true);
        }}>preview</button>
      </div>

      <WaitingDesignCanvas
        screen={draft}
        selectedId={selectedId}
        editingQuestionId={editingQuestionId}
        interactionDisabled={contentId !== null || drawingId !== null || previewing}
        onSelect={select}
        onEditContent={setContentId}
        onEditQuestion={setEditingQuestionId}
        onEditDrawing={setDrawingId}
        onUpdateWidget={updateWidget}
        onViewportChange={setViewport}
      />

      {saveError && <p class="error" role="alert">{saveError}</p>}
      <div class="waiting-editor-actions">
        <button type="button" class="secondary" disabled={!dirty} onClick={() => {
          setDraft(cloneWaitingScreen(saved));
          setSelectedId(null);
          setContentId(null);
          setEditingQuestionId(null);
          setSaveError(null);
        }}>cancel changes</button>
        <button type="button" class="primary" disabled={!dirty} onClick={() => void save()}>save waiting screen</button>
      </div>

      {content && (
        <ContentModal
          key={content.id}
          widget={content}
          onCancel={() => setContentId(null)}
          onSave={(next) => {
            updateWidget(content.id, () => next);
            setContentId(null);
          }}
        />
      )}
      {drawing?.type === "drawing" && (
        <DrawingModal
          initialStrokes={drawing.strokes}
          onCancel={() => setDrawingId(null)}
          onSave={(strokes: DrawingStroke[]) => {
            const cropped = cropDrawingWidget(
              drawing,
              strokes,
              viewport.width,
              viewport.height,
            );
            if (cropped) updateWidget(drawing.id, () => cropped);
            else deleteWidget(drawing.id);
            setDrawingId(null);
          }}
        />
      )}
      {previewing && (
        <WaitingPreview screen={draft} onClose={() => setPreviewing(false)} />
      )}
    </section>
  );
}

function WaitingDesignCanvas({
  screen,
  selectedId,
  editingQuestionId,
  interactionDisabled,
  onSelect,
  onEditContent,
  onEditQuestion,
  onEditDrawing,
  onUpdateWidget,
  onViewportChange,
}: {
  screen: WaitingScreen;
  selectedId: string | null;
  editingQuestionId: string | null;
  interactionDisabled: boolean;
  onSelect: (id: string | null) => void;
  onEditContent: (id: string) => void;
  onEditQuestion: (id: string | null) => void;
  onEditDrawing: (id: string) => void;
  onUpdateWidget: (id: string, update: (widget: WaitingWidget) => WaitingWidget) => void;
  onViewportChange: (size: { width: number; height: number }) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const moveableRef = useRef<Moveable | null>(null);
  const pendingRef = useRef<PixelGeometry | null>(null);
  const screenRef = useRef(screen);
  const sizeRef = useRef({ width: 0, height: 0 });
  const updateRef = useRef(onUpdateWidget);
  const [size, setSize] = useState({ width: 0, height: 0 });
  screenRef.current = screen;
  sizeRef.current = size;
  updateRef.current = onUpdateWidget;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const update = () => {
      const next = { width: canvas.clientWidth, height: canvas.clientHeight };
      setSize(next);
      onViewportChange(next);
    };
    const observer = new ResizeObserver(update);
    observer.observe(canvas);
    update();
    return () => observer.disconnect();
  }, [onViewportChange]);

  const commitGeometry = useCallback((
    id: string,
    pixel: PixelGeometry,
    change: "position" | "resize" | "rotation",
  ) => {
    const viewport = sizeRef.current;
    if (viewport.width <= 0 || viewport.height <= 0) return;
    const geometry = fromPixelGeometry(pixel, viewport.width, viewport.height);
    updateRef.current(id, (widget) => {
      if (change === "position") {
        return { ...widget, offsetX: geometry.offsetX, offsetY: geometry.offsetY };
      }
      if (change === "rotation") {
        return {
          ...widget,
          offsetX: geometry.offsetX,
          offsetY: geometry.offsetY,
          rotation: geometry.rotation,
        };
      }
      return { ...widget, ...geometry };
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const moveable = new Moveable(canvas, {
      target: null,
      draggable: true,
      resizable: true,
      rotatable: true,
      origin: false,
      renderDirections: ["nw", "n", "ne", "e", "se", "s", "sw", "w"],
    });
    moveableRef.current = moveable;

    moveable.on("dragStart", (event) => {
      const target = event.target as HTMLElement;
      const widget = screenRef.current.widgets.find((item) => item.id === target.dataset.widgetId);
      const viewport = sizeRef.current;
      if (!widget || viewport.width <= 0 || viewport.height <= 0) return;
      pendingRef.current = toPixelGeometry(widget, viewport.width, viewport.height);
      target.classList.add("waiting-editor-widget--dragging");
    }).on("drag", (event) => {
      const target = event.target as HTMLElement;
      const pending = pendingRef.current;
      if (!pending) return;
      pendingRef.current = { ...pending, left: event.left, top: event.top };
      target.style.left = `${event.left}px`;
      target.style.top = `${event.top}px`;
    }).on("dragEnd", (event) => {
      const target = event.target as HTMLElement;
      target.classList.remove("waiting-editor-widget--dragging");
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending && target.dataset.widgetId) {
        commitGeometry(target.dataset.widgetId, pending, "position");
      }
    });
    moveable.on("resizeStart", (event) => {
      const target = event.target as HTMLElement;
      const widget = screenRef.current.widgets.find((item) => item.id === target.dataset.widgetId);
      const viewport = sizeRef.current;
      if (widget) pendingRef.current = toPixelGeometry(widget, viewport.width, viewport.height);
    }).on("resize", (event) => {
      const target = event.target as HTMLElement;
      const widget = screenRef.current.widgets.find((item) => item.id === target.dataset.widgetId);
      const pending = pendingRef.current;
      if (!widget || !pending) return;
      const minimum = WAITING_WIDGET_MINIMUMS[widget.type];
      pendingRef.current = {
        ...pending,
        left: event.drag.left,
        top: event.drag.top,
        width: Math.max(event.width, minimum.width),
        height: Math.max(event.height, minimum.height),
      };
      Object.assign(target.style, {
        left: `${pendingRef.current.left}px`,
        top: `${pendingRef.current.top}px`,
        width: `${pendingRef.current.width}px`,
        height: `${pendingRef.current.height}px`,
      });
    }).on("resizeEnd", (event) => {
      const target = event.target as HTMLElement;
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending && target.dataset.widgetId) {
        commitGeometry(target.dataset.widgetId, pending, "resize");
      }
    });
    moveable.on("rotateStart", (event) => {
      const target = event.target as HTMLElement;
      const widget = screenRef.current.widgets.find((item) => item.id === target.dataset.widgetId);
      const viewport = sizeRef.current;
      if (!widget) return;
      pendingRef.current = toPixelGeometry(widget, viewport.width, viewport.height);
      event.set(widget.rotation);
    }).on("rotate", (event) => {
      const target = event.target as HTMLElement;
      const pending = pendingRef.current;
      if (!pending) return;
      pendingRef.current = {
        ...pending,
        left: event.drag.left,
        top: event.drag.top,
        rotation: event.beforeRotation,
      };
      target.style.left = `${pendingRef.current.left}px`;
      target.style.top = `${pendingRef.current.top}px`;
      target.style.transform = `rotate(${pendingRef.current.rotation}deg)`;
    }).on("rotateEnd", (event) => {
      const target = event.target as HTMLElement;
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending && target.dataset.widgetId) {
        commitGeometry(target.dataset.widgetId, pending, "rotation");
      }
    });
    return () => {
      moveableRef.current = null;
      moveable.destroy();
    };
  }, [commitGeometry]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const moveable = moveableRef.current;
    if (!canvas || !moveable) return;
    const target = selectedId && editingQuestionId !== selectedId && !interactionDisabled
      ? canvas.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(selectedId)}"]`)
      : null;
    moveable.setState({ target }, () => moveable.updateRect());
  }, [editingQuestionId, interactionDisabled, screen, selectedId]);

  return (
    <div
      ref={canvasRef}
      class="waiting-design-canvas"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onSelect(null);
      }}
    >
      {screen.widgets.map((widget) => {
        const geometry = safeGeometry(widget);
        const pixel = toPixelGeometry(geometry, size.width, size.height);
        const isEditingQuestion = widget.type === "question" && editingQuestionId === widget.id;
        return (
          <section
            key={widget.id}
            data-widget-id={widget.id}
            class={`waiting-editor-widget waiting-widget--${widget.type}${isEditingQuestion ? " waiting-editor-widget--editing" : ""}`}
            style={{
              left: `${pixel.left}px`,
              top: `${pixel.top}px`,
              width: `${pixel.width}px`,
              height: `${pixel.height}px`,
              transform: `rotate(${pixel.rotation}deg)`,
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (interactionDisabled) return;
              const wasSelected = selectedId === widget.id;
              onSelect(widget.id);
              if (!wasSelected) {
                const target = event.currentTarget as HTMLElement;
                moveableRef.current?.setState({ target }, () => {
                  moveableRef.current?.updateRect();
                  moveableRef.current?.dragStart(event);
                });
              }
            }}
            onDblClick={(event) => {
              event.stopPropagation();
              if (widget.type === "drawing") onEditDrawing(widget.id);
              else if (widget.type === "question") onEditQuestion(widget.id);
              else onEditContent(widget.id);
            }}
          >
            {widget.type === "text" && (
              <div class={`waiting-font--${widget.fontFamily}`}><MarkdownContent markdown={widget.markdown} /></div>
            )}
            {widget.type === "question" && (isEditingQuestion
              ? (
                <textarea
                  class="waiting-question-editor"
                  autofocus
                  value={widget.question}
                  onInput={(event) => onUpdateWidget(widget.id, (current) =>
                    current.type === "question"
                      ? { ...current, question: (event.target as HTMLTextAreaElement).value }
                      : current
                  )}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") onEditQuestion(null);
                  }}
                />
              )
              : <label><span>{widget.question}</span><textarea disabled /></label>)}
            {widget.type === "drawing" && (widget.strokes.length > 0
              ? <DrawingCanvas strokes={widget.strokes} />
              : <span class="waiting-empty-drawing">double-click to draw</span>)}
          </section>
        );
      })}
    </div>
  );
}

function ContentModal({
  widget,
  onSave,
  onCancel,
}: {
  widget: WaitingTextWidget;
  onSave: (widget: WaitingTextWidget) => void;
  onCancel: () => void;
}) {
  const [markdown, setMarkdown] = useState(widget.markdown);
  const [fontFamily, setFontFamily] = useState<WaitingFontFamily>(widget.fontFamily);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div class="waiting-modal-backdrop" role="presentation">
      <section class="waiting-content-modal" role="dialog" aria-modal="true" aria-labelledby="content-editor-title">
        <header>
          <h2 id="content-editor-title" class="scrulk-section-title">
            Edit text
          </h2>
          <label class="waiting-font-control">
            Font
            <select value={fontFamily} onChange={(event) => setFontFamily(
              (event.target as HTMLSelectElement).value as WaitingFontFamily,
            )}>
              {WAITING_FONT_FAMILIES.map((font) => (
                <option key={font} value={font}>{font}</option>
              ))}
            </select>
          </label>
        </header>
        <div class="waiting-content-modal-body">
          <MarkdownEditor value={markdown} onChange={setMarkdown} onDone={onCancel} />
        </div>
        <footer>
          <button type="button" class="secondary" onClick={onCancel}>cancel</button>
          <button type="button" class="primary" onClick={() => onSave({
            ...widget,
            markdown,
            fontFamily,
          })}>save</button>
        </footer>
      </section>
    </div>
  );
}

function WaitingPreview({ screen, onClose }: { screen: WaitingScreen; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div class="waiting-preview" role="dialog" aria-modal="true" aria-label="Waiting screen preview">
      <WaitingScreenView screen={screen} timerElapsed={false} onQuestionsComplete={noop} />
      <button type="button" class="waiting-preview-exit" onClick={onClose}>exit preview</button>
    </div>
  );
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.matches("input, textarea, select, [contenteditable='true']") ||
    target.closest("input, textarea, select, [contenteditable='true']") !== null;
}
