import type { GetCatalogResponse } from "@agidn/api-protocol";
import { applyCommand } from "@agidn/command-engine";
import { createComponentNode } from "../../apps/studio/src/component-node-factory.js";
import {
  createNodesForPayload,
  insertSourcesForPayload
} from "../../apps/studio/src/insert-source.js";
import { loadFoundationProject } from "../helpers.js";

describe("Component Registry presets", () => {
  it("creates every Foundation primitive as a valid insertable V2 node", async () => {
    const project = await loadFoundationProject();
    const catalog: GetCatalogResponse = {
      protocolVersion: "2.0.0",
      ok: true,
      components: structuredClone(project.components) as GetCatalogResponse["components"],
      tokens: project.tokens,
      policies: project.policies,
      actions: project.actions,
      constraints: project.constraints,
      assets: project.assets
    };

    for (const [componentRef, definition] of Object.entries(
      project.primitiveComponents.components
    )) {
      const node = createComponentNode(
        catalog,
        componentRef,
        "New content",
        definition.editor.defaultPreset
      );
      expect(node, componentRef).toBeDefined();
      if (!node) continue;

      const result = applyCommand(
        project.document,
        {
          protocolVersion: "2.0.0",
          commandId: `insert_${componentRef.toLowerCase()}`,
          type: "node.insert",
          targetParentId: "stack_foundation",
          node
        },
        project
      );
      expect(
        result.accepted,
        `${componentRef}: ${result.accepted ? "" : result.violations.map(({ code }) => code).join(", ")}`
      ).toBe(true);
    }
  });

  it("uses the requested preset instead of inventing component values", async () => {
    const project = await loadFoundationProject();
    const catalog: GetCatalogResponse = {
      protocolVersion: "2.0.0",
      ok: true,
      components: structuredClone(project.components) as GetCatalogResponse["components"],
      tokens: project.tokens,
      policies: project.policies,
      actions: project.actions,
      constraints: project.constraints,
      assets: project.assets
    };
    const button = createComponentNode(catalog, "Button", "Ignored", "primary");

    expect(button).toMatchObject({
      componentRef: "Button",
      variant: "primary",
      props: { label: "Button" }
    });
  });

  it("creates and validates a Composite instance from the active Registry", async () => {
    const project = await loadFoundationProject();
    const catalog: GetCatalogResponse = {
      protocolVersion: "2.0.0",
      ok: true,
      components: structuredClone(project.components) as GetCatalogResponse["components"],
      tokens: project.tokens,
      policies: project.policies,
      actions: project.actions,
      constraints: project.constraints,
      assets: project.assets
    };
    const node = createComponentNode(
      catalog,
      "project.foundation-callout",
      "Ignored"
    );

    expect(node).toMatchObject({
      componentRef: "project.foundation-callout",
      variant: "default",
      props: {
        title: "Callout title",
        body: "Callout body"
      }
    });
    if (!node) return;
    const result = applyCommand(
      project.document,
      {
        protocolVersion: "2.0.0",
        commandId: "insert_foundation_callout",
        type: "node.insert",
        targetParentId: "stack_foundation",
        node
      },
      project
    );
    expect(result.accepted).toBe(true);
  });

  it("materializes Pattern roots with fresh ids and matching insert sources", async () => {
    const project = await loadFoundationProject();
    const catalog: GetCatalogResponse = {
      protocolVersion: "2.0.0",
      ok: true,
      components: structuredClone(project.components) as GetCatalogResponse["components"],
      tokens: project.tokens,
      policies: project.policies,
      actions: project.actions,
      constraints: project.constraints,
      assets: project.assets
    };
    const payload = {
      type: "pattern" as const,
      id: "project.two-column-copy"
    };
    const nodes = createNodesForPayload(catalog, payload, "Ignored");

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      kind: "layout",
      layout: "grid"
    });
    expect(nodes[0]?.id).toMatch(/^pattern_[a-z0-9]+:pattern_grid$/);
    expect(insertSourcesForPayload(catalog, payload)).toEqual([
      { kind: "layout", layout: "grid" }
    ]);
  });
});
