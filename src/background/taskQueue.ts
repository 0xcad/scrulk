let taskTail: Promise<void> = Promise.resolve();

/**
 * Browser events can overlap while the service worker is awake. Serialize
 * their storage read-modify-write work so a slower event cannot restore stale
 * DayState over a transition committed by a newer event.
 */
export function runBackgroundTask<Result>(
  task: () => Result | PromiseLike<Result>,
): Promise<Result> {
  const result = taskTail.then(
    () => task(),
    () => task(),
  );
  taskTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
