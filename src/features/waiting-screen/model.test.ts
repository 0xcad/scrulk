import { Doc, Page, Store, shapeInstantiator } from "@dgmjs/core";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_WAITING_SCREEN,
  normalizeWaitingScreen,
  WAITING_QUESTION_TAG,
  WAITING_SCREEN_MAX_BYTES,
  waitingQuestionsComplete,
  waitingScreenBytes,
} from "./model";

describe("waiting-screen model", () => {
  it("defines one default DGM page with the title and two questions", () => {
    expect(DEFAULT_WAITING_SCREEN["type"]).toBe("Doc");
    const pages = childrenOf(DEFAULT_WAITING_SCREEN);
    expect(pages).toHaveLength(1);
    expect(pages[0]?.["type"]).toBe("Page");

    const shapes = childrenOf(pages[0] ?? {});
    expect(shapes.find((shape) => shape["type"] === "Text")?.["text"]).toBe("waiting");
    expect(shapes.filter(isQuestion).map((shape) => shape["text"])).toEqual([
      "what do you want out of this?",
      "if you could be doing anything right now, what would it be?",
    ]);
  });

  it("loads the default through DGM's document store", () => {
    const store = new Store(shapeInstantiator);
    store.fromJSON(DEFAULT_WAITING_SCREEN);
    expect(store.root).toBeInstanceOf(Doc);
    expect(store.root?.children).toHaveLength(1);
    const page = store.root?.children[0];
    expect(page).toBeInstanceOf(Page);
    expect((page as Page).findAllByQuery(`#${WAITING_QUESTION_TAG}`)).toHaveLength(2);
  });

  it("uses the default only when stored data is absent or not an object", () => {
    expect(normalizeWaitingScreen(undefined)).toEqual(DEFAULT_WAITING_SCREEN);
    expect(normalizeWaitingScreen([])).toEqual(DEFAULT_WAITING_SCREEN);

    const legacy = { widgets: [{ id: "old-data" }] };
    expect(normalizeWaitingScreen(legacy)).toEqual(legacy);
    expect(normalizeWaitingScreen(legacy)).not.toBe(legacy);
  });

  it("requires twenty characters for every question", () => {
    const ids = ["one", "two"];
    expect(waitingQuestionsComplete(ids, {
      one: "12345678901234567890",
      two: "1234567890123456789",
    })).toBe(false);
    expect(waitingQuestionsComplete(ids, {
      one: "12345678901234567890",
      two: "12345678901234567890",
    })).toBe(true);
    expect(waitingQuestionsComplete([], {})).toBe(true);
  });

  it("keeps the default below the storage limit", () => {
    expect(waitingScreenBytes(DEFAULT_WAITING_SCREEN)).toBeLessThan(WAITING_SCREEN_MAX_BYTES);
  });
});

function childrenOf(value: Record<string, unknown>): Record<string, unknown>[] {
  const children = value["children"];
  return Array.isArray(children)
    ? children.filter((child): child is Record<string, unknown> =>
      child !== null && typeof child === "object" && !Array.isArray(child)
    )
    : [];
}

function isQuestion(shape: Record<string, unknown>): boolean {
  return Array.isArray(shape["tags"]) && shape["tags"].includes(WAITING_QUESTION_TAG);
}
