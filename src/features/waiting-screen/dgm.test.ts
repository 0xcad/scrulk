import { describe, expect, it } from "vitest";
import {
  createWaitingEditorOptions,
  createWaitingViewerOptions,
  WAITING_TOOL_IDS,
} from "./dgm";

describe("waiting DGM integration", () => {
  it("exposes only the chosen editing handlers", () => {
    expect(createWaitingEditorOptions().handlers?.map(({ id }) => id)).toEqual(WAITING_TOOL_IDS);
    expect(createWaitingViewerOptions().handlers).toEqual([]);
  });
});
