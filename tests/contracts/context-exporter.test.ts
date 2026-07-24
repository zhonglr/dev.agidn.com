import { createContextPackage } from "@agidn/context-exporter";
import { loadFoundationProject } from "../helpers.js";

describe("Schema Context Package", () => {
  it("exports the seven protocol files with a repeatable hash", async () => {
    const project = await loadFoundationProject();
    const before = structuredClone(project.document);
    const first = createContextPackage(project);
    const second = createContextPackage(project);

    expect(Object.keys(first.files).sort()).toEqual([
      "actions.json", "assets.json", "components.json", "constraints.json", "document.json", "manifest.json", "policies.json", "tokens.json"
    ]);
    expect(first.manifest.contentHash).toBe(second.manifest.contentHash);
    expect(first.files).toEqual(second.files);
    expect(project.document).toEqual(before);
  });

  it("selects only references used by the page", async () => {
    const project = await loadFoundationProject();
    const exported = createContextPackage(project);
    const components = JSON.parse(exported.files["components.json"]!) as { components: Record<string, unknown> };
    const actions = JSON.parse(exported.files["actions.json"]!) as { actions: Record<string, unknown> };
    const tokens = JSON.parse(exported.files["tokens.json"]!) as { tokens: Record<string, unknown> };

    expect(Object.keys(components.components)).toContain("Card");
    expect(Object.keys(components.components)).not.toContain("Image");
    expect(Object.keys(actions.actions)).toEqual(["navigation.openPage"]);
    expect(Object.keys(tokens.tokens)).toContain("spacing.md");
    expect(Object.keys(tokens.tokens)).not.toContain("shadow.card");
  });
});
