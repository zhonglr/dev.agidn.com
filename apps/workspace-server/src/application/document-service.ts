import type {
  CommitCommandsRequest,
  CommitCommandsResponse,
  GetDocumentResponse,
  NavigationRequest,
  NavigationResponse,
  RestoreRevisionRequest
} from "@agidn/api-protocol";
import type { RuleViolation } from "@agidn/rule-engine";
import type { CommitResult, NavigationResult } from "@agidn/document-engine";
import type { DocumentServicePort } from "./ports/document-service.js";
import type { WorkspaceRevisionStorePort } from "./ports/revision-store.js";

function violationsForApi(violations: RuleViolation[]) {
  return violations.map(({ code, message, nodeId, path }) => ({
    code,
    message,
    ...(nodeId ? { nodeId } : {}),
    ...(path ? { path } : {})
  }));
}

export class DocumentService implements DocumentServicePort {
  constructor(private readonly store: WorkspaceRevisionStorePort) {}

  getCurrent(): GetDocumentResponse {
    return { protocolVersion: "1.0.0", ok: true, revision: this.store.getCurrent() };
  }

  async commit(request: CommitCommandsRequest): Promise<CommitCommandsResponse> {
    return this.#mapCommit(await this.store.commit({
      baseRevision: request.baseRevision,
      commands: request.commands,
      ...(request.source ? { source: request.source } : {})
    }));
  }

  async undo(request: NavigationRequest): Promise<NavigationResponse> {
    return this.#mapNavigation(await this.store.undo(request.baseRevision, request.source ?? "human"));
  }

  async redo(request: NavigationRequest): Promise<NavigationResponse> {
    return this.#mapNavigation(await this.store.redo(request.baseRevision, request.source ?? "human"));
  }

  async restore(request: RestoreRevisionRequest): Promise<NavigationResponse> {
    return this.#mapNavigation(await this.store.restore(request.baseRevision, request.targetRevision, request.source ?? "human"));
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
