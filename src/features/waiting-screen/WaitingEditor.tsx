import type { Box, Editor, Shape, ShapeProps } from "@dgmjs/core";
import {
  DGMEditorCore,
  DGMTextInplaceEditor,
  type TiptapEditor,
} from "@dgmjs/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { getSettings, onSettingsChange, setSettings } from "../../shared/storage";
import {
  createWaitingEditorOptions,
  getWaitingPageOriginPosition,
  hideWaitingPageBoundary,
  isWaitingToolId,
  waitingToolForKeyboardEvent,
  type WaitingToolId,
} from "./dgm";
import {
  DEFAULT_EDITOR_PALETTE,
  initializeWaitingShape,
  paletteTargets,
  updatePaletteDefaults,
  type EditorPaletteDefaults,
  type PaletteKind,
} from "./editorPalette";
import {
  cloneWaitingScreen,
  DEFAULT_WAITING_SCREEN,
  WAITING_SCREEN_MAX_BYTES,
  waitingScreenBytes,
  type WaitingScreen,
} from "./model";
import { WaitingEditorPalette, WaitingEditorToolbar } from "./WaitingEditorControls";
import { installWaitingHeadingShortcuts } from "./textShortcuts";

interface Props {
  onDirtyChange: (dirty: boolean) => void;
}

export function WaitingEditor({ onDirtyChange }: Props) {
  const [saved, setSaved] = useState<WaitingScreen | null>(null);
  const [draft, setDraft] = useState<WaitingScreen | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [activeTool, setActiveTool] = useState<WaitingToolId>("Select");
  const [selections, setSelections] = useState<Shape[]>([]);
  const [originPosition, setOriginPosition] = useState<[number, number] | null>(null);
  const [paletteDefaults, setPaletteDefaults] = useState<EditorPaletteDefaults>(
    DEFAULT_EDITOR_PALETTE,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const draftRef = useRef<WaitingScreen | null>(null);
  const loadingRef = useRef(false);
  const paletteDefaultsRef = useRef(paletteDefaults);
  const editingTextShapeRef = useRef<Box | null>(null);
  const textShortcutCleanupRef = useRef<(() => void) | null>(null);
  const options = useMemo(createWaitingEditorOptions, []);
  const dirty = saved !== null && draft !== null && JSON.stringify(saved) !== JSON.stringify(draft);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  draftRef.current = draft;
  paletteDefaultsRef.current = paletteDefaults;

  const updateOriginPosition = useCallback((currentEditor = editorRef.current) => {
    setOriginPosition(currentEditor ? getWaitingPageOriginPosition(currentEditor) : null);
  }, []);

  const loadDocument = useCallback((next: WaitingScreen, fitToScreen = true) => {
    const copy = cloneWaitingScreen(next);
    setDraft(copy);
    draftRef.current = copy;
    const currentEditor = editorRef.current;
    if (!currentEditor) return;

    loadingRef.current = true;
    try {
      currentEditor.loadFromJSON(copy);
      currentEditor.update();
      currentEditor.fit();
      if (fitToScreen) currentEditor.fitToScreen(0.9, 1);
      currentEditor.repaint();
      currentEditor.activateDefaultHandler();
      updateOriginPosition(currentEditor);
      setLoadError(null);
      setActiveTool("Select");
      setSelections([]);
    } catch (error: unknown) {
      setLoadError(`Could not load waiting screen data: ${errorMessage(error)}. Reset it from the Debug tab.`);
    } finally {
      loadingRef.current = false;
    }
  }, [updateOriginPosition]);

  useEffect(() => {
    let mounted = true;
    void getSettings().then((settings) => {
      if (!mounted) return;
      const screen = cloneWaitingScreen(settings.waitingScreen);
      setSaved(screen);
      setDraft(cloneWaitingScreen(screen));
    });
    const unsubscribe = onSettingsChange((settings) => {
      if (!mounted || dirtyRef.current) return;
      const screen = cloneWaitingScreen(settings.waitingScreen);
      setSaved(screen);
      loadDocument(screen);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [loadDocument]);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => () => textShortcutCleanupRef.current?.(), []);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (loadError !== null) return;
      const tool = waitingToolForKeyboardEvent({
        key: event.key,
        defaultPrevented: event.defaultPrevented,
        repeat: event.repeat,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        editableTarget: isEditableTarget(event.target),
      });
      const currentEditor = editorRef.current;
      if (!tool || !currentEditor) return;
      event.preventDefault();
      currentEditor.activateHandler(tool);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loadError]);

  useEffect(() => {
    if (!editor) return;
    const observer = new ResizeObserver(() => {
      editor.fit();
      editor.repaint();
      updateOriginPosition(editor);
    });
    observer.observe(editor.parent);
    return () => observer.disconnect();
  }, [editor, updateOriginPosition]);

  if (!draft || !saved) return <p>Loading…</p>;

  const handleMount = (nextEditor: Editor) => {
    editorRef.current = nextEditor;
    setEditor(nextEditor);
    loadDocument(draftRef.current ?? draft);
    requestAnimationFrame(() => {
      if (!nextEditor.parent.isConnected) return;
      hideWaitingPageBoundary(nextEditor);
      updateOriginPosition(nextEditor);
    });
  };

  const captureDocument = () => {
    const currentEditor = editorRef.current;
    if (!currentEditor || loadingRef.current) return;
    const next = currentEditor.saveToJSON() as WaitingScreen;
    setDraft(cloneWaitingScreen(next));
    setSaveError(null);
  };

  const activateTool = (id: WaitingToolId) => {
    editorRef.current?.activateHandler(id);
  };

  const handlePaletteChange = (kind: PaletteKind, props: ShapeProps) => {
    const currentEditor = editorRef.current;
    if (!currentEditor) return;
    const targets = paletteTargets(kind, selections);
    if (targets.length > 0) {
      currentEditor.actions.update(props, targets);
      return;
    }
    setPaletteDefaults((current) => updatePaletteDefaults(current, kind, props, activeTool));
  };

  const save = async () => {
    const currentEditor = editorRef.current;
    const next = cloneWaitingScreen(
      currentEditor ? currentEditor.saveToJSON() as WaitingScreen : draft,
    );
    const bytes = waitingScreenBytes(next);
    if (bytes > WAITING_SCREEN_MAX_BYTES) {
      setSaveError(`This waiting screen is ${(bytes / 1024 / 1024).toFixed(2)} MB. Remove content until it is under 4 MB.`);
      return;
    }
    try {
      await setSettings({ waitingScreen: next });
      setSaved(cloneWaitingScreen(next));
      setDraft(cloneWaitingScreen(next));
      setSaveError(null);
    } catch (error: unknown) {
      setSaveError(`Could not save waiting screen: ${errorMessage(error)}`);
    }
  };

  const handleTextEditorMount = (tiptapEditor: TiptapEditor) => {
    textShortcutCleanupRef.current?.();
    textShortcutCleanupRef.current = installWaitingHeadingShortcuts(
      tiptapEditor,
      () => editingTextShapeRef.current?.fontSize ?? 16,
    );
  };

  return (
    <section class="waiting-editor-page">
      <div class="waiting-design-canvas">
        <DGMEditorCore
          className="waiting-dgm-editor"
          options={options}
          showGrid={false}
          snapToGrid={false}
          snapToObjects
          onMount={handleMount}
          onSelectionChange={setSelections}
          onActiveHandlerChange={(handler: string) => {
            if (isWaitingToolId(handler)) setActiveTool(handler);
          }}
          onShapeInitialize={(shape: Shape) => {
            initializeWaitingShape(shape, paletteDefaultsRef.current);
          }}
          onZoom={() => updateOriginPosition()}
          onScroll={() => updateOriginPosition()}
          onTransaction={captureDocument}
          onUndo={captureDocument}
          onRedo={captureDocument}
        >
          {editor && (
            <DGMTextInplaceEditor
              className="waiting-dgm-text-editor"
              editor={editor}
              onMount={handleTextEditorMount}
              onOpen={(shape: Box) => {
                editingTextShapeRef.current = shape;
              }}
            />
          )}
        </DGMEditorCore>
        {originPosition && (
          <div
            class="waiting-editor-origin"
            style={{ left: `${originPosition[0]}px`, top: `${originPosition[1]}px` }}
            aria-hidden="true"
          >
            <span>(0,0)</span>
          </div>
        )}
        <WaitingEditorPalette
          activeTool={activeTool}
          defaults={paletteDefaults}
          selections={selections}
          onChange={handlePaletteChange}
        />
        <WaitingEditorToolbar
          activeTool={activeTool}
          disabled={loadError !== null}
          onActivate={activateTool}
        />
        {loadError && <p class="waiting-editor-load-error error" role="alert">{loadError}</p>}
      </div>

      {saveError && <p class="error" role="alert">{saveError}</p>}
      <div class="waiting-editor-actions">
        <button
          type="button"
          class="secondary"
          disabled={!dirty}
          onClick={() => {
            loadDocument(saved);
            setSaveError(null);
          }}
        >
          cancel changes
        </button>
        <button
          type="button"
          onClick={() => {
            loadDocument(DEFAULT_WAITING_SCREEN);
            setSaveError(null);
          }}
        >
          reset
        </button>
        <button
          type="button"
          class="primary"
          disabled={!dirty || loadError !== null}
          onClick={() => void save()}
        >
          save waiting screen
        </button>
      </div>
    </section>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.matches("input, textarea, select, [contenteditable='true']") ||
    target.closest("input, textarea, select, [contenteditable='true']") !== null;
}
