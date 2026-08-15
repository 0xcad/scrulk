/**
 * Hostname utilities. All tracked-site matching in the extension MUST go
 * through `isTracked` so behavior stays consistent across background, popup,
 * and content scripts.
 */

export function hostnameOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Normalize a user-entered domain string. Lowercases, strips scheme/path,
 * strips a leading "www.". Returns null if the result is not a plausible
 * hostname (must contain a dot and only valid chars).
 */
export function normalizeDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  let host = trimmed;
  if (host.includes("://")) {
    try {
      host = new URL(host).hostname;
    } catch {
      return null;
    }
  } else {
    host = host.split("/")[0] ?? "";
  }

  if (host.startsWith("www.")) host = host.slice(4);

  if (!/^[a-z0-9.-]+$/.test(host)) return null;
  if (!host.includes(".")) return null;
  if (host.startsWith(".") || host.endsWith(".")) return null;
  if (host.includes("..")) return null;

  return host;
}

/**
 * A hostname is tracked if it matches a tracked domain exactly OR is a
 * subdomain of one. E.g. tracking "example.co.uk" matches
 * "blog.example.co.uk" but not "notexample.co.uk".
 */
export function isTracked(hostname: string, tracked: string[]): boolean {
  return findMatchingDomain(hostname, tracked) !== null;
}

/**
 * Returns the tracked domain (from `tracked`) that matches `hostname`, or
 * null if none. Used to key per-domain state (e.g. clock position) so a
 * subdomain shares its parent's state.
 */
export function findMatchingDomain(
  hostname: string,
  tracked: string[],
): string | null {
  const h = hostname.toLowerCase();
  const stripped = h.startsWith("www.") ? h.slice(4) : h;
  for (const d of tracked) {
    if (stripped === d) return d;
    if (stripped.endsWith("." + d)) return d;
  }
  return null;
}
