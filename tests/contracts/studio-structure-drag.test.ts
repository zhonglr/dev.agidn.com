import componentSource from "../../examples/foundation/components.json" with { type: "json" };
import type { GetCatalogResponse } from "@agidn/api-protocol";
import {
  resolveInsertSourcesTarget,
  resolveInsertTarget,
  resolveMoveTarget,
  resolveSiblingMove
} from "../../apps/studio/src/structure-drag.js";
import { loadFoundationProject } from "../helpers.js";

const catalog = {
  protocolVersion: "2.0.0", ok: true,
  components: componentSource,
  tokens: { version: "2.0.0", tokens: {} },
  policies: {}, actions: { version: "2.0.0", actions: {} }, constraints: {}
} as unknown as GetCatalogResponse;

const verticalRect = { x: 0, y: 0, width: 100, height: 100 };

describe("Studio structure drag intent", async () => {
  const project = await loadFoundationProject();

  it("resolves before and after positions in a layout collection", () => {
    expect(
      resolveMoveTarget(project.document, catalog, "divider_foundation", "text_foundation", { x: 50, y: 1 }, verticalRect)
    ).toMatchObject({ valid: true, position: "before", target: { parentId: "stack_foundation", beforeNodeId: "text_foundation" } });
    expect(
      resolveMoveTarget(project.document, catalog, "heading_foundation", "text_foundation", { x: 50, y: 99 }, verticalRect)
    ).toMatchObject({ valid: true, position: "after", target: { parentId: "stack_foundation", beforeNodeId: "divider_foundation" } });
  });

  it("resolves compatible named slots and rejects cycles", () => {
    expect(
      resolveMoveTarget(project.document, catalog, "divider_foundation", "card_foundation", { x: 50, y: 50 }, verticalRect)
    ).toMatchObject({ valid: true, position: "inside", target: { parentId: "card_foundation", slot: "content" } });
    expect(
      resolveMoveTarget(project.document, catalog, "section_foundation", "grid_foundation", { x: 50, y: 50 }, verticalRect)
    ).toEqual({ valid: false, reason: "selfOrDescendant" });
  });

  it("resolves visible insert positions and component slots", () => {
    expect(
      resolveInsertTarget(project.document, catalog, { kind: "component", componentRef: "Icon" }, "button_foundation", { x: 50, y: 50 }, verticalRect)
    ).toMatchObject({
      valid: true, position: "inside", target: { parentId: "button_foundation", slot: "leadingIcon" }
    });
    expect(
      resolveInsertTarget(project.document, catalog, { kind: "component", componentRef: "Badge" }, "button_foundation", { x: 50, y: 5 }, verticalRect)
    ).toMatchObject({
      valid: true,
      position: "before",
      target: { parentId: "card_foundation", slot: "content", beforeNodeId: "button_foundation" }
    });
  });

  it("validates every root of a multi-node Pattern against one target", () => {
    expect(
      resolveInsertSourcesTarget(
        project.document,
        catalog,
        [
          { kind: "component", componentRef: "Icon" },
          { kind: "component", componentRef: "Icon" }
        ],
        "button_foundation",
        { x: 50, y: 50 },
        verticalRect
      )
    ).toEqual({ valid: false, reason: "maxItemsExceeded" });
    expect(
      resolveInsertSourcesTarget(
        project.document,
        catalog,
        [
          { kind: "component", componentRef: "Text" },
          { kind: "layout", layout: "grid" }
        ],
        "text_foundation",
        { x: 50, y: 99 },
        verticalRect
      )
    ).toMatchObject({
      valid: true,
      target: { parentId: "stack_foundation" }
    });
  });

  it("resolves layout insertion with layout-specific nesting rules", () => {
    expect(
      resolveInsertTarget(
        project.document,
        catalog,
        { kind: "layout", layout: "grid" },
        "text_foundation",
        { x: 50, y: 50 },
        verticalRect
      )
    ).toMatchObject({
      valid: true,
      position: "after",
      target: { parentId: "stack_foundation" }
    });
    expect(
      resolveInsertTarget(
        project.document,
        catalog,
        { kind: "layout", layout: "container" },
        "text_foundation",
        { x: 50, y: 50 },
        verticalRect
      )
    ).toMatchObject({
      valid: true,
      target: { parentId: "section_foundation" }
    });
    expect(
      resolveInsertTarget(
        project.document,
        catalog,
        { kind: "layout", layout: "section" },
        "text_foundation",
        { x: 50, y: 50 },
        verticalRect
      )
    ).toMatchObject({
      valid: true,
      target: { parentId: "page_foundation" }
    });
    expect(
      resolveInsertTarget(
        project.document,
        catalog,
        { kind: "layout", layout: "section" },
        "card_foundation",
        { x: 50, y: 50 },
        verticalRect
      )
    ).toMatchObject({
      valid: true,
      target: { parentId: "page_foundation" }
    });
  });

  it("uses the horizontal axis inside row and grid collections", () => {
    const cardRect = { x: 400, y: 0, width: 200, height: 300 };
    expect(
      resolveMoveTarget(project.document, catalog, "divider_foundation", "text_grid_b", { x: 410, y: 290 }, cardRect)
    ).toMatchObject({
      valid: true,
      position: "before",
      target: { parentId: "grid_foundation", beforeNodeId: "text_grid_b" }
    });
    expect(
      resolveMoveTarget(project.document, catalog, "divider_foundation", "text_grid_b", { x: 590, y: 290 }, cardRect)
    ).toMatchObject({ valid: true, position: "after", target: { parentId: "grid_foundation" } });
    // Inserts follow the same axis even near the vertical edges of the card.
    expect(
      resolveInsertTarget(project.document, catalog, { kind: "component", componentRef: "Card" }, "text_grid_b", { x: 420, y: 10 }, cardRect)
    ).toMatchObject({
      valid: true,
      position: "before",
      target: { parentId: "grid_foundation", beforeNodeId: "text_grid_b" }
    });
  });

  it("falls back to the closest legal parent slot", () => {
    expect(
      resolveInsertTarget(project.document, catalog, { kind: "component", componentRef: "Badge" }, "button_foundation", { x: 50, y: 50 }, verticalRect)
    ).toMatchObject({
      valid: true,
      position: "after",
      target: { parentId: "card_foundation", slot: "content" }
    });
  });

  it("resolves keyboard sibling reordering", () => {
    expect(resolveSiblingMove(project.document, "text_foundation", "up")).toMatchObject({ valid: true, target: { parentId: "stack_foundation", beforeNodeId: "heading_foundation" } });
    expect(resolveSiblingMove(project.document, "text_foundation", "down")).toMatchObject({ valid: true, target: { parentId: "stack_foundation", beforeNodeId: "card_foundation" } });
  });
});
