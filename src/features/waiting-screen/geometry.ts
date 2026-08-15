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
): WidgetGeometry {
  return {
    ...geometry,
    width: Math.max(1, geometry.width),
    height: Math.max(1, geometry.height),
    rotation: geometry.rotation,
  };
}

export function toPixelGeometry(
  geometry: WidgetGeometry,
  viewportWidth: number,
  viewportHeight: number,
): PixelGeometry {
  const safe = safeGeometry(geometry);
  const width = safe.width;
  const height = safe.height;
  return {
    left: viewportWidth / 2 + safe.offsetX - width / 2,
    top: viewportHeight / 2 + safe.offsetY - height / 2,
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
    offsetX: pixel.left + pixel.width / 2 - viewportWidth / 2,
    offsetY: pixel.top + pixel.height / 2 - viewportHeight / 2,
    width: pixel.width,
    height: pixel.height,
    rotation: pixel.rotation,
  });
}
