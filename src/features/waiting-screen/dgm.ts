import {
  basicSetup,
  type Box,
  type Editor,
  type EditorOptions,
  type Shape,
  textUtils,
  utils,
} from "@dgmjs/core";
import { WAITING_QUESTION_TAG } from "./model";

export const WAITING_TOOL_IDS = [
  "Select",
  "Hand",
  "Eraser",
  "Rectangle",
  "Text",
  "Image",
  "Freehand",
  "Highlighter",
] as const;

export type WaitingToolId = (typeof WAITING_TOOL_IDS)[number];

export interface WaitingQuestionAppearance {
  fontColor: string;
  fontFamily: string;
  textAlign: Box["horzAlign"];
}

export interface WaitingShortcutEvent {
  key: string;
  defaultPrevented: boolean;
  repeat: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  editableTarget: boolean;
}

export function isWaitingToolId(value: string): value is WaitingToolId {
  return (WAITING_TOOL_IDS as readonly string[]).includes(value);
}

export function waitingToolShortcut(id: WaitingToolId): string {
  return String(WAITING_TOOL_IDS.indexOf(id) + 1);
}

export function waitingToolForShortcut(key: string): WaitingToolId | null {
  const index = Number(key) - 1;
  return Number.isInteger(index) ? WAITING_TOOL_IDS[index] ?? null : null;
}

export function waitingToolForKeyboardEvent(event: WaitingShortcutEvent): WaitingToolId | null {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.editableTarget
  ) return null;
  return waitingToolForShortcut(event.key);
}

export function createWaitingEditorOptions(): Partial<EditorOptions> {
  const setup = basicSetup();
  const toolKeymap = Object.fromEntries(WAITING_TOOL_IDS.map((id) => [
    waitingToolShortcut(id),
    (editor: Editor) => editor.activateHandler(id),
  ]));
  return {
    ...setup,
    handlers: WAITING_TOOL_IDS.flatMap((id) => {
      const handler = setup.handlers?.find((candidate) => candidate.id === id);
      return handler ? [handler] : [];
    }),
    keymap: { ...setup.keymap, ...toolKeymap },
    blankColor: "$background",
    canvasColor: "$background",
    showCreateConnectorController: false,
  };
}

export function createWaitingViewerOptions(): Partial<EditorOptions> {
  return {
    handlers: [],
    keymap: {},
    defaultHandlerId: null,
    allowAutoScroll: false,
    allowCreateTextOnCanvas: false,
    allowCreateTextOnConnector: false,
    blankColor: "$background",
    canvasColor: "$background",
    showCreateConnectorController: false,
  };
}

export function getWaitingQuestionShapes(editor: Editor): Box[] {
  const page = editor.getCurrentPage();
  if (!page) return [];
  return page.findAllByQuery(`#${WAITING_QUESTION_TAG}`).filter(isBox);
}

export function getWaitingQuestionPrompt(shape: Box): string {
  return textUtils.extractTextFromShapes([shape]).trim();
}

export function getWaitingQuestionAppearance(
  editor: Editor,
  shape: Box,
): WaitingQuestionAppearance {
  return {
    fontColor: editor.canvas.resolveColor(shape.fontColor),
    fontFamily: shape.fontFamily,
    textAlign: shape.horzAlign,
  };
}

export function getWaitingPageOriginPosition(editor: Editor): [number, number] | null {
  const size = editor.getCurrentPage()?.size;
  if (!size || size.length < 2) return null;
  const [width = 0, height = 0] = size;
  const [left = 0, top = 0] = utils.gcs2dcs(editor.canvas, [width / 2, height / 2]);
  return [left, top];
}

export function hideWaitingPageBoundary(editor: Editor): void {
  editor.canvas.colorVariables["slate9"] = editor.canvas.resolveColor("$background");
  editor.repaint();
}

export function isWaitingQuestionShape(shape: Shape): shape is Box {
  return isBox(shape) && shape.tags.includes(WAITING_QUESTION_TAG);
}

function isBox(shape: Shape): shape is Box {
  return "text" in shape;
}
