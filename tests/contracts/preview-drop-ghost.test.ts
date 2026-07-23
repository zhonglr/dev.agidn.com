import { applyDropGhost, DROP_GHOST_ID_PREFIX } from "../../apps/preview-host/src/drop-ghost.js";
import { findNode, type PageNode } from "@agidn/document-schema";
import { loadGoldenProject } from "../helpers.js";

const ghostNode: PageNode = {
  id: "card_ghost",
  kind: "component",
  componentRef: "Card",
  slots: { content: [{ id: "text_ghost", kind: "component", componentRef: "Text", props: { content: "Ghost" } }] }
};

describe("applyDropGhost", () => {
  it("inserts the ghost at the exact collection index and retags ids", async () => {
    const project = await loadGoldenProject();
    const derived = applyDropGhost(project.document, {
      target: { parentId: "grid_plans", beforeNodeId: "pricing_card_pro" },
      node: ghostNode
    });
    const grid = findNode(derived, "grid_plans");
    expect(grid?.kind === "layout" ? grid.children.map(({ id }) => id) : []).toEqual([
      "pricing_card_starter",
      `${DROP_GHOST_ID_PREFIX}card_ghost`,
      "pricing_card_pro",
      "pricing_card_business"
    ]);
    const ghost = findNode(derived, `${DROP_GHOST_ID_PREFIX}card_ghost`);
    expect(ghost?.kind === "component" ? Object.keys(ghost.slots ?? {}) : []).toEqual(["content"]);
    expect(
      ghost?.kind === "component" ? ghost.slots?.content?.[0]?.id : undefined
    ).toBe(`${DROP_GHOST_ID_PREFIX}text_ghost`);
    // The source document is untouched.
    const originalGrid = findNode(project.document, "grid_plans");
    expect(originalGrid?.kind === "layout" ? originalGrid.children.map(({ id }) => id) : []).toEqual([
      "pricing_card_starter",
      "pricing_card_pro",
      "pricing_card_business"
    ]);
  });

  it("appends at the end when no beforeNodeId is given", async () => {
    const project = await loadGoldenProject();
    const derived = applyDropGhost(project.document, {
      target: { parentId: "stack_hero" },
      node: ghostNode
    });
    const stack = findNode(derived, "stack_hero");
    const ids = stack?.kind === "layout" ? stack.children.map(({ id }) => id) : [];
    expect(ids.at(-1)).toBe(`${DROP_GHOST_ID_PREFIX}card_ghost`);
  });

  it("inserts into named component slots", async () => {
    const project = await loadGoldenProject();
    const derived = applyDropGhost(project.document, {
      target: { parentId: "pricing_card_pro", slot: "badge" },
      node: ghostNode
    });
    const card = findNode(derived, "pricing_card_pro");
    const badge = card?.kind === "component" ? card.slots?.badge : undefined;
    expect(badge?.map(({ id }) => id)).toEqual(["badge_popular", `${DROP_GHOST_ID_PREFIX}card_ghost`]);
  });

  it("supports the document root and returns the original document for unknown parents", async () => {
    const project = await loadGoldenProject();
    const rooted = applyDropGhost(project.document, { target: { parentId: project.document.id }, node: ghostNode });
    expect(rooted.children.at(-1)?.id).toBe(`${DROP_GHOST_ID_PREFIX}card_ghost`);
    const missing = applyDropGhost(project.document, { target: { parentId: "missing_parent" }, node: ghostNode });
    expect(missing).toBe(project.document);
  });
});
