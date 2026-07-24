import { checkPageDocument } from "@agidn/document-schema";
import { readFile } from "node:fs/promises";
import { createWorkspacePageDocument } from "../../apps/studio/src/studio-session.js";

describe("Studio workspace pages", () => {
  it("creates independently identified, schema-valid page roots", () => {
    const first = createWorkspacePageDocument("Home");
    const second = createWorkspacePageDocument("Pricing");

    expect(first.id).not.toBe(second.id);
    expect(first.name).toBe("Home");
    expect(second.name).toBe("Pricing");
    expect(first.children[0]).toMatchObject({
      kind: "layout",
      layout: "stack",
      role: "main"
    });
    expect(checkPageDocument(first).valid).toBe(true);
    expect(checkPageDocument(second).valid).toBe(true);
  });

  it("renders active pages directly without iframe or cross-window state", async () => {
    const source = await readFile(
      "apps/studio/src/canvas/CanvasViewport.tsx",
      "utf8"
    );

    expect(source).toContain("<PageRenderer");
    expect(source).toContain('className="canvas-preview"');
    expect(source).toContain("contentHeights[contentHeightKey]");
    expect(source).not.toContain("<iframe");
    expect(source).not.toContain("postMessage");
    expect(source).not.toContain("VITE_PREVIEW_URL");
  });
});
