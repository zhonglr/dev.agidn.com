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

export function zoomAtScreenPoint(transform: CanvasTransform, screenPoint: Point, nextScale: number): CanvasTransform {
  const canvasPoint = screenToCanvas(screenPoint, transform);
  return {
    scale: nextScale,
    offsetX: screenPoint.x - canvasPoint.x * nextScale,
    offsetY: screenPoint.y - canvasPoint.y * nextScale
  };
}
