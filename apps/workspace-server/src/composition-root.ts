import type { Server } from "node:http";
import type { RevisionStoreOptions } from "@agidn/document-engine";
import { DocumentService } from "./application/document-service.js";
import { PersistentRevisionStore } from "./application/persistent-revision-store.js";
import { loadWorkspaceProject, type WorkspaceProject } from "./infrastructure/filesystem/project-loader.js";
import { AtomicJsonRevisionStateFile, defaultRevisionStatePath } from "./infrastructure/filesystem/revision-state-file.js";
import { createWorkspaceHttpServer } from "./transport/http/http-server.js";

export interface WorkspaceServerApplication {
  project: WorkspaceProject;
  store: PersistentRevisionStore;
  revisionStatePath: string;
  documentService: DocumentService;
  httpServer: Server;
}

export interface WorkspaceServerOptions extends RevisionStoreOptions {
  revisionStatePath?: string;
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
  const documentService = new DocumentService(store);
  const httpServer = createWorkspaceHttpServer(documentService);
  return { project, store, revisionStatePath, documentService, httpServer };
}
