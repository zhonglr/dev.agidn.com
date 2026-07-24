import {
  applyDropGhost,
  DROP_GHOST_ID_PREFIX,
  sameDropGhost
} from "../../apps/studio/src/canvas/drop-ghost.js";
import { findNode, type PageNode } from "@agidn/document-schema";
import { loadFoundationProject } from "../helpers.js";

const ghostNode: PageNode = {
  id: "card_ghost",
  kind: "component",
  componentRef: "Card",
  slots: { content: [{ id: "text_ghost", kind: "component", componentRef: "Text", props: { content: "Ghost" } }] }
};

describe("Canvas drop ghost", () => {
  it("recognizes repeated projections without comparing cloned node objects", () => {
    const projection = {
      target: { parentId: "grid_foundation", beforeNodeId: "text_grid_b" },
      nodes: [ghostNode],
      moveSourceNodeId: "text_grid_a"
    };
    expect(sameDropGhost(structuredClone(projection), projection)).toBe(true);
    expect(
      sameDropGhost(
        { ...projection, target: { ...projection.target, beforeNodeId: "text_grid_a" } },
        projection
      )
    ).toBe(false);
  });

  it("inserts the ghost at the exact collection index and retags ids", async () => {
    const project = await loadFoundationProject();
    const derived = applyDropGhost(project.document, {
      target: { parentId: "grid_foundation", beforeNodeId: "text_grid_b" },
      nodes: [ghostNode]
    });
    const grid = findNode(derived, "grid_foundation");
    expect(grid?.kind === "layout" ? grid.children.map(({ id }) => id) : []).toEqual([
      "text_grid_a",
      `${DROP_GHOST_ID_PREFIX}card_ghost`,
      "text_grid_b"
    ]);
    const ghost = findNode(derived, `${DROP_GHOST_ID_PREFIX}card_ghost`);
    expect(ghost?.kind === "component" ? Object.keys(ghost.slots ?? {}) : []).toEqual(["content"]);
    expect(ghost?.kind === "component" ? ghost.slots?.content?.[0]?.id : undefined).toBe(
      `${DROP_GHOST_ID_PREFIX}text_ghost`
    );
    // The source document is untouched.
    const originalGrid = findNode(project.document, "grid_foundation");
    expect(originalGrid?.kind === "layout" ? originalGrid.children.map(({ id }) => id) : []).toEqual([
      "text_grid_a",
      "text_grid_b"
    ]);
  });

  it("appends at the end when no beforeNodeId is given", async () => {
    const project = await loadFoundationProject();
    const derived = applyDropGhost(project.document, {
      target: { parentId: "stack_foundation" },
      nodes: [ghostNode]
    });
    const stack = findNode(derived, "stack_foundation");
    const ids = stack?.kind === "layout" ? stack.children.map(({ id }) => id) : [];
    expect(ids.at(-1)).toBe(`${DROP_GHOST_ID_PREFIX}card_ghost`);
  });

  it("projects multiple Pattern roots in source order", async () => {
    const project = await loadFoundationProject();
    const secondNode: PageNode = {
      id: "text_ghost_second",
      kind: "component",
      componentRef: "Text",
      props: { text: "Second ghost" }
    };
    const derived = applyDropGhost(project.document, {
      target: {
        parentId: "grid_foundation",
        beforeNodeId: "text_grid_b"
      },
      nodes: [ghostNode, secondNode]
    });
    const grid = findNode(derived, "grid_foundation");
    expect(
      grid?.kind === "layout"
        ? grid.children.map(({ id }) => id)
        : []
    ).toEqual([
      "text_grid_a",
      `${DROP_GHOST_ID_PREFIX}card_ghost`,
      `${DROP_GHOST_ID_PREFIX}text_ghost_second`,
      "text_grid_b"
    ]);
  });

  it("inserts into named component slots", async () => {
    const project = await loadFoundationProject();
    const derived = applyDropGhost(project.document, {
      target: { parentId: "card_foundation", slot: "content" },
      nodes: [ghostNode]
    });
    const card = findNode(derived, "card_foundation");
    const content = card?.kind === "component" ? card.slots?.content : undefined;
    expect(content?.map(({ id }) => id)).toEqual(["button_foundation", `${DROP_GHOST_ID_PREFIX}card_ghost`]);
  });

  it("supports the document root and returns the original document for unknown parents", async () => {
    const project = await loadFoundationProject();
    const rooted = applyDropGhost(project.document, { target: { parentId: project.document.id }, nodes: [ghostNode] });
    expect(rooted.children.at(-1)?.id).toBe(`${DROP_GHOST_ID_PREFIX}card_ghost`);
    const missing = applyDropGhost(project.document, { target: { parentId: "missing_parent" }, nodes: [ghostNode] });
    expect(missing).toBe(project.document);
  });
});
