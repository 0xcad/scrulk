import { utils, type Box, type Editor } from "@dgmjs/core";
import { DGMEditorCore } from "@dgmjs/react";
import { useEffect, useMemo, useState } from "preact/hooks";
import {
  createWaitingViewerOptions,
  getWaitingQuestionAppearance,
  getWaitingQuestionPrompt,
  getWaitingQuestionShapes,
  hideWaitingPageBoundary,
} from "./dgm";
import {
  cloneWaitingScreen,
  WAITING_ANSWER_MIN_LENGTH,
  waitingQuestionsComplete,
  type WaitingScreen,
} from "./model";

interface Props {
  screen: WaitingScreen;
  timerElapsed: boolean;
  onQuestionsComplete: () => void;
}

interface Answer {
  question: string;
  value: string;
}

interface QuestionLayout {
  id: string;
  prompt: string;
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
  rotation: number;
  fontColor: string;
  fontFamily: string;
  textAlign: Box["horzAlign"];
}

export function WaitingScreenView({ screen, timerElapsed, onQuestionsComplete }: Props) {
  const [questions, setQuestions] = useState<QuestionLayout[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const options = useMemo(createWaitingViewerOptions, []);

  useEffect(() => {
    setAnswers((current) => Object.fromEntries(
      questions.map((question) => {
        const existing = current[question.id];
        return [question.id, existing?.question === question.prompt
          ? existing
          : { question: question.prompt, value: "" }];
      }),
    ));
  }, [questions]);

  const questionIds = useMemo(() => questions.map(({ id }) => id), [questions]);
  const questionsComplete = useMemo(() => waitingQuestionsComplete(
    questionIds,
    Object.fromEntries(Object.entries(answers).map(([id, answer]) => [id, answer.value])),
  ), [answers, questionIds]);

  useEffect(() => {
    if (loaded && timerElapsed && questionsComplete && !loadError) onQuestionsComplete();
  }, [loadError, loaded, onQuestionsComplete, questionsComplete, timerElapsed]);

  useEffect(() => {
    if (!editor) return;
    setLoaded(false);
    loadViewerDocument(editor, screen, setQuestions, setLoadError, setLoaded);
  }, [editor, screen]);

  const handleMount = (nextEditor: Editor) => {
    setEditor(nextEditor);
    requestAnimationFrame(() => {
      if (nextEditor.parent.isConnected) hideWaitingPageBoundary(nextEditor);
    });
  };

  useEffect(() => {
    if (!editor) return;
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => layoutViewer(editor, setQuestions));
    });
    observer.observe(editor.parent);
    return () => observer.disconnect();
  }, [editor]);

  return (
    <main class="waiting-screen" aria-label="Waiting screen">
      <DGMEditorCore
        className="waiting-dgm-viewer"
        options={options}
        showGrid={false}
        snapToGrid={false}
        snapToObjects={false}
        onMount={handleMount}
      />
      {questions.map((question) => {
        const answer = answers[question.id]?.value ?? "";
        return (
          <label
            key={question.id}
            class="waiting-question"
            style={{
              left: `${question.left}px`,
              top: `${question.top}px`,
              width: `${question.width}px`,
              height: `${question.height}px`,
              transform: `rotate(${question.rotation}deg) scale(${question.scale})`,
            }}
          >
            <span
              class="waiting-question-prompt"
              style={{
                color: question.fontColor,
                fontFamily: question.fontFamily,
                textAlign: question.textAlign,
              }}
            >
              {question.prompt}
            </span>
            <textarea
              value={answer}
              onInput={(event) => {
                const value = (event.target as HTMLTextAreaElement).value;
                setAnswers((current) => ({
                  ...current,
                  [question.id]: { question: question.prompt, value },
                }));
              }}
            />
            <small class={answer.length < WAITING_ANSWER_MIN_LENGTH ? "waiting-answer-short" : ""}>
              {answer.length}/{WAITING_ANSWER_MIN_LENGTH}
            </small>
          </label>
        );
      })}
      {loadError && <p class="waiting-viewer-error error" role="alert">{loadError}</p>}
    </main>
  );
}

function loadViewerDocument(
  editor: Editor,
  screen: WaitingScreen,
  setQuestions: (questions: QuestionLayout[]) => void,
  setLoadError: (error: string | null) => void,
  setLoaded: (loaded: boolean) => void,
): void {
  try {
    editor.loadFromJSON(cloneWaitingScreen(screen));
    editor.update();
    for (const shape of getWaitingQuestionShapes(editor)) shape.opacity = 0;
    editor.update();
    setLoadError(null);
    layoutViewer(editor, setQuestions);
    setLoaded(true);
  } catch (error: unknown) {
    setQuestions([]);
    setLoaded(false);
    setLoadError(`Could not load waiting screen data: ${errorMessage(error)}`);
  }
}

function layoutViewer(
  editor: Editor,
  setQuestions: (questions: QuestionLayout[]) => void,
): void {
  editor.fit();
  editor.fitToScreen(0.9, 1);
  editor.repaint(false);
  const scale = editor.getScale();
  setQuestions(getWaitingQuestionShapes(editor).map((shape) => questionLayout(editor, shape, scale)));
}

function questionLayout(editor: Editor, shape: Box, scale: number): QuestionLayout {
  const rect = shape.getRectInDCS(editor.canvas);
  const [left = 0, top = 0] = rect[0] ?? [];
  const [right = left, bottom = top] = rect[1] ?? [];
  const appearance = getWaitingQuestionAppearance(editor, shape);
  return {
    id: shape.id,
    prompt: getWaitingQuestionPrompt(shape),
    left,
    top,
    width: right - left,
    height: bottom - top,
    scale,
    rotation: utils.angleInCCS(editor.canvas, shape),
    ...appearance,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
