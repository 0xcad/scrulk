import { useEffect } from "preact/hooks";

const STYLE_ID = "scrulk-extension-link-lock";
const LOCKED_CLASS = "scrulk-extension-link-locked";

type LinkElement = HTMLAnchorElement | HTMLAreaElement;

export function isDocumentNavigationHref(
  rawHref: string,
  baseUrl: string,
  currentUrl: string,
): boolean {
  if (rawHref.trim().toLowerCase().startsWith("javascript:")) return false;
  try {
    const target = new URL(rawHref, baseUrl);
    const current = new URL(currentUrl);
    const sameDocumentHash =
      target.hash !== "" &&
      target.origin === current.origin &&
      target.pathname === current.pathname &&
      target.search === current.search;
    return !sameDocumentHash;
  } catch {
    return true;
  }
}

function shouldLock(link: LinkElement): boolean {
  if (!link.hasAttribute("href")) return false;
  const rawHref = link.getAttribute("href")?.trim() ?? "";
  return isDocumentNavigationHref(rawHref, document.baseURI, location.href);
}

function linkFromEvent(event: Event): LinkElement | null {
  for (const target of event.composedPath()) {
    if (!(target instanceof Element)) continue;
    const link = target.closest<LinkElement>("a[href], area[href]");
    if (link) return link;
  }
  return null;
}

/**
 * Blocks document-navigation links in the current document. JavaScript-backed
 * controls and same-document hash links remain usable.
 */
export function installExtensionLinkLock(): () => void {
  const lockedLinks = new Set<LinkElement>();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    a.${LOCKED_CLASS}, area.${LOCKED_CLASS} {
      cursor: not-allowed !important;
    }
  `;
  document.documentElement.appendChild(style);

  const updateLink = (link: LinkElement) => {
    const locked = shouldLock(link);
    link.classList.toggle(LOCKED_CLASS, locked);
    if (locked) lockedLinks.add(link);
    else lockedLinks.delete(link);
  };

  const updateTree = (root: ParentNode) => {
    if (root instanceof HTMLAnchorElement || root instanceof HTMLAreaElement) {
      if (root.hasAttribute("href")) updateLink(root);
    }
    root.querySelectorAll<LinkElement>("a[href], area[href]").forEach(updateLink);
  };

  updateTree(document);

  const observer = new MutationObserver((mutations) => {
    let baseChanged = false;
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        if (mutation.target instanceof HTMLBaseElement) {
          baseChanged = true;
        } else if (
          mutation.target instanceof HTMLAnchorElement ||
          mutation.target instanceof HTMLAreaElement
        ) {
          updateLink(mutation.target);
        }
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLBaseElement) baseChanged = true;
        if (node instanceof Element) updateTree(node);
      }
    }
    if (baseChanged) updateTree(document);
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["href"],
    childList: true,
    subtree: true,
  });

  const preventLinkActivation = (event: Event) => {
    const link = linkFromEvent(event);
    if (!link) return;
    updateLink(link);
    if (!shouldLock(link)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  document.addEventListener("click", preventLinkActivation, true);
  document.addEventListener("auxclick", preventLinkActivation, true);

  return () => {
    document.removeEventListener("click", preventLinkActivation, true);
    document.removeEventListener("auxclick", preventLinkActivation, true);
    observer.disconnect();
    style.remove();
    lockedLinks.forEach((link) => link.classList.remove(LOCKED_CLASS));
    lockedLinks.clear();
  };
}

/** Preact wrapper for the imperative link lock. */
export function ExtensionLinkLock() {
  useEffect(() => installExtensionLinkLock(), []);

  return null;
}
