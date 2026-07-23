import {
  canvasToScreen,
  centerRectInViewportIfNeeded,
  previewRectToScreen,
  screenToCanvas,
  zoomAtScreenPoint
} from "../../apps/studio/src/canvas/coordinates.js";

describe("Canvas coordinate service", () => {
  it("round-trips points between canvas and screen coordinates", () => {
    const transform = { scale: 0.75, offsetX: 120, offsetY: 64 };
    const canvasPoint = { x: 320, y: 180 };
    expect(screenToCanvas(canvasToScreen(canvasPoint, transform), transform)).toEqual(canvasPoint);
  });

  it("keeps the canvas point under the cursor stable while zooming", () => {
    const cursor = { x: 480, y: 320 };
    const before = { scale: 0.5, offsetX: 80, offsetY: 40 };
    const canvasPoint = screenToCanvas(cursor, before);
    const after = zoomAtScreenPoint(before, cursor, 1.25);
    expect(canvasToScreen(canvasPoint, after)).toEqual(cursor);
  });

  it("maps preview rectangles through the same transform", () => {
    expect(previewRectToScreen(
      { x: 10, y: 20, width: 100, height: 50 },
      { scale: 2, offsetX: 5, offsetY: 7 }
    )).toEqual({ x: 25, y: 47, width: 200, height: 100 });
  });

  it.each([0.5, 1, 1.5, 2])(
    "maps a drag indicator exactly once at %sx zoom",
    (scale) => {
      const rect = { x: 80, y: 120, width: 240, height: 96 };
      const screenRect = previewRectToScreen(rect, {
        scale,
        offsetX: 36,
        offsetY: 28
      });

      expect(screenRect).toEqual({
        x: 36 + rect.x * scale,
        y: 28 + rect.y * scale,
        width: rect.width * scale,
        height: rect.height * scale
      });
    }
  );

  it("keeps the canvas still when the selected rectangle is already visible", () => {
    const transform = { scale: 0.75, offsetX: 100, offsetY: 60 };

    expect(centerRectInViewportIfNeeded(
      { x: 100, y: 80, width: 200, height: 120 },
      transform,
      { width: 800, height: 600 }
    )).toBe(transform);
  });

  it("centers a selected rectangle that is outside the viewport without changing zoom", () => {
    expect(centerRectInViewportIfNeeded(
      { x: 1600, y: 1200, width: 200, height: 100 },
      { scale: 0.5, offsetX: 20, offsetY: 30 },
      { width: 800, height: 600 }
    )).toEqual({
      scale: 0.5,
      offsetX: -450,
      offsetY: -325
    });
  });
});
