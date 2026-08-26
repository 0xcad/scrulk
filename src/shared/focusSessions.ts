export const FOCUS_SESSIONS_KEY = "focusSessions" as const;

export interface FocusTabSnapshot {
  id: string;
  runtimeTabId: number | null;
  url: string;
  title: string;
  index: number;
  active: boolean;
  pinned: boolean;
  lastAllowedUrl: string | null;
}

export type FocusSessionStatus = "active" | "inactive";
export type FocusClosingAction = "ending" | "deleting" | null;

export interface FocusSession {
  id: string;
  name: string | null;
  status: FocusSessionStatus;
  runtimeWindowId: number | null;
  browserSessionId: string | null;
  tabs: FocusTabSnapshot[];
  stashedTabs: FocusTabSnapshot[];
  createdAt: number;
  updatedAt: number;
  closingAction: FocusClosingAction;
}

export interface FocusSessionsState {
  sessions: FocusSession[];
}

export const DEFAULT_FOCUS_SESSIONS: FocusSessionsState = { sessions: [] };

export function normalizeFocusSessions(raw: unknown): FocusSessionsState {
  if (raw === null || typeof raw !== "object") return DEFAULT_FOCUS_SESSIONS;
  const sessions = (raw as { sessions?: unknown }).sessions;
  if (!Array.isArray(sessions)) return DEFAULT_FOCUS_SESSIONS;
  return {
    sessions: sessions.filter(isFocusSession).map((session) => ({
      ...session,
      tabs: session.tabs.map(normalizeTab),
      stashedTabs: session.stashedTabs.map(normalizeTab),
      browserSessionId: typeof session.browserSessionId === "string"
        ? session.browserSessionId
        : null,
      closingAction: session.closingAction === "ending" || session.closingAction === "deleting"
        ? session.closingAction
        : null,
    })),
  };
}

function isFocusSession(value: unknown): value is FocusSession {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<FocusSession>;
  return typeof candidate.id === "string" &&
    (candidate.name === null || typeof candidate.name === "string") &&
    (candidate.status === "active" || candidate.status === "inactive") &&
    (candidate.runtimeWindowId === null || typeof candidate.runtimeWindowId === "number") &&
    Array.isArray(candidate.tabs) && Array.isArray(candidate.stashedTabs) &&
    typeof candidate.createdAt === "number" && typeof candidate.updatedAt === "number";
}

function normalizeTab(value: unknown): FocusTabSnapshot {
  const tab = value as Partial<FocusTabSnapshot>;
  return {
    id: typeof tab.id === "string" ? tab.id : crypto.randomUUID(),
    runtimeTabId: typeof tab.runtimeTabId === "number" ? tab.runtimeTabId : null,
    url: typeof tab.url === "string" ? tab.url : "about:blank",
    title: typeof tab.title === "string" ? tab.title : "",
    index: typeof tab.index === "number" ? tab.index : 0,
    active: tab.active === true,
    pinned: tab.pinned === true,
    lastAllowedUrl: typeof tab.lastAllowedUrl === "string" ? tab.lastAllowedUrl : null,
  };
}
