import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { InMemoryRevisionStore } from "@agidn/document-engine";
import { DocumentService } from "../../apps/workspace-server/src/application/document-service.js";
import { createWorkspaceHttpServer } from "../../apps/workspace-server/src/transport/http/http-server.js";
import { loadGoldenProject } from "../helpers.js";

describe("Workspace HTTP transport", () => {
  it("maps protocol, commits, conflicts and navigation without domain writes", async () => {
    const project = await loadGoldenProject();
    const store = new InMemoryRevisionStore(project.document, project);
    const server = createWorkspaceHttpServer(new DocumentService(store));
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
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
