import type { ComponentChildren } from "preact";

interface Props {
  children: ComponentChildren;
  labelledBy?: string;
}

export function FullPageOverlay({ children, labelledBy }: Props) {
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
    display: grid;
    place-items: center;
    font: 14px/1.4 system-ui, sans-serif;
    color: CanvasText;
  }
`;
