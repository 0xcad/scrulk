import type { Editor, Shape, ShapeProps } from "@dgmjs/core";
import { DGMEditor } from "@dgmjs/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { getSettings, onSettingsChange, setSettings } from "../../shared/storage";
import {
  createWaitingEditorOptions,
  isWaitingToolId,
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

interface Props {
  onDirtyChange: (dirty: boolean) => void;
}

export function WaitingEditor({ onDirtyChange }: Props) {
  const [saved, setSaved] = useState<WaitingScreen | null>(null);
  const [draft, setDraft] = useState<WaitingScreen | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [activeTool, setActiveTool] = useState<WaitingToolId>("Select");
  const [selections, setSelections] = useState<Shape[]>([]);
  const [paletteDefaults, setPaletteDefaults] = useState<EditorPaletteDefaults>(
    DEFAULT_EDITOR_PALETTE,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const draftRef = useRef<WaitingScreen | null>(null);
  const loadingRef = useRef(false);
  const paletteDefaultsRef = useRef(paletteDefaults);
  const options = useMemo(createWaitingEditorOptions, []);
  const dirty = saved !== null && draft !== null && JSON.stringify(saved) !== JSON.stringify(draft);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  draftRef.current = draft;
  paletteDefaultsRef.current = paletteDefaults;

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
      setLoadError(null);
      setActiveTool("Select");
      setSelections([]);
    } catch (error: unknown) {
      setLoadError(`Could not load waiting screen data: ${errorMessage(error)}. Reset it from the Debug tab.`);
    } finally {
      loadingRef.current = false;
    }
  }, []);

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
    if (!editor) return;
    const observer = new ResizeObserver(() => {
      editor.fit();
      editor.repaint();
    });
    observer.observe(editor.parent);
    return () => observer.disconnect();
  }, [editor]);

  if (!draft || !saved) return <p>Loading…</p>;

  const handleMount = (nextEditor: Editor) => {
    editorRef.current = nextEditor;
    setEditor(nextEditor);
    loadDocument(draftRef.current ?? draft);
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
    setPaletteDefaults((current) => updatePaletteDefaults(current, kind, props));
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

  return (
    <section class="waiting-editor-page">
      <div class="waiting-design-canvas">
        <DGMEditor
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
          onTransaction={captureDocument}
          onUndo={captureDocument}
          onRedo={captureDocument}
        />
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
