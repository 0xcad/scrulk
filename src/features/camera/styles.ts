export const cameraStyles = `
  :host { all: initial; }
  .camera {
    position: fixed;
    overflow: hidden;
    resize: horizontal;
    min-width: 160px;
    aspect-ratio: 4 / 3;
    pointer-events: auto;
    border: 2px solid rgba(255, 255, 255, 0.92);
    border-radius: 12px;
    background: #16161a;
    box-shadow: 0 3px 14px rgba(0, 0, 0, 0.42);
    touch-action: none;
  }
  .camera-content {
    position: absolute;
    inset: 0;
    cursor: grab;
    touch-action: none;
  }
  .camera-content:active { cursor: grabbing; }
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
`;
