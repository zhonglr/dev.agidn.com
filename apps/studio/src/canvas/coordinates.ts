export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  width: number;
  height: number;
}

export interface CanvasTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export function screenToCanvas(point: Point, transform: CanvasTransform): Point {
  return {
    x: (point.x - transform.offsetX) / transform.scale,
    y: (point.y - transform.offsetY) / transform.scale
  };
}

export function canvasToScreen(point: Point, transform: CanvasTransform): Point {
  return {
    x: transform.offsetX + point.x * transform.scale,
    y: transform.offsetY + point.y * transform.scale
  };
}

export function previewRectToScreen(rect: Rect, transform: CanvasTransform): Rect {
  const origin = canvasToScreen(rect, transform);
  return {
    ...origin,
    width: rect.width * transform.scale,
    height: rect.height * transform.scale
  };
}

export function centerRectInViewportIfNeeded(
  rect: Rect,
  transform: CanvasTransform,
  viewport: ViewportSize,
  padding = 32
): CanvasTransform {
  const screenRect = previewRectToScreen(rect, transform);
  const isVisible =
    screenRect.x >= padding &&
    screenRect.y >= padding &&
    screenRect.x + screenRect.width <= viewport.width - padding &&
    screenRect.y + screenRect.height <= viewport.height - padding;

  if (isVisible) return transform;

  return {
    ...transform,
    offsetX: viewport.width / 2 - (rect.x + rect.width / 2) * transform.scale,
    offsetY: viewport.height / 2 - (rect.y + rect.height / 2) * transform.scale
  };
}

export function zoomAtScreenPoint(transform: CanvasTransform, screenPoint: Point, nextScale: number): CanvasTransform {
  const canvasPoint = screenToCanvas(screenPoint, transform);
  return {
    scale: nextScale,
    offsetX: screenPoint.x - canvasPoint.x * nextScale,
    offsetY: screenPoint.y - canvasPoint.y * nextScale
  };
}
