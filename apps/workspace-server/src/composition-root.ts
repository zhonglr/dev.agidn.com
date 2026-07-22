import type { Server } from "node:http";
import { InMemoryRevisionStore } from "@agidn/document-engine";
import { DocumentService } from "./application/document-service.js";
import { loadWorkspaceProject, type WorkspaceProject } from "./infrastructure/filesystem/project-loader.js";
import { createWorkspaceHttpServer } from "./transport/http/http-server.js";

export interface WorkspaceServerApplication {
  project: WorkspaceProject;
  store: InMemoryRevisionStore;
  documentService: DocumentService;
  httpServer: Server;
}

export async function createWorkspaceServerApplication(documentPath: string): Promise<WorkspaceServerApplication> {
  const project = await loadWorkspaceProject(documentPath);
  const store = new InMemoryRevisionStore(project.document, project);
  const documentService = new DocumentService(store);
  const httpServer = createWorkspaceHttpServer(documentService);
  return { project, store, documentService, httpServer };
}
