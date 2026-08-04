import { useEffect } from "preact/hooks";
import browser from "webextension-polyfill";
import { findMatchingDomain } from "../shared/domain";
import type { Message } from "../shared/messages";
import { PEEK_OPEN_EVENT, PEEK_TOP_TOKEN_KEY } from "../shared/peek";

interface Props {
  trackedSites: string[];
  enabled: boolean;
}

function linkFromEvent(event: MouseEvent): HTMLAnchorElement | HTMLAreaElement | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLAnchorElement | HTMLAreaElement>("a[href], area[href]");
}

export function PeekLinkInterceptor({ trackedSites, enabled }: Props) {
  useEffect(() => {
    if (!enabled) return;

    const intercept = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const link = linkFromEvent(event);
      if (!link) return;
      if (link instanceof HTMLAnchorElement && link.hasAttribute("download")) return;

      let dest: URL;
      try {
        dest = new URL(link.href, location.href);
      } catch {
        return;
      }
      if (dest.protocol !== "http:" && dest.protocol !== "https:") return;
      if (findMatchingDomain(dest.hostname, trackedSites) === null) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const token = crypto.randomUUID();
      try {
        sessionStorage.setItem(PEEK_TOP_TOKEN_KEY, token);
      } catch {
        // Storage can be unavailable on privacy-restricted pages.
      }
      const message: Message = {
        type: "peek:open",
        destUrl: dest.href,
        token,
      };
      void browser.runtime.sendMessage(message).then((accepted) => {
        if (accepted === true) {
          window.dispatchEvent(new CustomEvent(PEEK_OPEN_EVENT, { detail: token }));
          return;
        }
        try {
          sessionStorage.removeItem(PEEK_TOP_TOKEN_KEY);
        } catch {
          // Storage can be unavailable on privacy-restricted pages.
        }
        location.assign(dest.href);
      }).catch(() => {
        try {
          sessionStorage.removeItem(PEEK_TOP_TOKEN_KEY);
        } catch {
          // Storage can be unavailable on privacy-restricted pages.
        }
        location.assign(dest.href);
      });
    };

    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, [enabled, trackedSites]);

  return null;
}
