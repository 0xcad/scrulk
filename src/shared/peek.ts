export const PEEK_TOP_TOKEN_KEY = "scrulk:peek-top-token";
export const PEEK_FRAME_TOKEN_KEY = "scrulk:peek-frame-token";
export const PEEK_OPEN_EVENT = "scrulk:peek-open";
const PEEK_URL_HASH_PREFIX = "#__scrulk_peek__=";

export function makePeekUrl(url: string, token: string): string {
  const target = new URL(url);
  const payload = encodeURIComponent(JSON.stringify({
    token,
    originalHash: target.hash,
  }));
  target.hash = `${PEEK_URL_HASH_PREFIX.slice(1)}${payload}`;
  return target.href;
}

export function parsePeekUrl(
  value: string,
): { token: string; cleanUrl: string } | null {
  try {
    const url = new URL(value);
    if (!url.hash.startsWith(PEEK_URL_HASH_PREFIX)) return null;
    const parsed = JSON.parse(
      decodeURIComponent(url.hash.slice(PEEK_URL_HASH_PREFIX.length)),
    ) as { token?: unknown; originalHash?: unknown };
    if (
      typeof parsed.token !== "string" ||
      parsed.token.length === 0 ||
      typeof parsed.originalHash !== "string"
    ) {
      return null;
    }
    url.hash = parsed.originalHash;
    return { token: parsed.token, cleanUrl: url.href };
  } catch {
    return null;
  }
}

/** True when activating this link would load another document. */
export function isDocumentNavigationLink(
  href: string,
  currentUrl: string,
): boolean {
  const trimmed = href.trim();
  if (trimmed.toLowerCase().startsWith("javascript:")) return false;
  try {
    const target = new URL(trimmed, currentUrl);
    const current = new URL(currentUrl);
    if (
      target.origin === current.origin &&
      target.pathname === current.pathname &&
      target.search === current.search &&
      (target.hash !== "" || trimmed.includes("#"))
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
