import { useEffect } from "preact/hooks";

const STYLE_ID = "scrulk-extension-link-lock";

/** Blocks every link while the user finishes work during a break extension. */
export function ExtensionLinkLock() {
  useEffect(() => {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      a[href], area[href] { cursor: not-allowed !important; }
    `;
    document.documentElement.appendChild(style);

    const preventLinkActivation = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement | HTMLAreaElement>("a[href], area[href]");
      // javascript: links commonly power in-page controls (for example,
      // javascript:void(0)). Let those controls run; any attempted tracked
      // navigation is still caught by the background extension guard.
      if (link && !link.href.trim().toLowerCase().startsWith("javascript:")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    document.addEventListener("click", preventLinkActivation, true);
    document.addEventListener("auxclick", preventLinkActivation, true);
    return () => {
      style.remove();
      document.removeEventListener("click", preventLinkActivation, true);
      document.removeEventListener("auxclick", preventLinkActivation, true);
    };
  }, []);

  return null;
}
