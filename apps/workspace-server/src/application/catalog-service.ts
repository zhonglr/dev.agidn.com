import type { GetCatalogResponse } from "@agidn/api-protocol";
import type { ComponentDefinition, ComponentRegistry } from "@agidn/component-registry";
import type { ActionRegistry } from "@agidn/context-exporter";
import type { TokenRegistry } from "@agidn/design-tokens";
import type { ProjectAssetRegistry } from "@agidn/project-assets";
import { composeProjectComponentRegistry } from "@agidn/project-assets";
import type { CatalogServicePort } from "./ports/catalog-service.js";
import type { WorkspaceProjectRevisionStorePort } from "./ports/project-revision-store.js";

export interface WorkspaceCatalog {
  primitiveComponents: ComponentRegistry;
  tokens: TokenRegistry;
  policies: unknown;
  actions: ActionRegistry;
  constraints: unknown;
  assets: ProjectAssetRegistry;
}

function componentForApi(
  definition: ComponentDefinition
): GetCatalogResponse["components"]["components"][string] {
  return structuredClone(definition) as GetCatalogResponse["components"]["components"][string];
}

export class CatalogService implements CatalogServicePort {
  constructor(
    private readonly catalog: WorkspaceCatalog,
    private readonly store: WorkspaceProjectRevisionStorePort
  ) {}

  getCatalog(): GetCatalogResponse {
    const assets = this.store.getCurrent().project.assets;
    const components = composeProjectComponentRegistry(
      this.catalog.primitiveComponents,
      assets
    );
    return {
      protocolVersion: "2.0.0",
      ok: true,
      components: {
        schemaVersion: components.schemaVersion,
        components: Object.fromEntries(
          Object.entries(components.components).map(([name, definition]) => [name, componentForApi(definition)])
        )
      },
      tokens: structuredClone(this.catalog.tokens),
      policies: structuredClone(this.catalog.policies),
      actions: structuredClone(this.catalog.actions),
      constraints: structuredClone(this.catalog.constraints),
      assets: structuredClone(assets)
    };
  }
}
