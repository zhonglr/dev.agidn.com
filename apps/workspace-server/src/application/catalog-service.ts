import type { GetCatalogResponse } from "@agidn/api-protocol";
import type { ComponentDefinition, ComponentRegistry } from "@agidn/component-registry";
import type { ActionRegistry } from "@agidn/context-exporter";
import type { TokenRegistry } from "@agidn/design-tokens";
import type { CatalogServicePort } from "./ports/catalog-service.js";

export interface WorkspaceCatalog {
  components: ComponentRegistry;
  tokens: TokenRegistry;
  policies: unknown;
  actions: ActionRegistry;
  constraints: unknown;
}

function componentForApi(definition: ComponentDefinition) {
  return {
    name: definition.name,
    ...(definition.displayName === undefined ? {} : { displayName: structuredClone(definition.displayName) }),
    ...(definition.category === undefined ? {} : { category: definition.category }),
    ...(definition.categoryDisplayName === undefined ? {} : { categoryDisplayName: structuredClone(definition.categoryDisplayName) }),
    version: definition.version,
    source: definition.source,
    roles: [...definition.roles],
    props: Object.fromEntries(Object.entries(definition.props).map(([name, prop]) => [name, {
      type: prop.type,
      ...(prop.displayName === undefined ? {} : { displayName: structuredClone(prop.displayName) }),
      ...(prop.required === undefined ? {} : { required: prop.required }),
      ...(prop.values === undefined ? {} : { values: [...prop.values] }),
      ...(prop.valueDisplayNames === undefined ? {} : { valueDisplayNames: structuredClone(prop.valueDisplayNames) })
    }])),
    slots: Object.fromEntries(Object.entries(definition.slots).map(([name, slot]) => [name, {
      ...(slot.displayName === undefined ? {} : { displayName: structuredClone(slot.displayName) }),
      ...(slot.required === undefined ? {} : { required: slot.required }),
      ...(slot.accepts === undefined ? {} : { accepts: [...slot.accepts] }),
      ...(slot.minItems === undefined ? {} : { minItems: slot.minItems }),
      ...(slot.maxItems === undefined ? {} : { maxItems: slot.maxItems })
    }])),
    variants: [...definition.variants],
    ...(definition.variantDisplayNames === undefined ? {} : { variantDisplayNames: structuredClone(definition.variantDisplayNames) }),
    states: [...definition.states],
    ...(definition.accessibleName === undefined ? {} : { accessibleName: definition.accessibleName })
  };
}

export class CatalogService implements CatalogServicePort {
  constructor(private readonly catalog: WorkspaceCatalog) {}

  getCatalog(): GetCatalogResponse {
    return {
      protocolVersion: "1.0.0",
      ok: true,
      components: {
        version: this.catalog.components.version,
        components: Object.fromEntries(
          Object.entries(this.catalog.components.components).map(([name, definition]) => [name, componentForApi(definition)])
        )
      },
      tokens: structuredClone(this.catalog.tokens),
      policies: structuredClone(this.catalog.policies),
      actions: structuredClone(this.catalog.actions),
      constraints: structuredClone(this.catalog.constraints)
    };
  }
}
