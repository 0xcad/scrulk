import buttonStyles from "../shared/buttons.css?inline";

/**
 * Card and control CSS shared by full-screen content-script overlays.
 */
export const overlayBaseStyles = buttonStyles + `
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
  small { opacity: 0.65; }
`;
