import { canvasToScreen, previewRectToScreen, screenToCanvas, zoomAtScreenPoint } from "../../apps/studio/src/canvas/coordinates.js";

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
});
