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

  it("reuses the Preview iframe when the active page changes", async () => {
    const [source, previewSource] = await Promise.all([
      readFile("apps/studio/src/canvas/CanvasViewport.tsx", "utf8"),
      readFile("apps/preview-host/src/PreviewApp.tsx", "utf8")
    ]);

    expect(source).toContain("key={frameAttempt}");
    expect(source).not.toContain("key={`${frameAttempt}:${session.activePageId");
    expect(source).toContain("previewContentHeights[contentHeightKey]");
    expect(source).not.toContain("setPreviewContentHeight(0)");
    expect(source).toContain("pendingDropsRef.current.clear()");
    expect(source).toContain("moveRequestsRef.current.clear()");
    expect(previewSource).toContain("const replacesDocument =");
    expect(previewSource).toContain("initialized: false");
    expect(previewSource).toContain('className="preview-pending"');
    expect(previewSource).toContain(
      "if (!replacesDocument && message.documentRevision < stateRef.current.revision) return;"
    );
  });
});
