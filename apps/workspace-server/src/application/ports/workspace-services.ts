import type { CatalogServicePort } from "./catalog-service.js";
import type { DocumentServicePort } from "./document-service.js";
import type { ExportServicePort } from "./export-service.js";
import type { HistoryServicePort } from "./history-service.js";

export interface WorkspaceServices {
  document: DocumentServicePort;
  history: HistoryServicePort;
  catalog: CatalogServicePort;
  contextExport: ExportServicePort;
}
