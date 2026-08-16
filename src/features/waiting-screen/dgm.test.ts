import { Rectangle, type Editor } from "@dgmjs/core";
import { describe, expect, it, vi } from "vitest";
import {
  createWaitingEditorOptions,
  createWaitingViewerOptions,
  getWaitingPageOriginPosition,
  getWaitingQuestionAppearance,
  hideWaitingPageBoundary,
  isWaitingQuestionShape,
  waitingToolForKeyboardEvent,
  waitingToolShortcut,
  WAITING_TOOL_IDS,
} from "./dgm";
import { WAITING_QUESTION_TAG } from "./model";

describe("waiting DGM integration", () => {
  it("exposes only the chosen editing handlers", () => {
    const editorOptions = createWaitingEditorOptions();
    const viewerOptions = createWaitingViewerOptions();
    expect(editorOptions.handlers?.map(({ id }) => id)).toEqual(WAITING_TOOL_IDS);
    expect(viewerOptions.handlers).toEqual([]);
    expect(editorOptions.blankColor).toBe("$background");
    expect(editorOptions.canvasColor).toBe("$background");
    expect(viewerOptions.blankColor).toBe("$background");
    expect(viewerOptions.canvasColor).toBe("$background");
  });

  it("maps unmodified number keys to tools and blocks editing keystrokes", () => {
    expect(WAITING_TOOL_IDS.map(waitingToolShortcut)).toEqual([
      "1", "2", "3", "4", "5", "6", "7", "8",
    ]);
    const event = {
      key: "5",
      defaultPrevented: false,
      repeat: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      editableTarget: false,
    };
    expect(waitingToolForKeyboardEvent(event)).toBe("Text");
    expect(waitingToolForKeyboardEvent({ ...event, editableTarget: true })).toBeNull();
    expect(waitingToolForKeyboardEvent({ ...event, ctrlKey: true })).toBeNull();
    expect(waitingToolForKeyboardEvent({ ...event, key: "9" })).toBeNull();
  });

  it("binds number shortcuts through DGM's canvas keymap", () => {
    const activateHandler = vi.fn();
    const editor = { activateHandler } as unknown as Editor;
    const keymap = createWaitingEditorOptions().keymap;

    keymap?.["1"]?.(editor);
    keymap?.["5"]?.(editor);
    keymap?.["8"]?.(editor);

    expect(activateHandler.mock.calls).toEqual([
      ["Select"],
      ["Text"],
      ["Highlighter"],
    ]);
  });

  it("recognizes and resolves the appearance of tagged question boxes", () => {
    const shape = new Rectangle();
    shape.tags = [WAITING_QUESTION_TAG];
    shape.fontColor = "$foreground";
    shape.fontFamily = "serif";
    shape.horzAlign = "right";
    const editor = {
      canvas: { resolveColor: vi.fn(() => "#123456") },
    } as unknown as Editor;

    expect(isWaitingQuestionShape(shape)).toBe(true);
    expect(getWaitingQuestionAppearance(editor, shape)).toEqual({
      fontColor: "#123456",
      fontFamily: "serif",
      textAlign: "right",
    });
  });

  it("places the visual origin at the fixed page center", () => {
    const globalCoordTransform = vi.fn(([x = 0, y = 0]: number[]) => [x * 2, y * 2]);
    const editor = {
      getCurrentPage: () => ({ size: [1000, 650] }),
      canvas: { globalCoordTransform, ratio: 2 },
    } as unknown as Editor;

    expect(getWaitingPageOriginPosition(editor)).toEqual([500, 325]);
    expect(globalCoordTransform).toHaveBeenCalledWith([500, 325]);
    expect(getWaitingPageOriginPosition({
      getCurrentPage: () => ({ size: null }),
    } as unknown as Editor)).toBeNull();
  });

  it("matches DGM's page border token to the canvas background", () => {
    const repaint = vi.fn();
    const editor = {
      canvas: {
        colorVariables: { slate9: "#64748b" },
        resolveColor: vi.fn(() => "#ffffff"),
      },
      repaint,
    } as unknown as Editor;

    hideWaitingPageBoundary(editor);
    expect(editor.canvas.colorVariables["slate9"]).toBe("#ffffff");
    expect(repaint).toHaveBeenCalledOnce();
  });
});
