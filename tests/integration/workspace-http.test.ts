import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { ContextPackage } from "@agidn/context-exporter";
import { InMemoryProjectRevisionStore } from "@agidn/document-engine";
import { CatalogService } from "../../apps/workspace-server/src/application/catalog-service.js";
import { ExportService } from "../../apps/workspace-server/src/application/export-service.js";
import { ProjectService } from "../../apps/workspace-server/src/application/project-service.js";
import { createWorkspaceHttpServer } from "../../apps/workspace-server/src/transport/http/http-server.js";
import { loadFoundationProject } from "../helpers.js";

describe("Workspace Project HTTP transport", () => {
  it("maps project, history, catalog, export and mutations", async () => {
    const project = await loadFoundationProject();
    const store = new InMemoryProjectRevisionStore(
      { document: project.document, assets: project.assets },
      {
        primitives: project.primitiveComponents,
        tokens: project.tokens,
        actions: project.actions
      }
    );
    let exportedPackage: ContextPackage | undefined;
    const server = createWorkspaceHttpServer({
      project: new ProjectService(store),
      catalog: new CatalogService(project, store),
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
      const currentResponse = await fetch(`${baseUrl}/v1/project`);
      expect(currentResponse.status).toBe(200);
      expect(await currentResponse.json()).toMatchObject({
        ok: true,
        revision: {
          revision: 0,
          project: {
            document: { id: project.document.id },
            assets: { schemaVersion: "2.0.0" }
          }
        }
      });

      const invalidResponse = await fetch(
        `${baseUrl}/v1/project/commands`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            protocolVersion: "2.0.0",
            baseRevision: 0,
            commands: [],
            directWrite: true
          })
        }
      );
      expect(invalidResponse.status).toBe(400);
      expect(await invalidResponse.json()).toMatchObject({
        ok: false,
        error: "PROTOCOL_INVALID"
      });

      const pattern = structuredClone(
        project.assets.patterns["project.two-column-copy"]!
      );
      pattern.id = "project.http-pattern";
      const commitResponse = await fetch(
        `${baseUrl}/v1/project/commands`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            protocolVersion: "2.0.0",
            baseRevision: 0,
            commands: [
              {
                commandId: "http_project_asset",
                protocolVersion: "2.0.0",
                type: "asset.pattern.upsert",
                asset: pattern
              },
              {
                commandId: "http_project_role",
                protocolVersion: "2.0.0",
                type: "node.setRole",
                nodeId: "text_foundation",
                role: "description"
              }
            ]
          })
        }
      );
      expect(commitResponse.status).toBe(200);
      expect(await commitResponse.json()).toMatchObject({
        ok: true,
        revision: {
          revision: 1,
          project: {
            assets: {
              patterns: {
                [pattern.id]: { id: pattern.id }
              }
            }
          }
        },
        patches: [
          { operations: [{ op: "asset.upsert" }] },
          { operations: [{ op: "node.update" }] }
        ]
      });

      const historyResponse = await fetch(
        `${baseUrl}/v1/project/history`
      );
      expect(historyResponse.status).toBe(200);
      expect(await historyResponse.json()).toMatchObject({
        ok: true,
        currentRevision: 1,
        canUndo: true,
        entries: [
          {
            kind: "commit",
            commands: [
              { type: "asset.pattern.upsert" },
              { type: "node.setRole" }
            ]
          }
        ]
      });

      const catalogResponse = await fetch(`${baseUrl}/v1/catalog`);
      expect(catalogResponse.status).toBe(200);
      const catalog = (await catalogResponse.json()) as {
        assets: { patterns: Record<string, unknown> };
      };
      expect(catalog.assets.patterns[pattern.id]).toBeDefined();

      const exportResponse = await fetch(`${baseUrl}/v1/export`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          protocolVersion: "2.0.0",
          revision: 1
        })
      });
      expect(exportResponse.status).toBe(200);
      expect(await exportResponse.json()).toMatchObject({
        ok: true,
        revision: 1,
        outputDirectory: "/workspace/.ui-context"
      });
      expect(exportedPackage?.files["document.json"]).toContain(
        "\"role\": \"description\""
      );
      expect(exportedPackage?.files["assets.json"]).toContain(
        pattern.id
      );

      const conflictResponse = await fetch(
        `${baseUrl}/v1/project/commands`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            protocolVersion: "2.0.0",
            baseRevision: 0,
            commands: [
              {
                commandId: "http_project_stale",
                protocolVersion: "2.0.0",
                type: "node.setName",
                nodeId: "text_foundation",
                name: "Stale"
              }
            ]
          })
        }
      );
      expect(conflictResponse.status).toBe(409);

      const undoResponse = await fetch(
        `${baseUrl}/v1/project/undo`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            protocolVersion: "2.0.0",
            baseRevision: 1
          })
        }
      );
      expect(undoResponse.status).toBe(200);
      expect(await undoResponse.json()).toMatchObject({
        ok: true,
        revision: { revision: 2, project: expect.any(Object) }
      });

      const restoreResponse = await fetch(
        `${baseUrl}/v1/project/history/restore`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            protocolVersion: "2.0.0",
            baseRevision: 2,
            targetRevision: 1
          })
        }
      );
      expect(restoreResponse.status).toBe(200);
      expect(await restoreResponse.json()).toMatchObject({
        ok: true,
        revision: { revision: 3, project: expect.any(Object) }
      });
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
