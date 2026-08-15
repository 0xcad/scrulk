import { useEffect } from "preact/hooks";

const PAGE_STYLE_ID = "scrulk-extension-frame-page-inset";
const FRAME_WIDTH_PX = 50;

/** Insets and desaturates the host page while keeping extension UI in color. */
export function ExtensionFrame() {
  useEffect(() => {
    document.getElementById(PAGE_STYLE_ID)?.remove();

    const style = document.createElement("style");
    style.id = PAGE_STYLE_ID;
    style.textContent = `
      html {
        box-sizing: border-box !important;
        padding: ${FRAME_WIDTH_PX}px !important;
      }

      body {
        filter: grayscale(100%) !important;
      }
    `;
    document.documentElement.appendChild(style);

    return () => style.remove();
  }, []);

  return (
    <>
      <style>{styles}</style>
      <div class="extension-frame" aria-hidden="true" />
    </>
  );
}

const styles = `
  .extension-frame {
    position: fixed;
    inset: 0;
    box-sizing: border-box;
    border: ${FRAME_WIDTH_PX}px solid var(--primary);
    pointer-events: none;
  }
`;
