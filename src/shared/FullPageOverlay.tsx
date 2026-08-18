import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";

interface Props {
  children: ComponentChildren;
  labelledBy?: string;
}

export function FullPageOverlay({ children, labelledBy }: Props) {
  useEffect(() => {
    const pageStyle = document.createElement("style");
    pageStyle.textContent = `
      html, body {
        overflow: hidden !important;
        overscroll-behavior: none !important;
      }
    `;
    document.documentElement.appendChild(pageStyle);
    return () => pageStyle.remove();
  }, []);

  return (
    <div
      class="scrulk-full-page-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      {children}
    </div>
  );
}

export const fullPageOverlayStyles = `
  .scrulk-full-page-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    pointer-events: auto;
    background: color-mix(in srgb, Canvas 88%, transparent);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='7' height='7' shape-rendering='crispEdges'%3E%3Crect x='0' y='0' width='1' height='1' fill='rgba(255,87,51,0.25)'/%3E%3Crect x='4' y='0' width='1' height='1' fill='rgba(255,87,51,0.25)'/%3E%3Crect x='2' y='2' width='1' height='1' fill='rgba(255,87,51,0.25)'/%3E%3Crect x='0' y='4' width='1' height='1' fill='rgba(255,87,51,0.25)'/%3E%3Crect x='4' y='4' width='1' height='1' fill='rgba(255,87,51,0.25)'/%3E%3C/svg%3E");
    background-size: 25px 25px;
    display: grid;
    place-items: center;
    font: 14px/1.4 system-ui, sans-serif;
    color: CanvasText;
  }
`;
