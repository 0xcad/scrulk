import browser from "webextension-polyfill";
import { findMatchingDomain, hostnameOf } from "../shared/domain";
import {
  getGatewayState,
  getPeekSessions,
  getSettings,
  getTabBackMap,
  setPeekSessions,
  setTabBackMap,
} from "../shared/storage";
import type { PeekSession } from "../shared/types";
import { enforceExtensionNavigation } from "./breaktime";
import { gatewayUrl, isGatewayUnlocked } from "./gateway";
import { enforceTabLimit } from "./tabLimit";

const PEEK_RULE_ID_MIN = 1_500_000_000;
const PEEK_RULE_ID_MAX = 1_599_999_999;

function isValidToken(token: string): boolean {
  return token.length > 0 && token.length <= 200;
}

function sameOrigin(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

function firstAvailableRuleId(
  token: string,
  usedIds: Set<number>,
): number {
  let id = 0;
  for (let i = 0; i < token.length; i += 1) {
    id = (Math.imul(id, 31) + token.charCodeAt(i)) & 0x7fffffff;
  }
  id = PEEK_RULE_ID_MIN + (id % (PEEK_RULE_ID_MAX - PEEK_RULE_ID_MIN + 1));
  while (usedIds.has(id)) {
    id = id === PEEK_RULE_ID_MAX ? PEEK_RULE_ID_MIN : id + 1;
  }
  return id;
}

async function installFramingRule(
  tabId: number,
  domain: string,
  token: string,
): Promise<number | null> {
  try {
    const current = await browser.declarativeNetRequest.getSessionRules();
    const ruleId = firstAvailableRuleId(
      token,
      new Set(current.map((rule) => rule.id)),
    );
    await browser.declarativeNetRequest.updateSessionRules({
      addRules: [
        {
          id: ruleId,
          priority: 1,
          action: {
            type: "modifyHeaders",
            responseHeaders: [
              { header: "content-security-policy", operation: "remove" },
              { header: "content-security-policy-report-only", operation: "remove" },
              { header: "x-frame-options", operation: "remove" },
            ],
          },
          condition: {
            urlFilter: `||${domain}^`,
            resourceTypes: ["sub_frame"],
            tabIds: [tabId],
          },
        },
      ],
    });
    return ruleId;
  } catch {
    return null;
  }
}

async function removeFramingRule(ruleId: number): Promise<void> {
  await browser.declarativeNetRequest
    .updateSessionRules({ removeRuleIds: [ruleId] })
    .catch(() => null);
}

export async function getPeekSessionForTab(
  tabId: number,
): Promise<PeekSession | null> {
  const sessions = await getPeekSessions();
  return sessions[String(tabId)] ?? null;
}

async function deletePeekSession(tabId: number): Promise<PeekSession | null> {
  const sessions = await getPeekSessions();
  const key = String(tabId);
  const session = sessions[key];
  if (!session) return null;
  delete sessions[key];
  await setPeekSessions(sessions);
  await removeFramingRule(session.dnrRuleId);
  return session;
}

export async function handlePeekOpen(
  destUrl: string,
  token: string,
  senderTab: browser.Tabs.Tab | undefined,
): Promise<boolean> {
  const tabId = senderTab?.id;
  const sourceUrl = senderTab?.url;
  if (tabId === undefined || sourceUrl === undefined || !isValidToken(token)) {
    return false;
  }

  const settings = await getSettings();
  const sourceHost = hostnameOf(sourceUrl);
  const destHost = hostnameOf(destUrl);
  if (
    !settings.peekEnabled ||
    sourceHost === null ||
    destHost === null ||
    findMatchingDomain(sourceHost, settings.trackedSites) !== null
  ) {
    return false;
  }
  const domain = findMatchingDomain(destHost, settings.trackedSites);
  if (domain === null) return false;

  await deletePeekSession(tabId);
  const dnrRuleId = await installFramingRule(tabId, domain, token);
  if (dnrRuleId === null) return false;

  const sessions = await getPeekSessions();
  sessions[String(tabId)] = {
    token,
    sourceUrl,
    destUrl,
    domain,
    dnrRuleId,
  };
  try {
    await setPeekSessions(sessions);
  } catch {
    await removeFramingRule(dnrRuleId);
    return false;
  }

  const backMap = await getTabBackMap();
  backMap[String(tabId)] = sourceUrl;
  await setTabBackMap(backMap).catch(() => null);
  return true;
}

export async function handlePeekClose(
  token: string,
  senderTabId: number | undefined,
): Promise<boolean> {
  if (senderTabId === undefined) return false;
  const session = await getPeekSessionForTab(senderTabId);
  if (!session || session.token !== token) return false;
  await deletePeekSession(senderTabId);
  return true;
}

export async function handlePeekPromote(
  token: string,
  senderTabId: number | undefined,
): Promise<boolean> {
  if (senderTabId === undefined) return false;
  const session = await getPeekSessionForTab(senderTabId);
  if (!session || session.token !== token) return false;

  const gatewayState = await getGatewayState();
  const alreadyUnlocked = isGatewayUnlocked(
    gatewayState[session.domain],
    Date.now(),
  );
  const targetUrl = alreadyUnlocked
    ? session.destUrl
    : gatewayUrl(session.domain, session.destUrl, session.sourceUrl);

  try {
    await browser.tabs.update(senderTabId, { url: targetUrl });
  } catch {
    return false;
  }
  await deletePeekSession(senderTabId);

  if (alreadyUnlocked) {
    if (await enforceExtensionNavigation(senderTabId, session.destUrl)) return true;
    await enforceTabLimit(senderTabId, session.destUrl);
  }
  return true;
}

export async function handlePeekDestinationUpdate(
  token: string,
  destUrl: string,
  senderTabId: number | undefined,
): Promise<boolean> {
  if (senderTabId === undefined) return false;
  const sessions = await getPeekSessions();
  const key = String(senderTabId);
  const session = sessions[key];
  const host = hostnameOf(destUrl);
  const settings = await getSettings();
  if (
    !session ||
    session.token !== token ||
    host === null ||
    findMatchingDomain(host, settings.trackedSites) !== session.domain
  ) {
    return false;
  }
  if (session.destUrl !== destUrl) {
    sessions[key] = { ...session, destUrl };
    await setPeekSessions(sessions);
  }
  return true;
}

/** End Peek if its source tab navigates away. */
export async function syncPeekNavigation(
  tabId: number,
  url: string | undefined,
): Promise<boolean> {
  const session = await getPeekSessionForTab(tabId);
  if (!session) return false;
  if (sameOrigin(url, session.sourceUrl)) {
    if (url && url !== session.sourceUrl) {
      const sessions = await getPeekSessions();
      const current = sessions[String(tabId)];
      if (current?.token === session.token) {
        sessions[String(tabId)] = { ...current, sourceUrl: url };
        await setPeekSessions(sessions);
        const backMap = await getTabBackMap();
        backMap[String(tabId)] = url;
        await setTabBackMap(backMap).catch(() => null);
      }
    }
    return true;
  }
  await deletePeekSession(tabId);
  return false;
}

export async function removePeekSession(tabId: number): Promise<void> {
  await deletePeekSession(tabId);
}

export async function pruneInvalidPeekSessions(
  trackedSites: string[],
): Promise<void> {
  const [sessions, tabs] = await Promise.all([
    getPeekSessions(),
    browser.tabs.query({}),
  ]);
  const urls = new Map(
    tabs.flatMap((tab) =>
      tab.id === undefined ? [] : [[String(tab.id), tab.url] as const],
    ),
  );
  for (const [tabId, session] of Object.entries(sessions)) {
    const destHost = hostnameOf(session.destUrl);
    const sourceHost = hostnameOf(urls.get(tabId));
    if (
      !sameOrigin(urls.get(tabId), session.sourceUrl) ||
      sourceHost === null ||
      findMatchingDomain(sourceHost, trackedSites) !== null ||
      destHost === null ||
      findMatchingDomain(destHost, trackedSites) !== session.domain
    ) {
      await deletePeekSession(Number(tabId));
    }
  }
}

/** Browser restarts clear stale persisted sessions and their header rules. */
export async function reconcilePeekSessions(): Promise<void> {
  await setPeekSessions({});
  const rules = await browser.declarativeNetRequest.getSessionRules().catch(() => []);
  const peekRuleIds = rules
    .map((rule) => rule.id)
    .filter((id) => id >= PEEK_RULE_ID_MIN && id <= PEEK_RULE_ID_MAX);
  if (peekRuleIds.length > 0) {
    await browser.declarativeNetRequest
      .updateSessionRules({ removeRuleIds: peekRuleIds })
      .catch(() => null);
  }
}
