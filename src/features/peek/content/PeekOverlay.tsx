import { useEffect, useRef, useState } from "preact/hooks";
import { findMatchingDomain } from "../../../shared/domain";

interface Props {
  trackedSites: string[];
}

export const PEEK_FRAME_NAME = "scrulk-peek-frame";
export const PEEK_CLOSE_MESSAGE = "scrulk:peek:close";
const PAGE_STYLE_ID = "scrulk-peek-page-lock";

type LinkElement = HTMLAnchorElement | HTMLAreaElement;

function linkFromEvent(event: MouseEvent): LinkElement | null {
  for (const target of event.composedPath()) {
    if (!(target instanceof Element)) continue;
    const link = target.closest<LinkElement>("a[href], area[href]");
    if (link) return link;
  }
  return null;
}

export function peekUrlForHref(
  href: string,
  baseUrl: string,
  trackedSites: string[],
): string | null {
  try {
    const url = new URL(href, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return findMatchingDomain(url.hostname, trackedSites) === null
      ? null
      : url.href;
  } catch {
    return null;
  }
}

function peekUrlForLink(
  link: LinkElement,
  trackedSites: string[],
): string | null {
  if (link.hasAttribute("download")) return null;
  return peekUrlForHref(link.href, document.baseURI, trackedSites);
}

export function PeekOverlay({ trackedSites }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
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
      const nextUrl = peekUrlForLink(link, trackedSites);
      if (nextUrl === null) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setUrl(nextUrl);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [trackedSites]);

  useEffect(() => {
    if (url === null) return;
    const pageStyle = document.createElement("style");
    pageStyle.id = PAGE_STYLE_ID;
    pageStyle.textContent = `
      html, body {
        overflow: hidden !important;
        overscroll-behavior: none !important;
      }
    `;
    document.documentElement.appendChild(pageStyle);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setUrl(null);
    };
    const onMessage = (event: MessageEvent) => {
      if (
        event.data === PEEK_CLOSE_MESSAGE &&
        event.source === frameRef.current?.contentWindow
      ) {
        setUrl(null);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("message", onMessage);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("message", onMessage);
      pageStyle.remove();
    };
  }, [url]);

  if (url === null) return null;

  return (
    <div
      class="peek-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) setUrl(null);
      }}
    >
      <div class="peek-dialog" role="dialog" aria-modal="true" aria-label="Tracked site preview">
        <iframe ref={frameRef} name={PEEK_FRAME_NAME} src={url} title="Tracked site preview" />
        <div class="peek-controls">
          <button type="button" title="Close preview" aria-label="Close preview" onClick={() => setUrl(null)}>
            ×
          </button>
          <button
            type="button"
            title="Open tracked site"
            aria-label="Open tracked site"
            onClick={() => window.location.assign(url)}
          >
            →
          </button>
        </div>
      </div>
      <style>{styles}</style>
    </div>
  );
}

const styles = `
  .peek-backdrop {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    box-sizing: border-box;
    padding: 32px 76px 32px 32px;
    background: rgb(0 0 0 / 42%);
    pointer-events: auto;
  }

  .peek-dialog {
    position: relative;
    width: min(76vw, 960px);
    height: min(78vh, 720px);
    min-width: 0;
    min-height: 0;
    border-radius: 12px;
    background: white;
    box-shadow: 0 20px 64px rgb(0 0 0 / 36%);
  }

  .peek-dialog iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    border-radius: inherit;
    background: white;
  }

  .peek-controls {
    position: absolute;
    top: 0;
    left: calc(100% + 12px);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .peek-controls button {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: var(--primary);
    color: white;
    font: 700 24px/1 system-ui, sans-serif;
    cursor: pointer;
    box-shadow: 0 3px 12px rgb(0 0 0 / 22%);
  }

  .peek-controls button:hover {
    filter: brightness(0.94);
  }

  .peek-controls button:focus-visible {
    outline: 3px solid white;
    outline-offset: 2px;
  }

  @media (max-width: 700px) {
    .peek-backdrop {
      padding: 56px 4vw 4vh;
    }

    .peek-dialog {
      width: 92vw;
      height: 82vh;
    }

    .peek-controls {
      top: auto;
      right: 0;
      bottom: calc(100% + 8px);
      left: auto;
      flex-direction: row;
    }
  }
`;
