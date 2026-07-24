import type { Server } from "node:http";
import { dirname, join } from "node:path";
import type { RevisionStoreOptions } from "@agidn/document-engine";
import { CatalogService } from "./application/catalog-service.js";
import { ExportService } from "./application/export-service.js";
import { PersistentProjectRevisionStore } from "./application/persistent-project-revision-store.js";
import { ProjectService } from "./application/project-service.js";
import { ContextPackageDirectoryWriter } from "./infrastructure/filesystem/context-package-writer.js";
import { loadWorkspaceProject, type WorkspaceProject } from "./infrastructure/filesystem/project-loader.js";
import {
  AtomicJsonProjectRevisionStateFile,
  defaultProjectRevisionStatePath
} from "./infrastructure/filesystem/project-revision-state-file.js";
import { createWorkspaceHttpServer } from "./transport/http/http-server.js";

export interface WorkspaceServerApplication {
  project: WorkspaceProject;
  projectStore: PersistentProjectRevisionStore;
  projectRevisionStatePath: string;
  catalogService: CatalogService;
  exportService: ExportService;
  projectService: ProjectService;
  contextOutputDirectory: string;
  httpServer: Server;
}

export interface WorkspaceServerOptions extends RevisionStoreOptions {
  projectRevisionStatePath?: string;
  contextOutputDirectory?: string;
}

export async function createWorkspaceServerApplication(
  documentPath: string,
  options: WorkspaceServerOptions = {}
): Promise<WorkspaceServerApplication> {
  const project = await loadWorkspaceProject(documentPath);
  const projectRevisionStatePath =
    options.projectRevisionStatePath ??
    defaultProjectRevisionStatePath(project.documentPath);
  const projectStore =
    await PersistentProjectRevisionStore.create(
      {
        document: project.document,
        assets: project.assets
      },
      {
        primitives: project.primitiveComponents,
        tokens: project.tokens,
        actions: project.actions
      },
      new AtomicJsonProjectRevisionStateFile(
        projectRevisionStatePath
      ),
      {
        ...(options.clock ? { clock: options.clock } : {})
      }
    );
  const contextOutputDirectory = options.contextOutputDirectory ?? join(dirname(project.documentPath), ".ui-context");
  const catalogService = new CatalogService(project, projectStore);
  const exportService = new ExportService(
    projectStore,
    project,
    new ContextPackageDirectoryWriter(contextOutputDirectory)
  );
  const projectService = new ProjectService(projectStore);
  const httpServer = createWorkspaceHttpServer({
    catalog: catalogService,
    contextExport: exportService,
    project: projectService
  });
  return {
    project,
    projectStore,
    projectRevisionStatePath,
    catalogService,
    exportService,
    projectService,
    contextOutputDirectory,
    httpServer
  };
}
