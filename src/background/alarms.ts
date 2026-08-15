export const ALARM_NAMES = {
  activityCheck: "scrulk:activity-check",
  allowance: "scrulk:allowance",
  breaktimeExtension: "scrulk:breaktime-extension",
  dayReset: "scrulk:day-reset",
  waiting: "scrulk:waiting",
} as const;

export type AlarmName = (typeof ALARM_NAMES)[keyof typeof ALARM_NAMES];

export function isAlarmName(name: string): name is AlarmName {
  return Object.values(ALARM_NAMES).some((candidate) => candidate === name);
}
