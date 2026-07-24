import { applyCommand } from "@agidn/command-engine";
import {
  createLayoutNode,
  LAYOUT_KINDS
} from "../../apps/studio/src/layout-node-factory.js";
import { loadFoundationProject } from "../helpers.js";

describe("Layout node factory", () => {
  it("creates all six layout primitives with valid stable defaults", async () => {
    const project = await loadFoundationProject();
    const targets = {
      section: project.document.id,
      container: "section_foundation",
      stack: "stack_foundation",
      row: "stack_foundation",
      grid: "stack_foundation",
      overlay: "stack_foundation"
    } as const;

    expect(LAYOUT_KINDS).toEqual([
      "section",
      "container",
      "stack",
      "row",
      "grid",
      "overlay"
    ]);
    for (const layout of LAYOUT_KINDS) {
      const node = createLayoutNode(layout);
      const result = applyCommand(
        project.document,
        {
          protocolVersion: "2.0.0",
          commandId: `insert_layout_${layout}`,
          type: "node.insert",
          targetParentId: targets[layout],
          node
        },
        project
      );

      expect(
        result.accepted,
        `${layout}: ${result.accepted ? "" : result.violations.map(({ code }) => code).join(", ")}`
      ).toBe(true);
    }
  });

  it("provides complete responsive and overlay metadata", () => {
    expect(createLayoutNode("grid")).toMatchObject({
      layout: "grid",
      gapToken: "spacing.md",
      columns: { mobile: 1, tablet: 2, desktop: 3 }
    });
    expect(createLayoutNode("overlay")).toMatchObject({
      layout: "overlay",
      overlay: {
        purpose: "content-overlay",
        anchor: "center",
        boundary: "parent",
        offsetToken: "spacing.sm",
        collision: "shift"
      }
    });
  });

  it("rejects structural layouts outside their legal parent boundary", async () => {
    const project = await loadFoundationProject();
    const containerAtPageRoot = applyCommand(
      project.document,
      {
        protocolVersion: "2.0.0",
        commandId: "insert_illegal_root_container",
        type: "node.insert",
        targetParentId: project.document.id,
        node: createLayoutNode("container")
      },
      project
    );
    const sectionInCard = applyCommand(
      project.document,
      {
        protocolVersion: "2.0.0",
        commandId: "insert_illegal_card_section",
        type: "node.insert",
        targetParentId: "card_foundation",
        targetSlot: "content",
        node: createLayoutNode("section")
      },
      project
    );

    expect(containerAtPageRoot).toMatchObject({
      accepted: false,
      violations: [{ code: "INVALID_LAYOUT_NESTING" }]
    });
    expect(sectionInCard).toMatchObject({
      accepted: false,
      violations: [{ code: "INVALID_LAYOUT_NESTING" }]
    });
  });
});
