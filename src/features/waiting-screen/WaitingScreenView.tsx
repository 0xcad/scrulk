import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { DrawingCanvas } from "./DrawingCanvas";
import { toPixelGeometry } from "./geometry";
import { MarkdownContent } from "./MarkdownContent";
import { waitingQuestionsComplete, type WaitingScreen, type WaitingWidget } from "./model";

interface Props {
  screen: WaitingScreen;
  timerElapsed: boolean;
  onQuestionsComplete: () => void;
}

interface Answer {
  question: string;
  value: string;
}

export function WaitingScreenView({ screen, timerElapsed, onQuestionsComplete }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [answers, setAnswers] = useState<Record<string, Answer>>({});

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const update = () => setSize({ width: root.clientWidth, height: root.clientHeight });
    const observer = new ResizeObserver(update);
    observer.observe(root);
    update();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setAnswers((current) => Object.fromEntries(
      screen.widgets.flatMap((widget) => {
        if (widget.type !== "question") return [];
        const existing = current[widget.id];
        return [[widget.id, existing?.question === widget.question
          ? existing
          : { question: widget.question, value: "" }]];
      }),
    ));
  }, [screen]);

  const questionsComplete = useMemo(() => waitingQuestionsComplete(
    screen,
    Object.fromEntries(Object.entries(answers).map(([id, answer]) => [id, answer.value])),
  ), [answers, screen]);

  useEffect(() => {
    if (timerElapsed && questionsComplete) onQuestionsComplete();
  }, [onQuestionsComplete, questionsComplete, timerElapsed]);

  return (
    <main ref={rootRef} class="waiting-screen" aria-label="Waiting screen">
      {screen.widgets.map((widget) => (
        <WaitingWidgetView
          key={widget.id}
          widget={widget}
          viewport={size}
          answer={answers[widget.id]?.value ?? ""}
          onAnswer={(value) => setAnswers((current) => ({
            ...current,
            [widget.id]: { question: widget.type === "question" ? widget.question : "", value },
          }))}
        />
      ))}
    </main>
  );
}

function WaitingWidgetView({
  widget,
  viewport,
  answer,
  onAnswer,
}: {
  widget: WaitingWidget;
  viewport: { width: number; height: number };
  answer: string;
  onAnswer: (value: string) => void;
}) {
  const pixel = toPixelGeometry(widget, viewport.width, viewport.height);
  const style = {
    left: `${pixel.left}px`,
    top: `${pixel.top}px`,
    width: `${pixel.width}px`,
    height: `${pixel.height}px`,
    transform: `rotate(${pixel.rotation}deg)`,
  };
  return (
    <section class={`waiting-widget waiting-widget--${widget.type}`} style={style}>
      {widget.type === "text" && (
        <div class={`waiting-font--${widget.fontFamily}`}><MarkdownContent markdown={widget.markdown} /></div>
      )}
      {widget.type === "question" && (
        <label>
          <span>{widget.question}</span>
          <textarea value={answer} onInput={(event) => onAnswer((event.target as HTMLTextAreaElement).value)} />
          <small class={answer.length < 20 ? "waiting-answer-short" : ""}>{answer.length}/20</small>
        </label>
      )}
      {widget.type === "drawing" && <DrawingCanvas strokes={widget.strokes} />}
    </section>
  );
}
