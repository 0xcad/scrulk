import buttonStyles from "../shared/buttons.css?inline";
import surfaceStyles from "../shared/surfaces.css?inline";

/**
 * Card and control CSS shared by full-screen content-script overlays.
 */
export const overlayBaseStyles = buttonStyles + surfaceStyles + `
  :host { all: initial; }
  .content-card {
    max-width: 470px;
    width: 470px;
    text-align: center;
    padding: 32px 64px;
    gap: 14px;
  }
  .big {
    font-size: 48px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    margin: 12px 0;
  }
  small { opacity: 0.65; }
`;
