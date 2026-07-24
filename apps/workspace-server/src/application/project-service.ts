import type {
  CommitProjectCommandsRequest,
  CommitProjectCommandsResponse,
  GetProjectHistoryResponse,
  GetProjectResponse,
  NavigationRequest,
  ProjectNavigationResponse,
  RestoreRevisionRequest
} from "@agidn/api-protocol";
import type {
  ProjectCommandViolation,
  ProjectCommitResult,
  ProjectNavigationResult
} from "@agidn/document-engine";
import type { ProjectServicePort } from "./ports/project-service.js";
import type { WorkspaceProjectRevisionStorePort } from "./ports/project-revision-store.js";

function violationsForApi(
  violations: ProjectCommandViolation[]
): Array<{
  code: string;
  message: string;
  nodeId?: string;
  path?: string;
}> {
  return violations.map((violation) => ({
    code: violation.code,
    message: violation.message,
    ...("nodeId" in violation && violation.nodeId
      ? { nodeId: violation.nodeId }
      : {}),
    ...(violation.path ? { path: violation.path } : {})
  }));
}

export class ProjectService implements ProjectServicePort {
  constructor(
    private readonly store: WorkspaceProjectRevisionStorePort
  ) {}

  getCurrent(): GetProjectResponse {
    return {
      protocolVersion: "2.0.0",
      ok: true,
      revision: this.store.getCurrent()
    };
  }

  getHistory(): GetProjectHistoryResponse {
    return {
      protocolVersion: "2.0.0",
      ok: true,
      currentRevision: this.store.currentRevision,
      canUndo: this.store.canUndo,
      canRedo: this.store.canRedo,
      entries: this.store.getHistory()
    };
  }

  async commit(
    request: CommitProjectCommandsRequest
  ): Promise<CommitProjectCommandsResponse> {
    return this.#mapCommit(
      await this.store.commit({
        baseRevision: request.baseRevision,
        commands: request.commands,
        ...(request.source ? { source: request.source } : {})
      })
    );
  }

  async undo(
    request: NavigationRequest
  ): Promise<ProjectNavigationResponse> {
    return this.#mapNavigation(
      await this.store.undo(
        request.baseRevision,
        request.source ?? "human"
      )
    );
  }

  async redo(
    request: NavigationRequest
  ): Promise<ProjectNavigationResponse> {
    return this.#mapNavigation(
      await this.store.redo(
        request.baseRevision,
        request.source ?? "human"
      )
    );
  }

  async restore(
    request: RestoreRevisionRequest
  ): Promise<ProjectNavigationResponse> {
    return this.#mapNavigation(
      await this.store.restore(
        request.baseRevision,
        request.targetRevision,
        request.source ?? "human"
      )
    );
  }

  #mapCommit(
    result: ProjectCommitResult
  ): CommitProjectCommandsResponse {
    if (result.accepted) {
      return {
        protocolVersion: "2.0.0",
        ok: true,
        revision: result.revision,
        patches: result.patches
      };
    }
    if (result.reason === "DUPLICATE_COMMAND") {
      return {
        protocolVersion: "2.0.0",
        ok: false,
        error: result.reason,
        currentRevision: result.currentRevision,
        commandId: result.commandId
      };
    }
    if (result.reason === "COMMAND_REJECTED") {
      return {
        protocolVersion: "2.0.0",
        ok: false,
        error: result.reason,
        currentRevision: result.currentRevision,
        commandIndex: result.commandIndex,
        violations: violationsForApi(result.violations)
      };
    }
    return {
      protocolVersion: "2.0.0",
      ok: false,
      error: result.reason,
      currentRevision: result.currentRevision
    };
  }

  #mapNavigation(
    result: ProjectNavigationResult
  ): ProjectNavigationResponse {
    if (result.accepted) {
      return {
        protocolVersion: "2.0.0",
        ok: true,
        revision: result.revision
      };
    }
    return {
      protocolVersion: "2.0.0",
      ok: false,
      error: result.reason,
      currentRevision: result.currentRevision
    };
  }
}
