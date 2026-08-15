export const STREAK_THRESHOLD_MS = 20_000;

export const ACCESS_FLOW_PHASES = [
  "waitingConfirmation",
  "waiting",
  "waitingReady",
  "picking",
  "browsing",
  "resumePrompt",
  "break",
  "challenge",
  "popupLocked",
] as const;

export type AccessFlowPhase = (typeof ACCESS_FLOW_PHASES)[number];

interface NumberFieldDefinition {
  kind: "number";
  nullable: false;
  defaultValue: number;
  hint: string;
}

interface NullableNumberFieldDefinition {
  kind: "number";
  nullable: true;
  defaultValue: number | null;
  hint: string;
}

interface BooleanFieldDefinition {
  kind: "boolean";
  defaultValue: boolean;
  hint: string;
}

interface NullableStringFieldDefinition {
  kind: "string";
  nullable: true;
  defaultValue: string | null;
  hint: string;
}

interface PhaseFieldDefinition {
  kind: "phase";
  defaultValue: AccessFlowPhase;
  hint: string;
}

interface StringRecordFieldDefinition {
  kind: "extensionTabs";
  defaultValue: Record<string, string>;
  hint: string;
}

function numberField(defaultValue: number, hint: string): NumberFieldDefinition {
  return { kind: "number", nullable: false, defaultValue, hint };
}

function nullableNumberField(
  defaultValue: number | null,
  hint: string,
): NullableNumberFieldDefinition {
  return { kind: "number", nullable: true, defaultValue, hint };
}

function booleanField(defaultValue: boolean, hint: string): BooleanFieldDefinition {
  return { kind: "boolean", defaultValue, hint };
}

function nullableStringField(
  defaultValue: string | null,
  hint: string,
): NullableStringFieldDefinition {
  return { kind: "string", nullable: true, defaultValue, hint };
}

function phaseField(
  defaultValue: AccessFlowPhase,
  hint: string,
): PhaseFieldDefinition {
  return { kind: "phase", defaultValue, hint };
}

function stringRecordField(
  defaultValue: Record<string, string>,
  hint: string,
): StringRecordFieldDefinition {
  return { kind: "extensionTabs", defaultValue, hint };
}

/**
 * Canonical persisted DayState schema. Field types, defaults, debug controls,
 * and short semantic hints are kept together so no parallel inventory drifts.
 */
export const DAY_STATE_FIELDS = {
  wakeDayStart: numberField(
    0,
    "Epoch milliseconds for the current wake-day boundary.",
  ),
  totalMs: numberField(
    0,
    "Closed tracked-usage segments, in milliseconds.",
  ),
  activeSince: nullableNumberField(
    null,
    "Epoch milliseconds for the open tracked segment, or blank for null.",
  ),
  allSitesMs: numberField(
    0,
    "Closed all-sites usage segments, in milliseconds.",
  ),
  allSitesActiveSince: nullableNumberField(
    null,
    "Epoch milliseconds for the open all-sites segment, or blank for null.",
  ),
  activityCheckpointAt: nullableNumberField(
    null,
    "Latest activity checkpoint in epoch milliseconds, or blank for null.",
  ),
  accessFlowPhase: phaseField(
    "waitingConfirmation",
    "Global tracked-site access phase.",
  ),
  waitingMs: numberField(
    0,
    "Closed focused-wait segments, in milliseconds.",
  ),
  waitingActiveSince: nullableNumberField(
    null,
    "Epoch milliseconds for the open waiting segment, or blank for null.",
  ),
  waitingCheckpointAt: nullableNumberField(
    null,
    "Latest waiting checkpoint in epoch milliseconds, or blank for null.",
  ),
  waitingPageFocused: booleanField(
    false,
    "Whether the waiting extension page last reported focus.",
  ),
  waitingTimerElapsed: booleanField(
    false,
    "Whether the focused waiting requirement has elapsed this wake-day.",
  ),
  allowanceMs: nullableNumberField(
    null,
    "Chosen tracked-usage allowance in milliseconds, or blank for null.",
  ),
  allowanceStartTotalMs: nullableNumberField(
    null,
    "Tracked-total allowance baseline, or blank for null.",
  ),
  breakOpenedAt: nullableNumberField(
    null,
    "Break prompt start in epoch milliseconds, or blank for null.",
  ),
  breaktimeExtensionExpiresAt: nullableNumberField(
    null,
    "Extension deadline in epoch milliseconds, or blank for null.",
  ),
  breaktimeExtensionUsed: booleanField(
    false,
    "Whether the current break cycle used its extension.",
  ),
  breaktimeExtensionTabs: stringRecordField(
    {},
    "JSON object mapping eligible tab IDs to their original URLs.",
  ),
  tabLimitWarning: booleanField(
    false,
    "Whether a tab-limit rejection is waiting for the popup.",
  ),
  surveyFilledFor: nullableStringField(
    null,
    "Submitted wake-day key, or blank for null.",
  ),
  breaktimeShownToday: booleanField(
    false,
    "Whether a break alert has appeared this wake-day.",
  ),
  breaktimeChallengeCompletedToday: booleanField(
    false,
    "Whether a breaktime challenge has been completed this wake-day.",
  ),
  popupDoneToday: booleanField(
    false,
    "Whether the popup-originated lock was used this wake-day.",
  ),
  surveyContinueAllowed: booleanField(
    false,
    "Whether the popup-originated lock was overridden.",
  ),
};

type FieldValue<T> = T extends { defaultValue: infer Value } ? Value : never;

/** Persisted running tally for the current wake-day. */
export type DayState = {
  -readonly [Field in keyof typeof DAY_STATE_FIELDS]: FieldValue<
    (typeof DAY_STATE_FIELDS)[Field]
  >;
};

export type DayStateField = keyof DayState;
export type DayStateFieldDefinition =
  (typeof DAY_STATE_FIELDS)[DayStateField];

function defaultsFrom<
  Definitions extends Record<string, { defaultValue: unknown }>,
>(definitions: Definitions): {
  -readonly [Field in keyof Definitions]: Definitions[Field]["defaultValue"];
} {
  return Object.fromEntries(
    Object.entries(definitions).map(([field, definition]) => [
      field,
      definition.defaultValue,
    ]),
  ) as {
    -readonly [Field in keyof Definitions]: Definitions[Field]["defaultValue"];
  };
}

export const DEFAULT_DAY_STATE: DayState = defaultsFrom(DAY_STATE_FIELDS);

export const DAY_STATE_KEY = "dayState" as const;

export function effectiveMs(state: DayState, now: number): number {
  if (state.activeSince === null) return state.totalMs;
  return state.totalMs + Math.max(0, now - state.activeSince);
}

export function effectiveWaitingMs(state: DayState, now: number): number {
  return state.waitingMs +
    (state.waitingActiveSince === null
      ? 0
      : Math.max(0, now - state.waitingActiveSince));
}

export function remainingAllowanceMs(state: DayState, now: number): number {
  if (state.allowanceMs === null || state.allowanceStartTotalMs === null) return 0;
  return Math.max(
    0,
    state.allowanceMs - (effectiveMs(state, now) - state.allowanceStartTotalMs),
  );
}

export function effectiveAllSitesMs(state: DayState, now: number): number {
  if (state.allSitesActiveSince === null) return state.allSitesMs;
  return state.allSitesMs + Math.max(0, now - state.allSitesActiveSince);
}

export function isUsageStreakDay(state: DayState, now: number): boolean {
  return effectiveMs(state, now) >= STREAK_THRESHOLD_MS;
}

export function liveUsageStreakCount(
  completedStreak: number,
  state: DayState,
  now: number,
): number {
  return completedStreak + (isUsageStreakDay(state, now) ? 1 : 0);
}
