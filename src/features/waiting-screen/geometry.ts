import type { WidgetGeometry } from "./model";

export interface PixelGeometry {
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
}

export function safeGeometry(
  geometry: WidgetGeometry,
  viewportWidth: number,
  viewportHeight: number,
): WidgetGeometry {
  if (viewportWidth <= 0 || viewportHeight <= 0) return geometry;
  let width = Math.min(1, Math.max(0.02, geometry.width));
  let height = Math.min(1, Math.max(0.02, geometry.height));
  const radians = geometry.rotation * Math.PI / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const extent = () => ({
    x: (cos * width * viewportWidth + sin * height * viewportHeight) / 2,
    y: (sin * width * viewportWidth + cos * height * viewportHeight) / 2,
  });
  let half = extent();
  const scale = Math.min(
    1,
    viewportWidth / (half.x * 2 || viewportWidth),
    viewportHeight / (half.y * 2 || viewportHeight),
  );
  width *= scale;
  height *= scale;
  half = extent();
  const centerX = clamp(geometry.x * viewportWidth, half.x, viewportWidth - half.x);
  const centerY = clamp(geometry.y * viewportHeight, half.y, viewportHeight - half.y);
  return {
    x: centerX / viewportWidth,
    y: centerY / viewportHeight,
    width,
    height,
    rotation: geometry.rotation,
  };
}

export function toPixelGeometry(
  geometry: WidgetGeometry,
  viewportWidth: number,
  viewportHeight: number,
): PixelGeometry {
  const safe = safeGeometry(geometry, viewportWidth, viewportHeight);
  const width = safe.width * viewportWidth;
  const height = safe.height * viewportHeight;
  return {
    left: safe.x * viewportWidth - width / 2,
    top: safe.y * viewportHeight - height / 2,
    width,
    height,
    rotation: safe.rotation,
  };
}

export function fromPixelGeometry(
  pixel: PixelGeometry,
  viewportWidth: number,
  viewportHeight: number,
): WidgetGeometry {
  return safeGeometry({
    x: (pixel.left + pixel.width / 2) / viewportWidth,
    y: (pixel.top + pixel.height / 2) / viewportHeight,
    width: pixel.width / viewportWidth,
    height: pixel.height / viewportHeight,
    rotation: pixel.rotation,
  }, viewportWidth, viewportHeight);
}

function clamp(value: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}
