import type {
  CommitCommandsRequest,
  CommitCommandsResponse,
  GetDocumentResponse,
  NavigationRequest,
  NavigationResponse
} from "@agidn/api-protocol";
import type { RuleViolation } from "@agidn/rule-engine";
import { InMemoryRevisionStore, type CommitResult, type NavigationResult } from "@agidn/document-engine";
import type { DocumentServicePort } from "./ports/document-service.js";

function violationsForApi(violations: RuleViolation[]) {
  return violations.map(({ code, message, nodeId, path }) => ({
    code,
    message,
    ...(nodeId ? { nodeId } : {}),
    ...(path ? { path } : {})
  }));
}

export class DocumentService implements DocumentServicePort {
  constructor(private readonly store: InMemoryRevisionStore) {}

  getCurrent(): GetDocumentResponse {
    return { protocolVersion: "1.0.0", ok: true, revision: this.store.getCurrent() };
  }

  commit(request: CommitCommandsRequest): CommitCommandsResponse {
    return this.#mapCommit(this.store.commit({
      baseRevision: request.baseRevision,
      commands: request.commands,
      ...(request.source ? { source: request.source } : {})
    }));
  }

  undo(request: NavigationRequest): NavigationResponse {
    return this.#mapNavigation(this.store.undo(request.baseRevision, request.source ?? "human"));
  }

  redo(request: NavigationRequest): NavigationResponse {
    return this.#mapNavigation(this.store.redo(request.baseRevision, request.source ?? "human"));
  }

  #mapCommit(result: CommitResult): CommitCommandsResponse {
    if (result.accepted) {
      return { protocolVersion: "1.0.0", ok: true, revision: result.revision, patches: result.patches };
    }
    if (result.reason === "DUPLICATE_COMMAND") {
      return { protocolVersion: "1.0.0", ok: false, error: result.reason, currentRevision: result.currentRevision, commandId: result.commandId };
    }
    if (result.reason === "COMMAND_REJECTED") {
      return {
        protocolVersion: "1.0.0",
        ok: false,
        error: result.reason,
        currentRevision: result.currentRevision,
        commandIndex: result.commandIndex,
        violations: violationsForApi(result.violations)
      };
    }
    return { protocolVersion: "1.0.0", ok: false, error: result.reason, currentRevision: result.currentRevision };
  }

  #mapNavigation(result: NavigationResult): NavigationResponse {
    if (result.accepted) return { protocolVersion: "1.0.0", ok: true, revision: result.revision };
    return { protocolVersion: "1.0.0", ok: false, error: result.reason, currentRevision: result.currentRevision };
  }
}
