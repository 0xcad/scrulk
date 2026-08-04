import { render } from "preact";
import browser from "webextension-polyfill";
import { findMatchingDomain } from "../shared/domain";
import type { Message } from "../shared/messages";
import {
  parsePeekUrl,
  PEEK_FRAME_TOKEN_KEY,
  PEEK_OPEN_EVENT,
  PEEK_TOP_TOKEN_KEY,
} from "../shared/peek";
import {
  getPeekSessions,
  getSettings,
  onPeekSessionsChange,
  onSettingsChange,
} from "../shared/storage";
import type { PeekSession } from "../shared/types";
import { installExtensionLinkLock } from "./ExtensionLinkLock";
import { Root } from "./Root";

const HOST_ID = "scrulk-root";

function readSessionToken(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionToken(key: string, token: string | null): void {
  try {
    if (token === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, token);
  } catch {
    // Storage can be unavailable on privacy-restricted pages.
  }
}

async function initializePeekSubframe(): Promise<void> {
  const marker = parsePeekUrl(location.href);
  if (marker) {
    try {
      history.replaceState(history.state, "", marker.cleanUrl);
    } catch {
      // The clean URL is cosmetic; the frame still works with its marker.
    }
    writeSessionToken(PEEK_FRAME_TOKEN_KEY, marker.token);
  }
  const token = marker?.token ?? readSessionToken(PEEK_FRAME_TOKEN_KEY);
  if (!token) return;

  const sessions = await getPeekSessions();
  const session = Object.values(sessions).find((entry) => entry.token === token);
  if (!session) {
    writeSessionToken(PEEK_FRAME_TOKEN_KEY, null);
    return;
  }

  const cleanUrl = parsePeekUrl(location.href)?.cleanUrl ?? location.href;
  const message: Message = {
    type: "peek:updateDest",
    token,
    destUrl: cleanUrl,
  };
  void browser.runtime.sendMessage(message).catch(() => null);

  const removeLock = installExtensionLinkLock();
  const unsubscribe = onPeekSessionsChange((next) => {
    if (Object.values(next).some((entry) => entry.token === token)) return;
    unsubscribe();
    removeLock();
    writeSessionToken(PEEK_FRAME_TOKEN_KEY, null);
  });
}

let mountedFor: string | undefined = undefined;
let shadowRoot: ShadowRoot | null = null;
let peekToken = readSessionToken(PEEK_TOP_TOKEN_KEY);

async function evaluateTopFrame(): Promise<void> {
  peekToken ??= readSessionToken(PEEK_TOP_TOKEN_KEY);
  const [{ trackedSites }, peekSessions] = await Promise.all([
    getSettings(),
    getPeekSessions(),
  ]);
  const matched = findMatchingDomain(location.hostname, trackedSites);
  let peekSession: PeekSession | null = null;
  if (peekToken) {
    peekSession = Object.values(peekSessions).find(
      (session) => session.token === peekToken,
    ) ?? null;
    if (peekSession === null) {
      writeSessionToken(PEEK_TOP_TOKEN_KEY, null);
      peekToken = null;
    }
  }
  const mountKey = `${matched ?? "-"}:${peekSession?.token ?? "-"}:${peekSession?.destUrl ?? "-"}`;
  if (mountKey !== mountedFor) {
    mount(matched, peekSession, mountKey);
  }
}

function mount(
  matched: string | null,
  peekSession: PeekSession | null,
  mountKey: string,
): void {
  if (!shadowRoot) {
    const host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText =
      "all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;";
    document.documentElement.appendChild(host);
    shadowRoot = host.attachShadow({ mode: "closed" });
  }
  mountedFor = mountKey;
  render(<Root matchedDomain={matched} peekSession={peekSession} />, shadowRoot);
}

if (window.top !== window) {
  void initializePeekSubframe();
} else {
  void evaluateTopFrame();
  onSettingsChange(() => {
    void evaluateTopFrame();
  });
  onPeekSessionsChange(() => {
    void evaluateTopFrame();
  });
  window.addEventListener(PEEK_OPEN_EVENT, (event) => {
    const token = (event as CustomEvent<unknown>).detail;
    if (typeof token !== "string") return;
    peekToken = token;
    void evaluateTopFrame();
  });
}
