import {
  applyProjectAssetCommand,
  checkProjectAssetCommand,
  checkProjectAssetPatch,
  compositeComponentDefinition,
  composeProjectComponentRegistry,
  instantiateComposite,
  instantiatePattern,
  validateProjectAssets,
  type ProjectAssetRegistry
} from "@agidn/project-assets";
import { loadFoundationProject } from "../helpers.js";

describe("Project Composite and Pattern assets", () => {
  it("validates the formal Foundation asset registry and materializes catalog metadata", async () => {
    const project = await loadFoundationProject();
    const result = validateProjectAssets(project.assets, project.primitiveComponents);

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(
      compositeComponentDefinition(result.assets.composites["project.foundation-callout"]!)
    ).toMatchObject({
      name: "project.foundation-callout",
      category: "composite",
      source: "project:project.foundation-callout",
      props: {
        title: { type: "string", defaultValue: "Callout title" },
        body: { type: "string", defaultValue: "Callout body" }
      }
    });
  });

  it("expands a Pattern into ordinary nodes with fresh stable IDs", async () => {
    const project = await loadFoundationProject();
    const pattern = project.assets.patterns["project.two-column-copy"]!;
    const nodes = instantiatePattern(pattern, (templateId) => `instance:${templateId}`);

    expect(nodes[0]?.id).toBe("instance:pattern_grid");
    expect(nodes[0]).toHaveProperty("children.0.id", "instance:pattern_copy_a");
    expect(nodes[0]).toHaveProperty("children.1.id", "instance:pattern_copy_b");
    expect(pattern.nodes[0]?.id).toBe("pattern_grid");
  });

  it("rejects direct or indirect Composite dependency cycles", async () => {
    const project = await loadFoundationProject();
    const asset = (id: string, componentRef: string) => ({
      id,
      kind: "composite" as const,
      version: 1,
      displayName: id,
      description: id,
      root: {
        id: `${id}:root`,
        kind: "component" as const,
        componentRef
      },
      publicProps: {},
      publicSlots: {},
      variants: { default: { displayName: "Default" } },
      editor: { icon: "component", keywords: [], defaultVariant: "default" }
    });
    const assets: ProjectAssetRegistry = {
      schemaVersion: "2.0.0",
      composites: {
        "project.a": asset("project.a", "project.b"),
        "project.b": asset("project.b", "project.a")
      },
      patterns: {}
    };
    const result = validateProjectAssets(assets, project.primitiveComponents);

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues.map(({ code }) => code)).toContain("COMPOSITE_CYCLE");
  });

  it("materializes Composite variant props and public slots without mutating the asset", async () => {
    const project = await loadFoundationProject();
    const asset = structuredClone(
      project.assets.composites["project.foundation-callout"]!
    );
    asset.variants.emphasis = {
      displayName: "Emphasis",
      props: { title: "Variant title" }
    };
    asset.publicSlots.content = {
      definition: {
        displayName: "Content",
        valueType: "nodes",
        accepts: ["*"],
        required: false,
        minItems: 0
      },
      targetNodeId: "callout_stack"
    };
    const variantRoot = instantiateComposite(
      { ...asset, publicSlots: {} },
      {
        id: "variant_instance",
        kind: "component",
        componentRef: asset.id,
        variant: "emphasis"
      },
      (templateId) => `variant:${templateId}`
    );
    const root = instantiateComposite(
      asset,
      {
        id: "callout_instance",
        kind: "component",
        componentRef: asset.id,
        variant: "emphasis",
        slots: {
          content: [
            {
              id: "external_copy",
              kind: "component",
              componentRef: "Text",
              variant: "body",
              props: { text: "External copy" }
            }
          ]
        }
      },
      (templateId) => `instance:${templateId}`
    );

    expect(variantRoot).toHaveProperty(
      "slots.content.0.children.0.props.text",
      "Variant title"
    );
    expect(root).toHaveProperty(
      "slots.content.0.children.0.id",
      "external_copy"
    );
    expect(asset.root).toHaveProperty(
      "slots.content.0.children.0.id",
      "callout_title"
    );
  });

  it("keeps Primitive and Composite ids collision-free in the active Registry", async () => {
    const project = await loadFoundationProject();
    expect(
      composeProjectComponentRegistry(
        project.primitiveComponents,
        project.assets
      ).components["project.foundation-callout"]
    ).toMatchObject({ category: "composite" });

    const assets = structuredClone(project.assets);
    const callout = assets.composites["project.foundation-callout"]!;
    assets.composites.Button = { ...callout, id: "Button" };
    const result = validateProjectAssets(assets, project.primitiveComponents);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues.map(({ code }) => code)).toContain(
      "ASSET_COMPONENT_COLLISION"
    );
  });

  it("applies strict Asset Commands without mutating the input Registry", async () => {
    const project = await loadFoundationProject();
    const pattern = structuredClone(
      project.assets.patterns["project.two-column-copy"]!
    );
    pattern.id = "project.feature-copy";
    pattern.version = 2;
    const command = {
      protocolVersion: "2.0.0",
      commandId: "asset_pattern_upsert",
      type: "asset.pattern.upsert",
      asset: pattern
    };
    const result = applyProjectAssetCommand(project.assets, command, {
      primitives: project.primitiveComponents,
      document: project.document
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.assets.patterns["project.feature-copy"]).toMatchObject({
      version: 2
    });
    expect(project.assets.patterns["project.feature-copy"]).toBeUndefined();
    expect(checkProjectAssetPatch(result.patch)).toBe(true);
    expect(
      checkProjectAssetCommand({ ...command, directWrite: true }).valid
    ).toBe(false);
  });

  it("rejects invalid templates and protects referenced Composite assets", async () => {
    const project = await loadFoundationProject();
    const invalidPattern = structuredClone(
      project.assets.patterns["project.two-column-copy"]!
    );
    invalidPattern.id = "project.invalid-pattern";
    invalidPattern.nodes = [
      {
        id: "invalid_component",
        kind: "component",
        componentRef: "Missing"
      }
    ];
    const invalid = applyProjectAssetCommand(
      project.assets,
      {
        protocolVersion: "2.0.0",
        commandId: "asset_invalid_upsert",
        type: "asset.pattern.upsert",
        asset: invalidPattern
      },
      {
        primitives: project.primitiveComponents,
        document: project.document
      }
    );
    expect(invalid.accepted).toBe(false);
    if (!invalid.accepted) {
      expect(invalid.violations.map(({ code }) => code)).toContain(
        "UNKNOWN_TEMPLATE_COMPONENT"
      );
    }

    const document = structuredClone(project.document);
    document.children.push({
      id: "callout_page_instance",
      kind: "component",
      componentRef: "project.foundation-callout",
      variant: "default",
      props: {
        title: "Title",
        body: "Body"
      }
    });
    const removal = applyProjectAssetCommand(
      project.assets,
      {
        protocolVersion: "2.0.0",
        commandId: "asset_composite_remove",
        type: "asset.remove",
        assetType: "composite",
        assetId: "project.foundation-callout"
      },
      {
        primitives: project.primitiveComponents,
        document
      }
    );
    expect(removal.accepted).toBe(false);
    if (!removal.accepted) {
      expect(removal.violations[0]?.code).toBe("ASSET_IN_USE");
    }
  });
});
