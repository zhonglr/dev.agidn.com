import type { GetCatalogResponse } from "@agidn/api-protocol";
import type { ComponentNode, PageNode } from "@agidn/document-schema";

export function defaultValue(
  definition: GetCatalogResponse["components"]["components"][string]["props"][string],
  defaultContent: string
): unknown {
  if (definition.defaultValue !== undefined) return definition.defaultValue;
  if (definition.type === "boolean") return false;
  if (definition.type === "number") return 0;
  if (definition.type === "enum") return definition.values?.[0] ?? "";
  return defaultContent;
}

export function createComponentNode(
  catalog: GetCatalogResponse,
  componentRef: string,
  defaultContent: string,
  presetId?: string,
  depth = 0
): ComponentNode | undefined {
  const definition = catalog.components.components[componentRef];
  if (!definition) return undefined;
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const props = Object.fromEntries(
    Object.entries(definition.props)
      .filter(([, prop]) => prop.required)
      .map(([name, prop]) => [name, defaultValue(prop, defaultContent)])
  );
  const slots: Record<string, PageNode[]> = {};
  if (depth < 3) {
    for (const [slotName, slot] of Object.entries(definition.slots)) {
      const count = Math.max(slot.minItems, slot.required ? 1 : 0);
      if (count === 0) continue;
      const childRef = slot.accepts.find((candidate) => candidate !== "*") ?? "Text";
      const children = Array.from({ length: count }, () =>
        createComponentNode(catalog, childRef, defaultContent, undefined, depth + 1)
      ).filter((node): node is ComponentNode => Boolean(node));
      if (children.length) slots[slotName] = children;
    }
  }
  const preset =
    definition.editor.presets[presetId ?? definition.editor.defaultPreset] ??
    definition.editor.presets[definition.editor.defaultPreset];
  const variants = Object.keys(definition.variants);
  return {
    id: `${componentRef.toLowerCase()}_${suffix}`,
    kind: "component",
    componentRef,
    ...(preset?.variant ?? variants[0] ? { variant: preset?.variant ?? variants[0] } : {}),
    ...(Object.keys({ ...props, ...preset?.props }).length ? { props: { ...props, ...preset?.props } } : {}),
    ...(Object.keys(slots).length ? { slots } : {})
  };
}
