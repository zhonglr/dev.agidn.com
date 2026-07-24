import { TypeCompiler } from "@sinclair/typebox/compiler";
import {
  type ComponentDefinition,
  type ComponentRegistry,
  type PropDefinition,
  type SlotDefinition
} from "@agidn/component-registry";
import {
  type ComponentNode,
  type PageNode
} from "@agidn/document-schema";
import {
  ProjectAssetRegistrySchema,
  type CompositeAsset,
  type PatternAsset,
  type ProjectAssetRegistry
} from "./schema.js";

export {
  CompositeAssetSchema,
  PatternAssetSchema,
  PROJECT_ASSET_SCHEMA_VERSION,
  ProjectAssetRegistrySchema,
  type CompositeAsset,
  type PatternAsset,
  type ProjectAssetRegistry
} from "./schema.js";

export interface ProjectAssetIssue {
  code:
    | "SCHEMA_INVALID"
    | "ASSET_KEY_MISMATCH"
    | "ASSET_COMPONENT_COLLISION"
    | "DUPLICATE_TEMPLATE_NODE_ID"
    | "UNKNOWN_TEMPLATE_COMPONENT"
    | "UNKNOWN_BINDING_TARGET"
    | "INVALID_PROP_BINDING"
    | "INVALID_SLOT_BINDING"
    | "REQUIRED_PROP_DEFAULT_MISSING"
    | "COMPOSITE_CYCLE";
  path: string;
  message: string;
}

const compiledAssets = TypeCompiler.Compile(ProjectAssetRegistrySchema);

function templateNodes(nodes: readonly PageNode[]): PageNode[] {
  const result: PageNode[] = [];
  const visit = (node: PageNode): void => {
    result.push(node);
    (node.kind === "layout" ? node.children : Object.values(node.slots ?? {}).flat()).forEach(
      visit
    );
  };
  nodes.forEach(visit);
  return result;
}

function componentDefinition(
  registry: ComponentRegistry,
  assets: ProjectAssetRegistry,
  reference: string
): Pick<ComponentDefinition, "props" | "slots"> | undefined {
  const primitive = registry.components[reference];
  if (primitive) return primitive;
  const composite = assets.composites[reference];
  if (!composite) return undefined;
  return {
    props: Object.fromEntries(
      Object.entries(composite.publicProps).map(([name, value]) => [name, value.definition])
    ),
    slots: Object.fromEntries(
      Object.entries(composite.publicSlots).map(([name, value]) => [name, value.definition])
    )
  };
}

function dependencyCycles(assets: ProjectAssetRegistry): string[][] {
  const ids = new Set(Object.keys(assets.composites));
  const edges = new Map<string, string[]>();
  for (const [id, asset] of Object.entries(assets.composites)) {
    edges.set(
      id,
      [
        ...new Set(
          templateNodes([asset.root])
            .filter((node): node is ComponentNode => node.kind === "component")
            .map(({ componentRef }) => componentRef)
            .filter((reference) => ids.has(reference))
        )
      ]
    );
  }
  const cycles: string[][] = [];
  const active: string[] = [];
  const complete = new Set<string>();
  const visit = (id: string): void => {
    const activeIndex = active.indexOf(id);
    if (activeIndex >= 0) {
      cycles.push([...active.slice(activeIndex), id]);
      return;
    }
    if (complete.has(id)) return;
    active.push(id);
    edges.get(id)?.forEach(visit);
    active.pop();
    complete.add(id);
  };
  ids.forEach(visit);
  return cycles;
}

export function validateProjectAssets(
  value: unknown,
  components: ComponentRegistry
): { valid: true; assets: ProjectAssetRegistry } | { valid: false; issues: ProjectAssetIssue[] } {
  if (!compiledAssets.Check(value)) {
    return {
      valid: false,
      issues: [...compiledAssets.Errors(value)].map((error) => ({
        code: "SCHEMA_INVALID",
        path: error.path || "/",
        message: error.message
      }))
    };
  }
  const assets = value as ProjectAssetRegistry;
  const issues: ProjectAssetIssue[] = [];
  const validateTemplate = (
    assetType: "composites" | "patterns",
    assetId: string,
    nodes: readonly PageNode[]
  ): Map<string, PageNode> => {
    const byId = new Map<string, PageNode>();
    for (const node of templateNodes(nodes)) {
      if (byId.has(node.id)) {
        issues.push({
          code: "DUPLICATE_TEMPLATE_NODE_ID",
          path: `/${assetType}/${assetId}`,
          message: `Template node id '${node.id}' is duplicated.`
        });
      }
      byId.set(node.id, node);
      if (
        node.kind === "component" &&
        !componentDefinition(components, assets, node.componentRef)
      ) {
        issues.push({
          code: "UNKNOWN_TEMPLATE_COMPONENT",
          path: `/${assetType}/${assetId}`,
          message: `Template component '${node.componentRef}' is not registered.`
        });
      }
    }
    return byId;
  };

  for (const [key, asset] of Object.entries(assets.composites)) {
    const path = `/composites/${key}`;
    if (key !== asset.id)
      issues.push({
        code: "ASSET_KEY_MISMATCH",
        path,
        message: `Composite key '${key}' must equal id '${asset.id}'.`
      });
    if (components.components[key]) {
      issues.push({
        code: "ASSET_COMPONENT_COLLISION",
        path,
        message: `Composite '${key}' conflicts with a Primitive component id.`
      });
    }
    const byId = validateTemplate("composites", key, [asset.root]);
    for (const [name, publicProp] of Object.entries(asset.publicProps)) {
      if (publicProp.definition.required && publicProp.definition.defaultValue === undefined) {
        issues.push({
          code: "REQUIRED_PROP_DEFAULT_MISSING",
          path: `${path}/publicProps/${name}`,
          message: `Required public prop '${name}' must have a creation default.`
        });
      }
      for (const binding of publicProp.bindings) {
        const target = byId.get(binding.targetNodeId);
        if (!target || target.kind !== "component") {
          issues.push({
            code: "UNKNOWN_BINDING_TARGET",
            path: `${path}/publicProps/${name}`,
            message: `Prop binding target '${binding.targetNodeId}' is not a component node.`
          });
          continue;
        }
        const definition = componentDefinition(components, assets, target.componentRef);
        if (!definition?.props[binding.property]) {
          issues.push({
            code: "INVALID_PROP_BINDING",
            path: `${path}/publicProps/${name}`,
            message: `'${binding.property}' is not a public prop of '${target.componentRef}'.`
          });
        }
      }
    }
    for (const [name, publicSlot] of Object.entries(asset.publicSlots)) {
      const target = byId.get(publicSlot.targetNodeId);
      const validLayoutTarget = target?.kind === "layout" && !publicSlot.targetSlot;
      const targetDefinition =
        target?.kind === "component"
          ? componentDefinition(components, assets, target.componentRef)
          : undefined;
      const validComponentTarget =
        target?.kind === "component" &&
        publicSlot.targetSlot !== undefined &&
        targetDefinition?.slots[publicSlot.targetSlot] !== undefined;
      if (!validLayoutTarget && !validComponentTarget) {
        issues.push({
          code: target ? "INVALID_SLOT_BINDING" : "UNKNOWN_BINDING_TARGET",
          path: `${path}/publicSlots/${name}`,
          message: `Slot '${name}' does not target a valid node collection.`
        });
      }
    }
  }
  for (const [key, asset] of Object.entries(assets.patterns)) {
    if (key !== asset.id)
      issues.push({
        code: "ASSET_KEY_MISMATCH",
        path: `/patterns/${key}`,
        message: `Pattern key '${key}' must equal id '${asset.id}'.`
      });
    validateTemplate("patterns", key, asset.nodes);
  }
  for (const cycle of dependencyCycles(assets)) {
    issues.push({
      code: "COMPOSITE_CYCLE",
      path: `/composites/${cycle[0] ?? ""}`,
      message: `Composite dependency cycle: ${cycle.join(" -> ")}.`
    });
  }
  return issues.length ? { valid: false, issues } : { valid: true, assets };
}

function cloneTemplate(
  nodes: readonly PageNode[],
  idFactory: (templateId: string) => string
): { clones: PageNode[]; idMap: Map<string, string> } {
  const clones = structuredClone(nodes) as PageNode[];
  const idMap = new Map<string, string>();
  for (const node of templateNodes(clones)) idMap.set(node.id, idFactory(node.id));
  for (const node of templateNodes(clones)) {
    node.id = idMap.get(node.id)!;
    if (node.kind === "component" && node.accessibility?.describedBy) {
      const describedBy = idMap.get(node.accessibility.describedBy);
      if (describedBy) node.accessibility.describedBy = describedBy;
    }
  }
  return { clones, idMap };
}

function cloneWithFreshIds(nodes: readonly PageNode[], idFactory: (templateId: string) => string): PageNode[] {
  return cloneTemplate(nodes, idFactory).clones;
}

export function instantiatePattern(
  pattern: PatternAsset,
  idFactory: (templateId: string) => string
): PageNode[] {
  return cloneWithFreshIds(pattern.nodes, idFactory);
}

export function compositeComponentDefinition(asset: CompositeAsset): ComponentDefinition {
  const props = Object.fromEntries(
    Object.entries(asset.publicProps).map(([name, value]) => [name, value.definition])
  ) as Record<string, PropDefinition>;
  const slots = Object.fromEntries(
    Object.entries(asset.publicSlots).map(([name, value]) => [name, value.definition])
  ) as Record<string, SlotDefinition>;
  const defaultVariant = asset.editor.defaultVariant ?? Object.keys(asset.variants)[0];
  const defaultProps = Object.fromEntries(
    Object.entries(props)
      .filter(([, definition]) => definition.defaultValue !== undefined)
      .map(([name, definition]) => [name, definition.defaultValue!])
  );
  return {
    name: asset.id,
    version: String(asset.version),
    source: `project:${asset.id}`,
    displayName: asset.displayName,
    description: asset.description,
    category: "composite",
    roles: [],
    props,
    slots,
    variants: Object.fromEntries(
      Object.entries(asset.variants).map(([name, variant]) => [
        name,
        { displayName: variant.displayName }
      ])
    ),
    tokenSlots: {},
    events: {},
    accessibility: { accessibleName: "none" },
    editor: {
      icon: asset.editor.icon,
      keywords: asset.editor.keywords,
      presets: {
        default: {
          displayName: asset.displayName,
          ...(defaultVariant ? { variant: defaultVariant } : {}),
          ...(Object.keys(defaultProps).length ? { props: defaultProps } : {})
        }
      },
      defaultPreset: "default"
    }
  };
}

export function composeProjectComponentRegistry(
  primitives: ComponentRegistry,
  assets: ProjectAssetRegistry
): ComponentRegistry {
  const composites = Object.fromEntries(
    Object.values(assets.composites).map((asset) => [
      asset.id,
      compositeComponentDefinition(asset)
    ])
  );
  const collision = Object.keys(composites).find((id) => primitives.components[id]);
  if (collision) {
    throw new Error(`Composite '${collision}' conflicts with a Primitive component id.`);
  }
  return {
    schemaVersion: primitives.schemaVersion,
    components: {
      ...primitives.components,
      ...composites
    }
  };
}

export function instantiateComposite(
  asset: CompositeAsset,
  instance: ComponentNode,
  idFactory: (templateId: string) => string
): PageNode {
  const { clones, idMap } = cloneTemplate([asset.root], idFactory);
  const root = clones[0]!;
  const byId = new Map(templateNodes([root]).map((node) => [node.id, node]));
  const variantProps =
    asset.variants[instance.variant ?? asset.editor.defaultVariant ?? ""]?.props ?? {};

  for (const [name, publicProp] of Object.entries(asset.publicProps)) {
    const value =
      instance.props?.[name] ??
      variantProps[name] ??
      publicProp.definition.defaultValue;
    if (value === undefined) continue;
    for (const binding of publicProp.bindings) {
      const targetId = idMap.get(binding.targetNodeId);
      const target = targetId ? byId.get(targetId) : undefined;
      if (!target || target.kind !== "component") continue;
      target.props = { ...target.props, [binding.property]: value };
    }
  }

  for (const [name, publicSlot] of Object.entries(asset.publicSlots)) {
    const targetId = idMap.get(publicSlot.targetNodeId);
    const target = targetId ? byId.get(targetId) : undefined;
    const children = structuredClone(instance.slots?.[name] ?? []) as PageNode[];
    if (target?.kind === "layout" && !publicSlot.targetSlot) {
      target.children = children;
    } else if (target?.kind === "component" && publicSlot.targetSlot) {
      target.slots = { ...target.slots, [publicSlot.targetSlot]: children };
    }
  }

  return root;
}

export {
  checkProjectAssetCommand,
  checkProjectAssetPatch,
  ProjectAssetCommandSchema,
  ProjectAssetPatchOperationSchema,
  ProjectAssetPatchSchema,
  type ProjectAssetCommand,
  type ProjectAssetPatch
} from "./command-schema.js";
export {
  applyProjectAssetCommand,
  type ProjectAssetCommandContext,
  type ProjectAssetCommandResult,
  type ProjectAssetCommandViolation
} from "./commands.js";
