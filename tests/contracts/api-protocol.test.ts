import {
  checkCommitCommandsResponse,
  checkExportContextResponse,
  checkGetCatalogResponse,
  checkGetDocumentResponse,
  checkGetHistoryResponse,
  decodeCommitCommandsRequest,
  decodeExportContextRequest,
  decodeNavigationRequest,
  decodeRestoreRevisionRequest
} from "@agidn/api-protocol";
import { InMemoryRevisionStore } from "@agidn/document-engine";
import { CatalogService } from "../../apps/workspace-server/src/application/catalog-service.js";
import { DocumentService } from "../../apps/workspace-server/src/application/document-service.js";
import { ExportService } from "../../apps/workspace-server/src/application/export-service.js";
import { HistoryService } from "../../apps/workspace-server/src/application/history-service.js";
import { loadGoldenProject } from "../helpers.js";

describe("Workspace API protocol", () => {
  it("strictly decodes versioned Command requests", () => {
    const request = {
      protocolVersion: "1.0.0",
      baseRevision: 0,
      commands: [{
        commandId: "cmd_api_role",
        protocolVersion: "1.0.0",
        type: "node.setRole",
        nodeId: "text_hero",
        role: "api-summary"
      }]
    };
    expect(decodeCommitCommandsRequest(request)).toEqual({ valid: true, value: request });
    expect(decodeCommitCommandsRequest({ ...request, directWrite: true }).valid).toBe(false);
    expect(decodeCommitCommandsRequest({ ...request, protocolVersion: "2.0.0" }).valid).toBe(false);
  });

  it("strictly decodes navigation requests", () => {
    expect(decodeNavigationRequest({ protocolVersion: "1.0.0", baseRevision: 3 }).valid).toBe(true);
    expect(decodeNavigationRequest({ protocolVersion: "1.0.0", baseRevision: -1 }).valid).toBe(false);
  });

  it("strictly decodes historical restore requests", () => {
    expect(decodeRestoreRevisionRequest({ protocolVersion: "1.0.0", baseRevision: 8, targetRevision: 2 }).valid).toBe(true);
    expect(decodeRestoreRevisionRequest({ protocolVersion: "1.0.0", baseRevision: 8, targetRevision: -1 }).valid).toBe(false);
    expect(decodeRestoreRevisionRequest({ protocolVersion: "1.0.0", baseRevision: 8, targetRevision: 2, directWrite: true }).valid).toBe(false);
  });

  it("strictly decodes Revision export requests without accepting client paths", () => {
    expect(decodeExportContextRequest({ protocolVersion: "1.0.0" }).valid).toBe(true);
    expect(decodeExportContextRequest({ protocolVersion: "1.0.0", revision: 3 }).valid).toBe(true);
    expect(decodeExportContextRequest({ protocolVersion: "1.0.0", revision: -1 }).valid).toBe(false);
    expect(decodeExportContextRequest({ protocolVersion: "1.0.0", outputDirectory: "/tmp/escape" }).valid).toBe(false);
  });

  it("validates application responses at the process boundary", async () => {
    const project = await loadGoldenProject();
    const service = new DocumentService(new InMemoryRevisionStore(project.document, project));
    const current = service.getCurrent();
    const committed = await service.commit({
      protocolVersion: "1.0.0",
      baseRevision: 0,
      commands: [{
        commandId: "cmd_api_commit",
        protocolVersion: "1.0.0",
        type: "node.setRole",
        nodeId: "text_hero",
        role: "api-summary"
      }]
    });

    expect(checkGetDocumentResponse(current)).toBe(true);
    expect(checkCommitCommandsResponse(committed)).toBe(true);
    expect(committed).toMatchObject({ ok: true, revision: { revision: 1 } });
  });

  it("validates History, Catalog and Export application responses", async () => {
    const project = await loadGoldenProject();
    const store = new InMemoryRevisionStore(project.document, project);
    const history = new HistoryService(store).getHistory();
    const catalog = new CatalogService(project).getCatalog();
    const exported = await new ExportService(store, project, { write: async () => "/workspace/.ui-context" }).exportContext({
      protocolVersion: "1.0.0"
    });

    expect(checkGetHistoryResponse(history)).toBe(true);
    expect(checkGetCatalogResponse(catalog)).toBe(true);
    expect(checkExportContextResponse(exported)).toBe(true);
    expect(checkGetHistoryResponse({ ...history, internalState: true })).toBe(false);
    expect(checkGetCatalogResponse({ ...catalog, internalState: true })).toBe(false);
  });
});
