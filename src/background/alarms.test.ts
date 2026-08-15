import { describe, expect, it } from "vitest";
import { ALARM_NAMES, isAlarmName } from "./alarms";

describe("alarm names", () => {
  it("recognizes every registered alarm and rejects unrelated names", () => {
    for (const name of Object.values(ALARM_NAMES)) expect(isAlarmName(name)).toBe(true);
    expect(isAlarmName("scrulk:unknown")).toBe(false);
  });
});
