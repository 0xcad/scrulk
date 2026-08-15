export const WAITING_SCREEN_MAX_BYTES = 4 * 1024 * 1024;
export const WAITING_QUESTION_TAG = "scrulk-question";
export const WAITING_ANSWER_MIN_LENGTH = 20;

/** Raw JSON emitted by DGM.js's Editor.saveToJSON(). */
export type WaitingScreen = Record<string, unknown>;

export const DEFAULT_WAITING_SCREEN: WaitingScreen = {
  id: "default-waiting-doc",
  type: "Doc",
  parent: null,
  children: [
    {
      id: "default-waiting-page",
      type: "Page",
      parent: "default-waiting-doc",
      children: [
        {
          id: "default-waiting-title",
          type: "Text",
          parent: "default-waiting-page",
          left: 250,
          top: 45,
          width: 500,
          height: 100,
          strokeColor: "$transparent",
          fillColor: "$transparent",
          fontFamily: "monospace",
          fontSize: 56,
          text: "waiting",
        },
        defaultQuestion(
          "default-question-intent",
          205,
          "what do you want out of this?",
        ),
        defaultQuestion(
          "default-question-possibility",
          385,
          "if you could do anything, what would it be?",
        ),
      ],
      name: "Waiting",
      enable: false,
      size: [1000, 650],
    },
  ],
};

function defaultQuestion(id: string, top: number, text: string): Record<string, unknown> {
  return {
    id,
    type: "Rectangle",
    parent: "default-waiting-page",
    tags: [WAITING_QUESTION_TAG],
    left: 220,
    top,
    width: 560,
    height: 130,
    text,
    wordWrap: true,
    corners: [10, 10, 10, 10],
  };
}

export function cloneWaitingScreen(screen: WaitingScreen): WaitingScreen {
  return structuredClone(screen);
}

export function waitingScreenBytes(screen: WaitingScreen): number {
  return new TextEncoder().encode(JSON.stringify(screen)).byteLength;
}

export function waitingQuestionsComplete(
  questionIds: string[],
  answers: Record<string, string | undefined>,
): boolean {
  return questionIds.every((id) =>
    (answers[id]?.length ?? 0) >= WAITING_ANSWER_MIN_LENGTH
  );
}

/**
 * There is intentionally no compatibility layer for the removed widget model.
 * Existing object-shaped data remains untouched so its owner can replace it
 * explicitly with the reset action in the Debug tab.
 */
export function normalizeWaitingScreen(raw: unknown): WaitingScreen {
  return isRecord(raw)
    ? cloneWaitingScreen(raw)
    : cloneWaitingScreen(DEFAULT_WAITING_SCREEN);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
