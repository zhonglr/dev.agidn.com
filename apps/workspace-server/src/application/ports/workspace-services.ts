import type { CatalogServicePort } from "./catalog-service.js";
import type { ExportServicePort } from "./export-service.js";
import type { ProjectServicePort } from "./project-service.js";

export interface WorkspaceServices {
  catalog: CatalogServicePort;
  contextExport: ExportServicePort;
  project: ProjectServicePort;
}
