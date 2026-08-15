import browser from "webextension-polyfill";
import type { Settings } from "../../shared/settings";

const PEEK_FRAME_RULE_ID = 10_001;

/** Keep tracked-site iframe headers permissive while Peek is enabled. */
export async function syncPeekFrameRule(settings: Settings): Promise<void> {
  const addRules: browser.DeclarativeNetRequest.Rule[] = [];
  if (settings.peekEnabled && settings.trackedSites.length > 0) {
    addRules.push({
      id: PEEK_FRAME_RULE_ID,
      priority: 1,
      action: {
        type: "modifyHeaders",
        responseHeaders: [
          { header: "content-security-policy", operation: "remove" },
          { header: "x-frame-options", operation: "remove" },
        ],
      },
      condition: {
        requestDomains: settings.trackedSites,
        resourceTypes: ["sub_frame"],
      },
    });
  }

  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [PEEK_FRAME_RULE_ID],
    addRules,
  });
}
