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

const verticalRect = { x: 0, y: 0, width: 100, height: 100 };

describe("Studio structure drag intent", async () => {
  const project = await loadGoldenProject();

  it("resolves before and after positions in a layout collection", () => {
    expect(
      resolveMoveTarget(project.document, catalog, "icon_secure", "image_hero", { x: 50, y: 1 }, verticalRect)
    ).toMatchObject({ valid: true, position: "before", target: { parentId: "stack_hero", beforeNodeId: "image_hero" } });
    expect(
      resolveMoveTarget(project.document, catalog, "heading_hero", "image_hero", { x: 50, y: 99 }, verticalRect)
    ).toMatchObject({ valid: true, position: "after", target: { parentId: "stack_hero", beforeNodeId: "icon_secure" } });
  });

  it("resolves compatible named slots and rejects cycles", () => {
    expect(
      resolveMoveTarget(project.document, catalog, "badge_popular", "pricing_card_business", { x: 50, y: 50 }, verticalRect)
    ).toMatchObject({ valid: true, position: "inside", target: { parentId: "pricing_card_business", slot: "badge" } });
    expect(
      resolveMoveTarget(project.document, catalog, "section_pricing", "grid_plans", { x: 50, y: 50 }, verticalRect)
    ).toEqual({ valid: false, reason: "selfOrDescendant" });
  });

  it("resolves visible insert positions and component slots", () => {
    expect(
      resolveInsertTarget(project.document, catalog, { kind: "component", componentRef: "Icon" }, "button_pro", { x: 50, y: 50 }, verticalRect)
    ).toMatchObject({
      valid: true, position: "inside", target: { parentId: "button_pro", slot: "leading" }
    });
    expect(
      resolveInsertTarget(project.document, catalog, { kind: "component", componentRef: "Text" }, "button_pro", { x: 50, y: 50 }, verticalRect)
    ).toMatchObject({
      valid: true, position: "inside", target: { parentId: "button_pro", slot: "content" }
    });
    expect(
      resolveInsertTarget(project.document, catalog, { kind: "component", componentRef: "Badge" }, "button_pro", { x: 50, y: 5 }, verticalRect)
    ).toMatchObject({
      valid: true, position: "before", target: { parentId: "pricing_card_pro", slot: "action", beforeNodeId: "button_pro" }
    });
  });

  it("uses the horizontal axis inside row and grid collections", () => {
    const cardRect = { x: 400, y: 0, width: 200, height: 300 };
    // Left half of the business card inserts before it, right half after it.
    expect(
      resolveMoveTarget(project.document, catalog, "pricing_card_starter", "pricing_card_business", { x: 410, y: 290 }, cardRect)
    ).toMatchObject({
      valid: true,
      position: "before",
      target: { parentId: "grid_plans", beforeNodeId: "pricing_card_business" }
    });
    expect(
      resolveMoveTarget(project.document, catalog, "pricing_card_starter", "pricing_card_business", { x: 590, y: 290 }, cardRect)
    ).toMatchObject({ valid: true, position: "after", target: { parentId: "grid_plans" } });
    // Inserts follow the same axis even near the vertical edges of the card.
    expect(
      resolveInsertTarget(project.document, catalog, { kind: "component", componentRef: "Card" }, "pricing_card_business", { x: 420, y: 10 }, cardRect)
    ).toMatchObject({
      valid: true,
      position: "before",
      target: { parentId: "grid_plans", beforeNodeId: "pricing_card_business" }
    });
  });

  it("prevents emptying a required source slot", () => {
    expect(
      resolveMoveTarget(project.document, catalog, "button_pro", "stack_faq", { x: 50, y: 50 }, verticalRect)
    ).toEqual({ valid: false, reason: "requiredSourceSlot" });
  });

  it("resolves keyboard sibling reordering", () => {
    expect(resolveSiblingMove(project.document, "text_hero", "up")).toMatchObject({ valid: true, target: { parentId: "stack_hero", beforeNodeId: "heading_hero" } });
    expect(resolveSiblingMove(project.document, "text_hero", "down")).toMatchObject({ valid: true, target: { parentId: "stack_hero", beforeNodeId: "icon_secure" } });
  });
});
