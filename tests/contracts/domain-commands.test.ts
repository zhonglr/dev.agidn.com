import { applyCommand, type DocumentCommand, type PatchOperation } from "@agidn/command-engine";
import { findNode, type PageDocument } from "@agidn/document-schema";
import { loadGoldenProject } from "../helpers.js";

interface CommandCase {
  name: string;
  command: DocumentCommand;
  expectedOperation: PatchOperation;
  assertDocument: (document: PageDocument) => void;
}

describe("domain commands", async () => {
  const project = await loadGoldenProject();
  const cases: CommandCase[] = [
    {
      name: "sets a registered component token reference",
      command: {
        commandId: "cmd_set_token",
        protocolVersion: "1.0.0",
        type: "node.setToken",
        nodeId: "heading_hero",
        property: "textColor",
        tokenRef: "color.action.primary"
      },
      expectedOperation: { op: "node.update", nodeId: "heading_hero", changes: { tokens: { textColor: "color.action.primary" } } },
      assertDocument: (document) => expect(findNode(document, "heading_hero")).toMatchObject({ tokens: { textColor: "color.action.primary" } })
    },
    {
      name: "sets a complete Grid responsive policy",
      command: {
        commandId: "cmd_set_responsive",
        protocolVersion: "1.0.0",
        type: "node.setResponsivePolicy",
        nodeId: "grid_plans",
        columns: { mobile: 1, tablet: 2, desktop: 4 }
      },
      expectedOperation: { op: "node.update", nodeId: "grid_plans", changes: { columns: { mobile: 1, tablet: 2, desktop: 4 } } },
      assertDocument: (document) => expect(findNode(document, "grid_plans")).toMatchObject({ columns: { mobile: 1, tablet: 2, desktop: 4 } })
    },
    {
      name: "sets a semantic role",
      command: {
        commandId: "cmd_set_role",
        protocolVersion: "1.0.0",
        type: "node.setRole",
        nodeId: "text_hero",
        role: "pricing-summary"
      },
      expectedOperation: { op: "node.update", nodeId: "text_hero", changes: { role: "pricing-summary" } },
      assertDocument: (document) => expect(findNode(document, "text_hero")).toMatchObject({ role: "pricing-summary" })
    },
    {
      name: "moves a node between compatible slots",
      command: {
        commandId: "cmd_move_badge",
        protocolVersion: "1.0.0",
        type: "node.move",
        nodeId: "badge_popular",
        targetParentId: "pricing_card_business",
        targetSlot: "badge"
      },
      expectedOperation: { op: "node.move", nodeId: "badge_popular", targetParentId: "pricing_card_business", targetSlot: "badge" },
      assertDocument: (document) => {
        expect(findNode(document, "pricing_card_pro")).not.toHaveProperty("slots.badge.0");
        expect(findNode(document, "pricing_card_business")).toHaveProperty("slots.badge.0.id", "badge_popular");
      }
    },
    {
      name: "removes an optional node",
      command: {
        commandId: "cmd_remove_badge",
        protocolVersion: "1.0.0",
        type: "node.remove",
        nodeId: "badge_popular"
      },
      expectedOperation: { op: "node.remove", nodeId: "badge_popular" },
      assertDocument: (document) => expect(findNode(document, "badge_popular")).toBeUndefined()
    }
  ];

  it.each(cases)("$name", ({ command, expectedOperation, assertDocument }) => {
    const result = applyCommand(project.document, command, project);
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.patch.operations).toEqual([expectedOperation]);
    assertDocument(result.document);
    expect(result.document).not.toBe(project.document);
  });

  it("rejects removing required slot content and preserves the original document", () => {
    const result = applyCommand(project.document, {
      commandId: "cmd_remove_required_action",
      protocolVersion: "1.0.0",
      type: "node.remove",
      nodeId: "button_pro"
    }, project);

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.violations.map(({ code }) => code)).toContain("REQUIRED_SLOT_MISSING");
    expect(findNode(result.document, "button_pro")).toBeDefined();
  });

  it("rejects moving a node into its own descendant", () => {
    const result = applyCommand(project.document, {
      commandId: "cmd_move_cycle",
      protocolVersion: "1.0.0",
      type: "node.move",
      nodeId: "section_pricing",
      targetParentId: "grid_plans"
    }, project);

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.violations[0]?.code).toBe("INVALID_LAYOUT_NESTING");
  });

  it("reorders top-level page children through the page document target", () => {
    const result = applyCommand(project.document, {
      commandId: "cmd_move_top_level",
      protocolVersion: "1.0.0",
      type: "node.move",
      nodeId: "section_faq",
      targetParentId: "page_pricing",
      beforeNodeId: "section_hero"
    }, project);
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.document.children.map(({ id }) => id)).toEqual(["section_header", "section_faq", "section_hero", "section_pricing"]);
  });

  it("does not retain caller-owned Command objects in the resulting document", () => {
    const command: DocumentCommand = {
      commandId: "cmd_insert_detached",
      protocolVersion: "1.0.0",
      type: "node.insert",
      targetParentId: "stack_faq",
      node: {
        id: "text_detached",
        kind: "component",
        componentRef: "Text",
        variant: "body",
        props: { text: "Detached input" }
      }
    };
    const result = applyCommand(project.document, command, project);
    expect(result.accepted).toBe(true);
    if (!result.accepted || command.type !== "node.insert" || command.node.kind !== "component") return;
    command.node.props = { text: "Mutated later" };
    expect(findNode(result.document, "text_detached")).toHaveProperty("props.text", "Detached input");
  });
});
