/**
 * Card and control CSS shared by full-screen content-script overlays.
 */
export const overlayBaseStyles = `
  :host { all: initial; }
  .card {
    background: Canvas;
    max-width: 380px;
    width: 380px;
    text-align: center;
    border: 1px dashed;
    padding: 32px 64px;
  }
  .card h2 { margin: 0 0 8px; font-size: 18px; font-family: monospace; text-transform: uppercase; }
  .card p { margin: 8px 0; }
  .big {
    font-size: 48px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    margin: 12px 0;
  }
  .buttons {
    display: flex;
    flex-flow: column;
    gap: 6px;
    justify-content: center;
    margin-top: 16px;
  }
  button {
    text-transform: lowercase;
    font: inherit;
    padding: 6px 14px;
    border: 1px solid #999;
    background: white;
    color: inherit;
    cursor: pointer;
  }
  button.primary {
    background: var(--primary);
    border-color: var(--primary);
    color: white;
    transition: 0.2s;
  }
  button.primary:hover {
    opacity: 0.9;
  }
  button.secondary {
    border: none;
    opacity: 0.7;
  }
  button.secondary:hover {
    text-decoration: underline;
  }
  button[data-disabled="true"] {
    cursor: not-allowed;
    opacity: 0.35;
  }
  button[data-disabled="true"]:hover {
    text-decoration: none;
  }
  button.hold {
    user-select: none;
    touch-action: none;
    width: 100%;
    margin: 10px 0;
  }
  button.hold:active {
    background: color-mix(in srgb, currentColor 12%, transparent);
  }
  small { opacity: 0.65; }
`;
