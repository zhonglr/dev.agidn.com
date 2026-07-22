import type { AddressInfo } from "node:net";
import { once } from "node:events";
import type { ContextPackage } from "@agidn/context-exporter";
import { InMemoryRevisionStore } from "@agidn/document-engine";
import { CatalogService } from "../../apps/workspace-server/src/application/catalog-service.js";
import { DocumentService } from "../../apps/workspace-server/src/application/document-service.js";
import { ExportService } from "../../apps/workspace-server/src/application/export-service.js";
import { HistoryService } from "../../apps/workspace-server/src/application/history-service.js";
import { createWorkspaceHttpServer } from "../../apps/workspace-server/src/transport/http/http-server.js";
import { loadGoldenProject } from "../helpers.js";

describe("Workspace HTTP transport", () => {
  it("maps document, history, catalog, export and mutations through application services", async () => {
    const project = await loadGoldenProject();
    const store = new InMemoryRevisionStore(project.document, project);
    let exportedPackage: ContextPackage | undefined;
    const server = createWorkspaceHttpServer({
      document: new DocumentService(store),
      history: new HistoryService(store),
      catalog: new CatalogService(project),
      contextExport: new ExportService(store, project, {
        write: async (contextPackage) => {
          exportedPackage = contextPackage;
          return "/workspace/.ui-context";
        }
      })
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const currentResponse = await fetch(`${baseUrl}/v1/document`);
      expect(currentResponse.status).toBe(200);
      expect(await currentResponse.json()).toMatchObject({ ok: true, revision: { revision: 0 } });

      const invalidResponse = await fetch(`${baseUrl}/v1/commands`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ protocolVersion: "1.0.0", baseRevision: 0, commands: [], directWrite: true })
      });
      expect(invalidResponse.status).toBe(400);
      expect(await invalidResponse.json()).toMatchObject({ ok: false, error: "PROTOCOL_INVALID" });
      expect(store.currentRevision).toBe(0);

      const commitResponse = await fetch(`${baseUrl}/v1/commands`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          protocolVersion: "1.0.0",
          baseRevision: 0,
          commands: [{
            commandId: "cmd_http_role",
            protocolVersion: "1.0.0",
            type: "node.setRole",
            nodeId: "text_hero",
            role: "http-summary"
          }]
        })
      });
      expect(commitResponse.status).toBe(200);
      expect(await commitResponse.json()).toMatchObject({ ok: true, revision: { revision: 1 } });

      const historyResponse = await fetch(`${baseUrl}/v1/history`);
      expect(historyResponse.status).toBe(200);
      expect(await historyResponse.json()).toMatchObject({
        ok: true,
        currentRevision: 1,
        canUndo: true,
        canRedo: false,
        entries: [{ kind: "commit", revision: 1, commands: [{ commandId: "cmd_http_role" }] }]
      });

      const catalogResponse = await fetch(`${baseUrl}/v1/catalog`);
      expect(catalogResponse.status).toBe(200);
      const catalog = await catalogResponse.json() as { components: { components: Record<string, unknown> }; tokens: { tokens: Record<string, unknown> } };
      expect(Object.keys(catalog.components.components)).toHaveLength(15);
      expect(catalog.tokens.tokens).toHaveProperty("color.action.primary");

      const invalidExportResponse = await fetch(`${baseUrl}/v1/export`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ protocolVersion: "1.0.0", revision: 1, outputDirectory: "/tmp/escape" })
      });
      expect(invalidExportResponse.status).toBe(400);
      expect(await invalidExportResponse.json()).toMatchObject({ ok: false, error: "PROTOCOL_INVALID" });

      const exportResponse = await fetch(`${baseUrl}/v1/export`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ protocolVersion: "1.0.0", revision: 1 })
      });
      expect(exportResponse.status).toBe(200);
      expect(await exportResponse.json()).toMatchObject({
        ok: true,
        revision: 1,
        outputDirectory: "/workspace/.ui-context",
        manifest: { protocolVersion: "1.0.0", hashAlgorithm: "sha256" }
      });
      expect(exportedPackage?.files["document.json"]).toContain("http-summary");

      const missingExportResponse = await fetch(`${baseUrl}/v1/export`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ protocolVersion: "1.0.0", revision: 99 })
      });
      expect(missingExportResponse.status).toBe(404);
      expect(await missingExportResponse.json()).toMatchObject({
        ok: false,
        error: "REVISION_NOT_FOUND",
        requestedRevision: 99,
        currentRevision: 1
      });

      const conflictResponse = await fetch(`${baseUrl}/v1/commands`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          protocolVersion: "1.0.0",
          baseRevision: 0,
          commands: [{
            commandId: "cmd_http_stale",
            protocolVersion: "1.0.0",
            type: "node.setRole",
            nodeId: "text_hero",
            role: "stale-summary"
          }]
        })
      });
      expect(conflictResponse.status).toBe(409);
      expect(await conflictResponse.json()).toMatchObject({ ok: false, error: "REVISION_CONFLICT", currentRevision: 1 });

      const undoResponse = await fetch(`${baseUrl}/v1/undo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ protocolVersion: "1.0.0", baseRevision: 1 })
      });
      expect(undoResponse.status).toBe(200);
      expect(await undoResponse.json()).toMatchObject({ ok: true, revision: { revision: 2 } });

      const restoreResponse = await fetch(`${baseUrl}/v1/history/restore`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ protocolVersion: "1.0.0", baseRevision: 2, targetRevision: 1 })
      });
      expect(restoreResponse.status).toBe(200);
      expect(await restoreResponse.json()).toMatchObject({ ok: true, revision: { revision: 3, document: { children: expect.any(Array) } } });
      expect(store.getHistory().at(-1)).toMatchObject({ kind: "restore", targetRevision: 1 });

      const missingRestoreResponse = await fetch(`${baseUrl}/v1/history/restore`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ protocolVersion: "1.0.0", baseRevision: 3, targetRevision: 99 })
      });
      expect(missingRestoreResponse.status).toBe(404);
      expect(await missingRestoreResponse.json()).toMatchObject({ ok: false, error: "REVISION_NOT_FOUND", currentRevision: 3 });
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
