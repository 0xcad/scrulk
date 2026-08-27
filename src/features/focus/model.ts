import type { FocusSession } from "../../shared/focusSessions";

interface TabRemovalInfo {
  isWindowClosing: boolean;
}

export function shouldDeleteFocusSessionForTabRemoval(
  session: FocusSession,
  tabId: number,
  removeInfo: TabRemovalInfo,
): boolean {
  return removeInfo.isWindowClosing &&
    session.closingAction === null &&
    session.tabs.length === 1 &&
    session.tabs[0]?.runtimeTabId === tabId;
}
