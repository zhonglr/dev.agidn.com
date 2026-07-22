import {
  checkCommitCommandsResponse,
  checkGetDocumentResponse,
  decodeCommitCommandsRequest,
  decodeNavigationRequest
} from "@agidn/api-protocol";
import { InMemoryRevisionStore } from "@agidn/document-engine";
import { DocumentService } from "../../apps/workspace-server/src/application/document-service.js";
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

  it("validates application responses at the process boundary", async () => {
    const project = await loadGoldenProject();
    const service = new DocumentService(new InMemoryRevisionStore(project.document, project));
    const current = service.getCurrent();
    const committed = service.commit({
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
});
