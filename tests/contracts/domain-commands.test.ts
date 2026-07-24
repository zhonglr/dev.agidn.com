import { applyCommand, type DocumentCommand, type PatchOperation } from "@agidn/command-engine";
import { findNode, type PageDocument } from "@agidn/document-schema";
import { loadFoundationProject } from "../helpers.js";

interface CommandCase {
  name: string;
  command: DocumentCommand;
  expectedOperation: PatchOperation;
  assertDocument: (document: PageDocument) => void;
}

describe("domain commands", async () => {
  const project = await loadFoundationProject();
  const cases: CommandCase[] = [
    {
      name: "sets a declared style binding",
      command: {
        commandId: "cmd_set_token",
        protocolVersion: "2.0.0",
        type: "node.setStyleBinding",
        nodeId: "heading_foundation",
        property: "textColor",
        tokenRef: "color.action.primary"
      },
      expectedOperation: { op: "node.update", nodeId: "heading_foundation", changes: { styleBindings: { textColor: "color.action.primary" } } },
      assertDocument: (document) =>
        expect(findNode(document, "heading_foundation")).toMatchObject({
          styleBindings: { textColor: "color.action.primary" }
        })
    },
    {
      name: "sets a complete Grid responsive policy",
      command: {
        commandId: "cmd_set_responsive",
        protocolVersion: "2.0.0",
        type: "node.setResponsivePolicy",
        nodeId: "grid_foundation",
        columns: { mobile: 1, tablet: 2, desktop: 4 }
      },
      expectedOperation: { op: "node.update", nodeId: "grid_foundation", changes: { columns: { mobile: 1, tablet: 2, desktop: 4 } } },
      assertDocument: (document) => expect(findNode(document, "grid_foundation")).toMatchObject({ columns: { mobile: 1, tablet: 2, desktop: 4 } })
    },
    {
      name: "sets a semantic role",
      command: {
        commandId: "cmd_set_role",
        protocolVersion: "2.0.0",
        type: "node.setRole",
        nodeId: "text_foundation",
        role: "description"
      },
      expectedOperation: { op: "node.update", nodeId: "text_foundation", changes: { role: "description" } },
      assertDocument: (document) => expect(findNode(document, "text_foundation")).toMatchObject({ role: "description" })
    },
    {
      name: "sets a node name",
      command: {
        commandId: "cmd_set_name",
        protocolVersion: "2.0.0",
        type: "node.setName",
        nodeId: "heading_foundation",
        name: "Hero title"
      },
      expectedOperation: {
        op: "node.update",
        nodeId: "heading_foundation",
        changes: { name: "Hero title" }
      },
      assertDocument: (document) =>
        expect(findNode(document, "heading_foundation")).toMatchObject({ name: "Hero title" })
    },
    {
      name: "sets legal Grid placement",
      command: {
        commandId: "cmd_set_placement",
        protocolVersion: "2.0.0",
        type: "node.setPlacement",
        nodeId: "text_grid_a",
        placement: { width: "fill", gridSpan: { mobile: 1, tablet: 2, desktop: 6 } }
      },
      expectedOperation: {
        op: "node.update",
        nodeId: "text_grid_a",
        changes: {
          placement: { width: "fill", gridSpan: { mobile: 1, tablet: 2, desktop: 6 } }
        }
      },
      assertDocument: (document) =>
        expect(findNode(document, "text_grid_a")).toMatchObject({
          placement: { width: "fill", gridSpan: { mobile: 1, tablet: 2, desktop: 6 } }
        })
    },
    {
      name: "sets responsive visibility",
      command: {
        commandId: "cmd_set_visibility",
        protocolVersion: "2.0.0",
        type: "node.setVisibility",
        nodeId: "heading_foundation",
        visibility: { mobile: false }
      },
      expectedOperation: {
        op: "node.update",
        nodeId: "heading_foundation",
        changes: { visibility: { mobile: false } }
      },
      assertDocument: (document) =>
        expect(findNode(document, "heading_foundation")).toMatchObject({
          visibility: { mobile: false }
        })
    },
    {
      name: "sets accessibility metadata",
      command: {
        commandId: "cmd_set_accessibility",
        protocolVersion: "2.0.0",
        type: "node.setAccessibility",
        nodeId: "button_foundation",
        accessibility: { label: "Continue to home" }
      },
      expectedOperation: {
        op: "node.update",
        nodeId: "button_foundation",
        changes: { accessibility: { label: "Continue to home" } }
      },
      assertDocument: (document) =>
        expect(findNode(document, "button_foundation")).toMatchObject({
          accessibility: { label: "Continue to home" }
        })
    },
    {
      name: "replaces component interactions",
      command: {
        commandId: "cmd_set_interactions",
        protocolVersion: "2.0.0",
        type: "node.setInteractions",
        nodeId: "button_foundation",
        interactions: [
          {
            event: "press",
            actionRef: "navigation.openPage",
            arguments: { route: "/next" }
          }
        ]
      },
      expectedOperation: {
        op: "node.update",
        nodeId: "button_foundation",
        changes: {
          interactions: [
            {
              event: "press",
              actionRef: "navigation.openPage",
              arguments: { route: "/next" }
            }
          ]
        }
      },
      assertDocument: (document) =>
        expect(findNode(document, "button_foundation")).toMatchObject({
          interactions: [{ event: "press", arguments: { route: "/next" } }]
        })
    },
    {
      name: "moves a node into a compatible slot",
      command: {
        commandId: "cmd_move_badge",
        protocolVersion: "2.0.0",
        type: "node.move",
        nodeId: "divider_foundation",
        targetParentId: "card_foundation",
        targetSlot: "content"
      },
      expectedOperation: { op: "node.move", nodeId: "divider_foundation", targetParentId: "card_foundation", targetSlot: "content" },
      assertDocument: (document) => {
        expect(findNode(document, "card_foundation")).toHaveProperty("slots.content.1.id", "divider_foundation");
      }
    },
    {
      name: "removes an optional node",
      command: {
        commandId: "cmd_remove_badge",
        protocolVersion: "2.0.0",
        type: "node.remove",
        nodeId: "divider_foundation"
      },
      expectedOperation: { op: "node.remove", nodeId: "divider_foundation" },
      assertDocument: (document) => expect(findNode(document, "divider_foundation")).toBeUndefined()
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

  it("rejects undeclared style bindings and preserves the original document", () => {
    const result = applyCommand(project.document, {
      commandId: "cmd_unknown_binding",
      protocolVersion: "2.0.0",
      type: "node.setStyleBinding",
      nodeId: "button_foundation",
      property: "unknown",
      tokenRef: "color.action.primary"
    }, project);

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.violations.map(({ code }) => code)).toContain("UNKNOWN_TOKEN");
    expect(findNode(result.document, "button_foundation")).toBeDefined();
  });

  it("rejects undeclared semantic roles", () => {
    const result = applyCommand(project.document, {
      commandId: "cmd_unknown_role",
      protocolVersion: "2.0.0",
      type: "node.setRole",
      nodeId: "text_foundation",
      role: "legacy-summary"
    }, project);

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.violations.map(({ code }) => code)).toContain("INVALID_ROLE");
  });

  it("rejects Grid placement outside a direct Grid child", () => {
    const result = applyCommand(project.document, {
      commandId: "cmd_invalid_placement",
      protocolVersion: "2.0.0",
      type: "node.setPlacement",
      nodeId: "heading_foundation",
      placement: { gridSpan: { desktop: 6 } }
    }, project);

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.violations.map(({ code }) => code)).toContain("INVALID_PLACEMENT");
  });

  it("does not let layout property commands mutate structural fields", () => {
    const result = applyCommand(project.document, {
      commandId: "cmd_structural_escape",
      protocolVersion: "2.0.0",
      type: "node.setLayoutProperty",
      nodeId: "stack_foundation",
      property: "children",
      value: []
    }, project);

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.violations[0]?.code).toBe("COMMAND_INVALID");
    expect(result.document).toEqual(project.document);
  });

  it("rejects moving a node into its own descendant", () => {
    const result = applyCommand(project.document, {
      commandId: "cmd_move_cycle",
      protocolVersion: "2.0.0",
      type: "node.move",
      nodeId: "section_foundation",
      targetParentId: "grid_foundation"
    }, project);

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.violations[0]?.code).toBe("INVALID_LAYOUT_NESTING");
  });

  it("does not retain caller-owned Command objects in the resulting document", () => {
    const command: DocumentCommand = {
      commandId: "cmd_insert_detached",
      protocolVersion: "2.0.0",
      type: "node.insert",
      targetParentId: "stack_foundation",
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
