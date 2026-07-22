import type { Server } from "node:http";
import { dirname, join } from "node:path";
import type { RevisionStoreOptions } from "@agidn/document-engine";
import { CatalogService } from "./application/catalog-service.js";
import { DocumentService } from "./application/document-service.js";
import { ExportService } from "./application/export-service.js";
import { HistoryService } from "./application/history-service.js";
import { PersistentRevisionStore } from "./application/persistent-revision-store.js";
import { ContextPackageDirectoryWriter } from "./infrastructure/filesystem/context-package-writer.js";
import { loadWorkspaceProject, type WorkspaceProject } from "./infrastructure/filesystem/project-loader.js";
import { AtomicJsonRevisionStateFile, defaultRevisionStatePath } from "./infrastructure/filesystem/revision-state-file.js";
import { createWorkspaceHttpServer } from "./transport/http/http-server.js";

export interface WorkspaceServerApplication {
  project: WorkspaceProject;
  store: PersistentRevisionStore;
  revisionStatePath: string;
  documentService: DocumentService;
  historyService: HistoryService;
  catalogService: CatalogService;
  exportService: ExportService;
  contextOutputDirectory: string;
  httpServer: Server;
}

export interface WorkspaceServerOptions extends RevisionStoreOptions {
  revisionStatePath?: string;
  contextOutputDirectory?: string;
}

export async function createWorkspaceServerApplication(
  documentPath: string,
  options: WorkspaceServerOptions = {}
): Promise<WorkspaceServerApplication> {
  const project = await loadWorkspaceProject(documentPath);
  const revisionStatePath = options.revisionStatePath ?? defaultRevisionStatePath(project.documentPath);
  const persistence = new AtomicJsonRevisionStateFile(revisionStatePath);
  const store = await PersistentRevisionStore.create(project.document, project, persistence, {
    ...(options.clock ? { clock: options.clock } : {})
  });
  const contextOutputDirectory = options.contextOutputDirectory ?? join(dirname(project.documentPath), ".ui-context");
  const documentService = new DocumentService(store);
  const historyService = new HistoryService(store);
  const catalogService = new CatalogService(project);
  const exportService = new ExportService(store, project, new ContextPackageDirectoryWriter(contextOutputDirectory));
  const httpServer = createWorkspaceHttpServer({
    document: documentService,
    history: historyService,
    catalog: catalogService,
    contextExport: exportService
  });
  return {
    project,
    store,
    revisionStatePath,
    documentService,
    historyService,
    catalogService,
    exportService,
    contextOutputDirectory,
    httpServer
  };
}
