import { describe, expect, it } from "vitest";
import { shouldDeleteSelectedWidget } from "./editor";

describe("waiting editor keyboard deletion", () => {
  it("deletes only a selected widget from the unblocked editor surface", () => {
    expect(shouldDeleteSelectedWidget({
      key: "Delete",
      hasSelection: true,
      modalOpen: false,
      editableTarget: false,
    })).toBe(true);
    expect(shouldDeleteSelectedWidget({
      key: "Backspace",
      hasSelection: true,
      modalOpen: false,
      editableTarget: false,
    })).toBe(false);
    expect(shouldDeleteSelectedWidget({
      key: "Delete",
      hasSelection: true,
      modalOpen: true,
      editableTarget: false,
    })).toBe(false);
    expect(shouldDeleteSelectedWidget({
      key: "Delete",
      hasSelection: true,
      modalOpen: false,
      editableTarget: true,
    })).toBe(false);
  });
});
