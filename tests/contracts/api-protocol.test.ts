import {
  checkCommitProjectCommandsResponse,
  checkExportContextResponse,
  checkGetCatalogResponse,
  checkGetProjectHistoryResponse,
  checkGetProjectResponse,
  decodeCommitProjectCommandsRequest,
  decodeExportContextRequest,
  decodeNavigationRequest,
  decodeRestoreRevisionRequest
} from "@agidn/api-protocol";
import { InMemoryProjectRevisionStore } from "@agidn/document-engine";
import { CatalogService } from "../../apps/workspace-server/src/application/catalog-service.js";
import { ExportService } from "../../apps/workspace-server/src/application/export-service.js";
import { ProjectService } from "../../apps/workspace-server/src/application/project-service.js";
import { loadFoundationProject } from "../helpers.js";

describe("Workspace Project API protocol", () => {
  it("strictly decodes mixed Project Command requests", async () => {
    const project = await loadFoundationProject();
    const asset = structuredClone(
      project.assets.patterns["project.two-column-copy"]!
    );
    asset.id = "project.api-pattern";
    const request = {
      protocolVersion: "2.0.0",
      baseRevision: 0,
      commands: [
        {
          commandId: "asset_api_upsert",
          protocolVersion: "2.0.0",
          type: "asset.pattern.upsert",
          asset
        },
        {
          commandId: "document_api_name",
          protocolVersion: "2.0.0",
          type: "node.setName",
          nodeId: "heading_foundation",
          name: "Project API"
        }
      ]
    };
    expect(decodeCommitProjectCommandsRequest(request)).toEqual({
      valid: true,
      value: request
    });
    expect(
      decodeCommitProjectCommandsRequest({
        ...request,
        directAssetWrite: true
      }).valid
    ).toBe(false);
    expect(
      decodeCommitProjectCommandsRequest({
        ...request,
        protocolVersion: "1.0.0"
      }).valid
    ).toBe(false);
  });

  it("strictly decodes navigation and restore requests", () => {
    expect(
      decodeNavigationRequest({
        protocolVersion: "2.0.0",
        baseRevision: 3
      }).valid
    ).toBe(true);
    expect(
      decodeNavigationRequest({
        protocolVersion: "2.0.0",
        baseRevision: -1
      }).valid
    ).toBe(false);
    expect(
      decodeRestoreRevisionRequest({
        protocolVersion: "2.0.0",
        baseRevision: 8,
        targetRevision: 2
      }).valid
    ).toBe(true);
    expect(
      decodeRestoreRevisionRequest({
        protocolVersion: "2.0.0",
        baseRevision: 8,
        targetRevision: 2,
        directWrite: true
      }).valid
    ).toBe(false);
  });

  it("strictly decodes Revision export without client paths", () => {
    expect(
      decodeExportContextRequest({ protocolVersion: "2.0.0" }).valid
    ).toBe(true);
    expect(
      decodeExportContextRequest({
        protocolVersion: "2.0.0",
        revision: 3
      }).valid
    ).toBe(true);
    expect(
      decodeExportContextRequest({
        protocolVersion: "2.0.0",
        outputDirectory: "/tmp/escape"
      }).valid
    ).toBe(false);
  });

  it("validates Project, History, Catalog and Export responses", async () => {
    const project = await loadFoundationProject();
    const store = new InMemoryProjectRevisionStore(
      { document: project.document, assets: project.assets },
      {
        primitives: project.primitiveComponents,
        tokens: project.tokens,
        actions: project.actions
      }
    );
    const service = new ProjectService(store);
    const asset = structuredClone(
      project.assets.patterns["project.two-column-copy"]!
    );
    asset.id = "project.service-pattern";
    const committed = await service.commit({
      protocolVersion: "2.0.0",
      baseRevision: 0,
      commands: [
        {
          protocolVersion: "2.0.0",
          commandId: "service_asset_upsert",
          type: "asset.pattern.upsert",
          asset
        }
      ]
    });
    const catalog = new CatalogService(project, store).getCatalog();
    const exported = await new ExportService(store, project, {
      write: async () => "/workspace/.ui-context"
    }).exportContext({ protocolVersion: "2.0.0" });

    expect(checkGetProjectResponse(service.getCurrent())).toBe(true);
    expect(checkCommitProjectCommandsResponse(committed)).toBe(true);
    expect(checkGetProjectHistoryResponse(service.getHistory())).toBe(
      true
    );
    expect(checkGetCatalogResponse(catalog)).toBe(true);
    expect(checkExportContextResponse(exported)).toBe(true);
    expect(catalog.assets.patterns[asset.id]).toBeDefined();
    expect(
      checkGetProjectResponse({
        ...service.getCurrent(),
        internalState: true
      })
    ).toBe(false);
  });
});
