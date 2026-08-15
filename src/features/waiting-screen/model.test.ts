import { describe, expect, it } from "vitest";
import {
  DEFAULT_WAITING_SCREEN,
  normalizeWaitingScreen,
  waitingQuestionsComplete,
  waitingScreenBytes,
  WAITING_SCREEN_MAX_BYTES,
} from "./model";

describe("waiting-screen model", () => {
  it("provides the title and two default questions", () => {
    expect(DEFAULT_WAITING_SCREEN.widgets.map((widget) => widget.type))
      .toEqual(["text", "question", "question"]);
    expect(DEFAULT_WAITING_SCREEN.widgets[0]).toMatchObject({ markdown: "# waiting" });
  });

  it("normalizes supported widgets and drops duplicate or malformed entries", () => {
    const screen = normalizeWaitingScreen({ widgets: [
      { ...DEFAULT_WAITING_SCREEN.widgets[0], fontFamily: "unknown", x: 4 },
      DEFAULT_WAITING_SCREEN.widgets[0],
      { id: "bad", type: "question" },
    ] });
    expect(screen.widgets).toHaveLength(1);
    expect(screen.widgets[0]).toMatchObject({ fontFamily: "sans", x: 1 });
  });

  it("counts raw answer characters and treats an empty question list as complete", () => {
    const question = DEFAULT_WAITING_SCREEN.widgets[1]!;
    expect(waitingQuestionsComplete(DEFAULT_WAITING_SCREEN, {
      [question.id]: "                    ",
      [DEFAULT_WAITING_SCREEN.widgets[2]!.id]: "12345678901234567890",
    })).toBe(true);
    expect(waitingQuestionsComplete({ widgets: [] }, {})).toBe(true);
    expect(waitingQuestionsComplete(DEFAULT_WAITING_SCREEN, {})).toBe(false);
  });

  it("measures serialized UTF-8 bytes against the screen cap", () => {
    expect(waitingScreenBytes(DEFAULT_WAITING_SCREEN)).toBeLessThan(WAITING_SCREEN_MAX_BYTES);
    expect(waitingScreenBytes({ widgets: [{
      ...DEFAULT_WAITING_SCREEN.widgets[0]!,
      type: "text",
      markdown: "🙂".repeat(WAITING_SCREEN_MAX_BYTES / 2),
      fontFamily: "sans",
    }] })).toBeGreaterThan(WAITING_SCREEN_MAX_BYTES);
  });
});
