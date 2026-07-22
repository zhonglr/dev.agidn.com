import type { GetCatalogResponse } from "@agidn/api-protocol";

export interface CatalogServicePort {
  getCatalog(): GetCatalogResponse;
}
