import type { GetCatalogResponse } from "@agidn/api-protocol";
import type { ComponentNode, PageNode } from "@agidn/document-schema";

export function defaultValue(
  definition: GetCatalogResponse["components"]["components"][string]["props"][string],
  defaultContent: string
): unknown {
  if (definition.type === "boolean") return false;
  if (definition.type === "number") return 0;
  if (definition.type === "enum") return definition.values?.[0] ?? "";
  return defaultContent;
}

export function createComponentNode(
  catalog: GetCatalogResponse,
  componentRef: string,
  defaultContent: string,
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
      const count = Math.max(slot.minItems ?? 0, slot.required ? 1 : 0);
      if (count === 0) continue;
      const childRef = slot.accepts?.find((candidate) => candidate !== "*") ?? "Text";
      const children = Array.from({ length: count }, () =>
        createComponentNode(catalog, childRef, defaultContent, depth + 1)
      ).filter((node): node is ComponentNode => Boolean(node));
      if (children.length) slots[slotName] = children;
    }
  }
  return {
    id: `${componentRef.toLowerCase()}_${suffix}`,
    kind: "component",
    componentRef,
    ...(definition.variants[0] ? { variant: definition.variants[0] } : {}),
    ...(Object.keys(props).length ? { props } : {}),
    ...(Object.keys(slots).length ? { slots } : {})
  };
}

export function cloneNodeWithFreshIds(node: PageNode): PageNode {
  const cloned = structuredClone(node);
  const refresh = (current: PageNode): void => {
    current.id = `${current.kind === "component" ? current.componentRef.toLowerCase() : current.layout}_${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
    (current.kind === "layout" ? current.children : Object.values(current.slots ?? {}).flat()).forEach(refresh);
  };
  refresh(cloned);
  return cloned;
}
