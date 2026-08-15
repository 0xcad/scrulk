import type { AccessFlowPhase } from "../../../shared/types";

export const ACCESS_FLOW_PHASES = [
  "waiting",
  "waitingReady",
  "picking",
  "browsing",
  "resumePrompt",
  "break",
  "challenge",
  "popupLocked",
] as const satisfies readonly AccessFlowPhase[];

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function parseInteger(
  draft: string,
  nullable: boolean,
): ParseResult<number | null> {
  const trimmed = draft.trim();
  if (trimmed === "") {
    return nullable
      ? { ok: true, value: null }
      : { ok: false, error: "A value is required." };
  }

  const value = Number(trimmed);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return { ok: false, error: "Enter a finite whole number." };
  }
  return { ok: true, value };
}

export function parseNullableString(draft: string): string | null {
  return draft.trim() === "" ? null : draft;
}

export function parseExtensionTabs(
  draft: string,
): ParseResult<Record<string, string>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(draft);
  } catch {
    return { ok: false, error: "Enter a valid JSON object." };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Enter a JSON object." };
  }
  if (!Object.values(parsed).every((value) => typeof value === "string")) {
    return { ok: false, error: "Every tab ID must map to a string URL." };
  }

  return { ok: true, value: parsed as Record<string, string> };
}
