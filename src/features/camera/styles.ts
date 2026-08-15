export const cameraStyles = `
  :host { all: initial; }
  .camera {
    position: fixed;
    overflow: hidden;
    pointer-events: auto;
    border: 2px solid rgba(255, 255, 255, 0.92);
    border-radius: 12px;
    background: #16161a;
    box-shadow: 0 3px 14px rgba(0, 0, 0, 0.42);
    cursor: grab;
    touch-action: none;
  }
  .camera:active { cursor: grabbing; }
  video {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scaleX(-1);
    pointer-events: none;
  }
  .connecting {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(22, 22, 26, 0.82);
    color: white;
    font: 600 12px/1 system-ui, sans-serif;
  }
  .connecting.error {
    padding: 12px;
    box-sizing: border-box;
    color: #ffd4cf;
    text-align: center;
    line-height: 1.35;
  }
  .indicator {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #e74c3c;
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.35);
  }
  .camera:not(.ready) .indicator { opacity: 0.35; }
  .resize-handle {
    position: absolute;
    right: 0;
    bottom: 0;
    z-index: 2;
    width: 24px;
    height: 24px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background:
      linear-gradient(
        135deg,
        transparent 0 48%,
        rgba(255, 255, 255, 0.9) 49% 56%,
        transparent 57% 64%,
        rgba(255, 255, 255, 0.9) 65% 72%,
        transparent 73%
      );
    color: white;
    cursor: nwse-resize;
    touch-action: none;
  }
  .resize-handle:focus-visible {
    outline: 2px solid white;
    outline-offset: -4px;
  }
`;
