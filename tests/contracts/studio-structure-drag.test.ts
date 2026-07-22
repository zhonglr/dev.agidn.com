import componentSource from "../../examples/golden-pricing/components.json" with { type: "json" };
import type { GetCatalogResponse } from "@agidn/api-protocol";
import { resolveInsertTarget, resolveMoveTarget, resolveSiblingMove } from "../../apps/studio/src/structure-drag.js";
import { loadGoldenProject } from "../helpers.js";

const catalog = {
  protocolVersion: "1.0.0", ok: true,
  components: componentSource,
  tokens: { version: "1.0.0", tokens: {} },
  policies: {}, actions: { version: "1.0.0", actions: {} }, constraints: {}
} as unknown as GetCatalogResponse;

describe("Studio structure drag intent", async () => {
  const project = await loadGoldenProject();

  it("resolves before and after positions in a layout collection", () => {
    expect(resolveMoveTarget(project.document, catalog, "icon_secure", "image_hero", 1, { y: 0, height: 100 })).toMatchObject({ valid: true, position: "before", target: { parentId: "stack_hero", beforeNodeId: "image_hero" } });
    expect(resolveMoveTarget(project.document, catalog, "heading_hero", "image_hero", 99, { y: 0, height: 100 })).toMatchObject({ valid: true, position: "after", target: { parentId: "stack_hero", beforeNodeId: "icon_secure" } });
  });

  it("resolves compatible named slots and rejects cycles", () => {
    expect(resolveMoveTarget(project.document, catalog, "badge_popular", "pricing_card_business", 50, { y: 0, height: 100 })).toMatchObject({ valid: true, position: "inside", target: { parentId: "pricing_card_business", slot: "badge" } });
    expect(resolveMoveTarget(project.document, catalog, "section_pricing", "grid_plans", 50, { y: 0, height: 100 })).toMatchObject({ valid: false, reason: expect.stringContaining("descendants") });
  });

  it("resolves visible insert positions and component slots", () => {
    expect(resolveInsertTarget(project.document, catalog, { kind: "component", componentRef: "Icon" }, "button_pro", 50, { y: 0, height: 100 })).toMatchObject({
      valid: true, position: "inside", target: { parentId: "button_pro", slot: "leading" }
    });
    expect(resolveInsertTarget(project.document, catalog, { kind: "component", componentRef: "Text" }, "button_pro", 50, { y: 0, height: 100 })).toMatchObject({
      valid: true, position: "inside", target: { parentId: "button_pro", slot: "content" }
    });
    expect(resolveInsertTarget(project.document, catalog, { kind: "component", componentRef: "Badge" }, "button_pro", 5, { y: 0, height: 100 })).toMatchObject({
      valid: true, position: "before", target: { parentId: "pricing_card_pro", slot: "action", beforeNodeId: "button_pro" }
    });
  });

  it("prevents emptying a required source slot", () => {
    expect(resolveMoveTarget(project.document, catalog, "button_pro", "stack_faq", 50, { y: 0, height: 100 })).toMatchObject({ valid: false, reason: expect.stringContaining("requires") });
  });

  it("resolves keyboard sibling reordering", () => {
    expect(resolveSiblingMove(project.document, "text_hero", "up")).toMatchObject({ valid: true, target: { parentId: "stack_hero", beforeNodeId: "heading_hero" } });
    expect(resolveSiblingMove(project.document, "text_hero", "down")).toMatchObject({ valid: true, target: { parentId: "stack_hero", beforeNodeId: "icon_secure" } });
  });
});
