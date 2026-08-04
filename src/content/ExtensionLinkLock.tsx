import { useEffect } from "preact/hooks";
import { isDocumentNavigationLink } from "../shared/peek";

const STYLE_ID = "scrulk-extension-link-lock";
const LOCKED_CLASS = "scrulk-extension-link-locked";

/** Install page-level link locking and return a complete cleanup callback. */
export function installExtensionLinkLock(): () => void {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${LOCKED_CLASS} { cursor: not-allowed !important; }
  `;
  document.documentElement.appendChild(style);

  const syncLink = (link: HTMLAnchorElement | HTMLAreaElement) => {
    link.classList.toggle(
      LOCKED_CLASS,
      isDocumentNavigationLink(link.href, location.href),
    );
  };
  const syncTree = (root: ParentNode) => {
    if (root instanceof HTMLAnchorElement || root instanceof HTMLAreaElement) {
      syncLink(root);
    }
    root.querySelectorAll<HTMLAnchorElement | HTMLAreaElement>("a[href], area[href]")
      .forEach(syncLink);
  };
  syncTree(document);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        const target = mutation.target;
        if (target instanceof HTMLBaseElement) {
          syncTree(document);
          continue;
        }
        if (target instanceof HTMLAnchorElement || target instanceof HTMLAreaElement) {
          syncLink(target);
        }
        continue;
      }
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLBaseElement) syncTree(document);
        else if (node instanceof Element) syncTree(node);
      });
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["href"],
  });

  const preventLinkActivation = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest<HTMLAnchorElement | HTMLAreaElement>("a[href], area[href]");
    if (link && isDocumentNavigationLink(link.href, location.href)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  document.addEventListener("click", preventLinkActivation, true);
  document.addEventListener("auxclick", preventLinkActivation, true);

  return () => {
    observer.disconnect();
    document.querySelectorAll(`.${LOCKED_CLASS}`).forEach((link) => {
      link.classList.remove(LOCKED_CLASS);
    });
    style.remove();
    document.removeEventListener("click", preventLinkActivation, true);
    document.removeEventListener("auxclick", preventLinkActivation, true);
  };
}

/** Blocks document-navigation links while preserving hash/JavaScript controls. */
export function ExtensionLinkLock() {
  useEffect(() => installExtensionLinkLock(), []);
  return null;
}
