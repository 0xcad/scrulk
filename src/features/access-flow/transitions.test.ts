import { describe, expect, it } from "vitest";
import { DEFAULT_DAY_STATE, type AccessFlowPhase } from "../../shared/dayState";
import {
  reduceAccessFlow,
  shouldInterruptAllowance,
  type AccessFlowEvent,
} from "./transitions";

const phases: AccessFlowPhase[] = [
  "waiting",
  "waitingReady",
  "picking",
  "browsing",
  "resumePrompt",
  "break",
  "challenge",
  "popupLocked",
];

describe("reduceAccessFlow", () => {
  it.each([
    ["waitCompleted", "waitingReady", "picking"],
    ["allowanceResumed", "resumePrompt", "browsing"],
    ["allowanceInterrupted", "browsing", "resumePrompt"],
    ["challengeCompleted", "challenge", "picking"],
    ["surveyContinued", "popupLocked", "picking"],
  ] as const)("applies %s only from %s", (type, from, to) => {
    const event = { type } as AccessFlowEvent;
    for (const phase of phases) {
      const state = {
        ...DEFAULT_DAY_STATE,
        accessFlowPhase: phase,
        popupDoneToday: type === "surveyContinued",
      };
      const next = reduceAccessFlow(state, event);
      expect(next.accessFlowPhase).toBe(phase === from ? to : phase);
    }
  });

  it("sets and resets the complete allowance cycle together", () => {
    const picked = reduceAccessFlow(
      { ...DEFAULT_DAY_STATE, accessFlowPhase: "picking" },
      { type: "allowanceChosen", allowanceMs: 120_000, startTotalMs: 4_000 },
    );
    expect(picked).toMatchObject({
      accessFlowPhase: "browsing",
      allowanceMs: 120_000,
      allowanceStartTotalMs: 4_000,
      breaktimeExtensionUsed: false,
      breaktimeExtensionTabs: {},
    });
    const done = reduceAccessFlow(picked, { type: "breaktimeDone" });
    expect(done).toMatchObject({
      accessFlowPhase: "picking",
      allowanceMs: null,
      allowanceStartTotalMs: null,
      breaktimeExtensionExpiresAt: null,
      breaktimeExtensionUsed: false,
      breaktimeExtensionTabs: {},
    });
  });

  it("enforces the break gate and one extension per cycle", () => {
    const breakState = {
      ...DEFAULT_DAY_STATE,
      accessFlowPhase: "break" as const,
      breakOpenedAt: 10_000,
    };
    expect(reduceAccessFlow(breakState, {
      type: "challengeStarted", now: 39_999, gateMs: 30_000,
    })).toBe(breakState);
    expect(reduceAccessFlow(breakState, {
      type: "challengeStarted", now: 40_000, gateMs: 30_000,
    }).accessFlowPhase).toBe("challenge");

    const extended = reduceAccessFlow(breakState, {
      type: "extensionStarted",
      expiresAt: 100_000,
      tabs: { "1": "https://example.com" },
    });
    expect(extended).toMatchObject({
      accessFlowPhase: "browsing",
      breaktimeExtensionUsed: true,
      breaktimeExtensionExpiresAt: 100_000,
    });
    expect(reduceAccessFlow(
      { ...breakState, breaktimeExtensionUsed: true },
      { type: "extensionStarted", expiresAt: 100_000, tabs: {} },
    ).accessFlowPhase).toBe("break");
  });
});

describe("shouldInterruptAllowance", () => {
  const usedAllowance = {
    ...DEFAULT_DAY_STATE,
    accessFlowPhase: "browsing" as const,
    totalMs: 2_000,
    allowanceMs: 60_000,
    allowanceStartTotalMs: 1_000,
  };

  it("prompts after the last tracked tab closes with used time remaining", () => {
    expect(shouldInterruptAllowance(usedAllowance, false, 2_000)).toBe(true);
  });

  it("does not prompt while another tracked tab remains", () => {
    expect(shouldInterruptAllowance(usedAllowance, true, 2_000)).toBe(false);
  });

  it("does not prompt before the allowance has been used", () => {
    expect(shouldInterruptAllowance({
      ...usedAllowance,
      totalMs: usedAllowance.allowanceStartTotalMs,
    }, false, 2_000)).toBe(false);
  });
});
