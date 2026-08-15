import { describe, expect, it } from "vitest";
import { runBackgroundTask } from "./taskQueue";

describe("runBackgroundTask", () => {
  it("serializes overlapping event work", async () => {
    const order: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = runBackgroundTask(async () => {
      order.push("first:start");
      await firstGate;
      order.push("first:end");
    });
    const second = runBackgroundTask(() => {
      order.push("second");
    });

    await Promise.resolve();
    expect(order).toEqual(["first:start"]);
    releaseFirst?.();
    await Promise.all([first, second]);
    expect(order).toEqual(["first:start", "first:end", "second"]);
  });

  it("continues after a failed task", async () => {
    const failure = runBackgroundTask(() => {
      throw new Error("expected");
    });
    const next = runBackgroundTask(() => "completed");

    await expect(failure).rejects.toThrow("expected");
    await expect(next).resolves.toBe("completed");
  });
});
