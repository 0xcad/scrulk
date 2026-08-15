import {
  basicSetup,
  type Box,
  type Editor,
  type EditorOptions,
  type Shape,
  textUtils,
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

export function isWaitingToolId(value: string): value is WaitingToolId {
  return (WAITING_TOOL_IDS as readonly string[]).includes(value);
}

export function createWaitingEditorOptions(): Partial<EditorOptions> {
  const setup = basicSetup();
  return {
    ...setup,
    handlers: WAITING_TOOL_IDS.flatMap((id) => {
      const handler = setup.handlers?.find((candidate) => candidate.id === id);
      return handler ? [handler] : [];
    }),
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

function isBox(shape: Shape): shape is Box {
  return "text" in shape;
}
